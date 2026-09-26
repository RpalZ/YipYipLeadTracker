import assert from "node:assert/strict";
import test from "node:test";

import type { DiscoveryAgentOutput } from "../lib/discovery/contracts";
import {
  cachedInputTokensFromUsage,
  estimateOpenAICostEur,
  resolveOpenAIModelPricing,
  resolveUsdToEurRate,
} from "../lib/discovery/cost";
import {
  DEFAULT_DUTCH_AGENCY_PROFILE,
  buildOpportunityKey,
  buildSignalSourceItemId,
  canonicalizeHttpsUrl,
  collectWebSearchEvidenceUrls,
  collectWebSearchQueries,
  countWebSearchCalls,
  resolveSignalSourceItemId,
  validateDiscoveryOutput,
} from "../lib/discovery/validation";
import { buildDiscoveryInstructions } from "../lib/discovery/prompt";

const candidate: DiscoveryAgentOutput["candidates"][number] = {
  title: "Digital platform redesign",
  organization: "Gemeente Utrecht",
  summary: "The organization is preparing a replacement for its participation platform.",
  whyNow: "A strategy update starts procurement preparation this quarter.",
  projectClues: ["replacement participation platform"],
  maturity: "planning",
  budgetClue: null,
  timingClue: "this quarter",
  contactClue: "digital participation lead",
  location: "Utrecht, NL",
  workMode: "Hybrid",
  technicalDifficulty: "High",
  entitySpecificity: "organization_specific",
  sectorCategories: ["public services"],
  actionabilityStatus: "current",
  actionableUntil: "2026-12-31",
  activeFollowOnClue: null,
  canonicalSourceUrl: "https://www.Example.nl/news/item/?utm_source=test#details",
  publisher: "Example",
  publicationDate: "2026-09-01",
  evidenceExcerpt: "The municipality is preparing a replacement participation platform.",
  facts: ["The current platform will be replaced."],
  inferences: ["An agency selection may follow."],
  signalType: "strategy",
  confidence: 0.81,
};

test("canonicalizeHttpsUrl removes trackers, www, fragments, and trailing slash", () => {
  assert.equal(canonicalizeHttpsUrl(candidate.canonicalSourceUrl), "https://example.nl/news/item");
  assert.equal(canonicalizeHttpsUrl("http://example.nl/nope"), null);
});

test("web-search evidence allow-list excludes URLs present only in model output", () => {
  assert.deepEqual(collectWebSearchEvidenceUrls({
    output: { sourceUrls: ["https://invented.example/result"] },
    response: [
      { type: "web_search_call", action: { type: "search", sources: [{ type: "url", url: "https://source.example/a?utm_source=test" }] } },
      { type: "message", content: [{ type: "output_text", annotations: [{ type: "url_citation", url: "https://citation.example/b" }] }] },
    ],
  }).sort(), ["https://citation.example/b", "https://source.example/a"].sort());
});

test("counts normalized and raw hosted web-search calls", () => {
  assert.equal(countWebSearchCalls([
    { type: "web_search_call", id: "one" },
    { type: "hosted_tool_call", name: "web_search_preview", id: "two" },
    { type: "message", content: [] },
  ]), 2);
});

test("does not count the same hosted search again across normalized and raw response telemetry", () => {
  const firstRawCall = {
    type: "web_search_call",
    id: "search-one",
    action: { type: "search", query: "first query" },
  };
  const secondRawCall = {
    type: "web_search_call",
    id: "search-two",
    action: { type: "search", query: "second query" },
  };

  assert.equal(countWebSearchCalls({
    output: [
      {
        type: "hosted_tool_call",
        name: "web_search_call",
        id: "search-one",
        providerData: firstRawCall,
      },
      {
        type: "hosted_tool_call",
        name: "web_search_call",
        id: "search-two",
        providerData: secondRawCall,
      },
    ],
    providerData: { output: [firstRawCall, secondRawCall] },
  }), 2);
});

test("collects queries only from web-search telemetry", () => {
  assert.deepEqual(collectWebSearchQueries({
    modelOutput: { searchQueries: ["do not trust this"] },
    response: {
      type: "web_search_call",
      action: { type: "search", query: "site:overheid.nl digitale aanbesteding" },
    },
  }), ["site:overheid.nl digitale aanbesteding"]);
});

test("accepts a cited, recent, concrete candidate and creates deterministic keys", () => {
  const output = { searchQueries: ["Dutch digital agency pitch"], candidates: [candidate], zeroResultReason: null };
  const [result] = validateDiscoveryOutput({
    output,
    consultedUrls: ["https://example.nl/news/item?utm_medium=email"],
    profile: DEFAULT_DUTCH_AGENCY_PROFILE,
    now: new Date("2026-09-23T00:00:00Z"),
  });
  assert.equal(result.accepted, true);
  assert.equal(result.rejectionReasons.length, 0);
  assert.equal(result.opportunityKey, buildOpportunityKey(candidate.organization, candidate.title));
  assert.equal(result.sourceItemId, buildSignalSourceItemId(candidate, "https://example.nl/news/item"));
});

test("gives several candidates on one roundup page distinct stable source-item identities", () => {
  const canonicalUrl = "https://example.nl/weekly-roundup";
  const first = { ...candidate, canonicalSourceUrl: canonicalUrl };
  const second = {
    ...candidate,
    canonicalSourceUrl: canonicalUrl,
    title: "Resident portal replacement",
    organization: "Gemeente Rotterdam",
    evidenceExcerpt: "Rotterdam is replacing its resident portal.",
  };
  const changedExcerpt = { ...first, evidenceExcerpt: "A changed excerpt." };

  assert.notEqual(
    buildSignalSourceItemId(first, canonicalUrl),
    buildSignalSourceItemId(second, canonicalUrl),
  );
  assert.equal(
    buildSignalSourceItemId(first, canonicalUrl),
    buildSignalSourceItemId(changedExcerpt, canonicalUrl),
  );
  assert.equal(
    resolveSignalSourceItemId(first, canonicalUrl, undefined),
    buildSignalSourceItemId(first, canonicalUrl),
    "durable pre-migration snapshots derive the new identity during retry",
  );
  assert.equal(
    resolveSignalSourceItemId(first, canonicalUrl, "stored-item-id"),
    "stored-item-id",
  );
});

test("rejects uncited, stale, low-confidence, and restricted candidates", () => {
  const stale = { ...candidate, canonicalSourceUrl: "https://linkedin.com/posts/1", publicationDate: "2025-01-01", confidence: 0.4 };
  const [result] = validateDiscoveryOutput({
    output: { searchQueries: ["query"], candidates: [stale], zeroResultReason: null },
    consultedUrls: ["https://example.nl/other"],
    profile: DEFAULT_DUTCH_AGENCY_PROFILE,
    now: new Date("2026-09-23T00:00:00Z"),
  });
  assert.deepEqual(result.rejectionReasons.sort(), ["low_confidence", "outside_lookback", "restricted_source", "uncited_url"].sort());
});

test("allows explicitly undated evidence and audits duplicate candidates", () => {
  const undated = { ...candidate, publicationDate: null };
  const results = validateDiscoveryOutput({
    output: { searchQueries: ["query"], candidates: [undated, undated], zeroResultReason: null },
    consultedUrls: [candidate.canonicalSourceUrl],
    profile: DEFAULT_DUTCH_AGENCY_PROFILE,
  });
  assert.equal(results[0].accepted, true);
  assert.deepEqual(results[1].rejectionReasons, ["duplicate_candidate"]);
});

test("keeps a funding programme without an identified buyer at Signal level", () => {
  const programme = {
    ...candidate,
    title: "Digital inclusion funding programme",
    organization: "Example Programme Administrator",
    entitySpecificity: "programme_only" as const,
    signalType: "funding" as const,
  };
  const [result] = validateDiscoveryOutput({
    output: { searchQueries: ["digital inclusion funding"], candidates: [programme], zeroResultReason: null },
    consultedUrls: [programme.canonicalSourceUrl],
    profile: DEFAULT_DUTCH_AGENCY_PROFILE,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.programmeOnly, true);
  assert.equal(result.opportunityKey, null);
});

test("discovery retains concrete signals whose qualification facts are still unknown", () => {
  const instructions = buildDiscoveryInstructions(DEFAULT_DUTCH_AGENCY_PROFILE, 5);
  assert.match(instructions, /Do not discard a concrete, current software-project signal/);
  assert.match(instructions, /budget, buyer contact, delivery route, or exact addressable scope is not yet published/);
  assert.match(instructions, /assessment and bounded research stages can investigate it/);
  assert.match(instructions, /zeroResultReason/);
});

test("cost estimator uses model-aware token and hosted-search pricing", () => {
  assert.equal(estimateOpenAICostEur({
    model: "gpt-5.4-mini-2026-03-17",
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    webSearchCalls: 2,
    usdToEurRate: 1,
  }), 5.27);
  assert.equal(estimateOpenAICostEur({
    model: "gpt-6-sol",
    inputTokens: 26_989,
    outputTokens: 782,
    webSearchCalls: 15,
    usdToEurRate: 1,
  }), 0.211798);
});

test("cost estimator discounts only provider-reported cached input", () => {
  assert.equal(cachedInputTokensFromUsage([
    { cached_tokens: 300_000 },
    { cachedTokens: 200_000 },
  ]), 500_000);
  assert.equal(estimateOpenAICostEur({
    model: "gpt-6-sol",
    inputTokens: 1_000_000,
    cachedInputTokens: 500_000,
    outputTokens: 0,
    webSearchCalls: 0,
    usdToEurRate: 1,
  }), 1.1);
});

test("cost estimator rejects unreviewed models and invalid currency conversion", () => {
  assert.throws(() => resolveOpenAIModelPricing("custom-unpriced-model"), /No OpenAI pricing is configured/);
  assert.equal(resolveUsdToEurRate("0.9"), 0.9);
  assert.throws(() => resolveUsdToEurRate("0"), /OPENAI_USD_TO_EUR/);
});
