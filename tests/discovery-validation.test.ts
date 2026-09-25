import assert from "node:assert/strict";
import test from "node:test";

import type { DiscoveryAgentOutput } from "../lib/discovery/contracts";
import { estimateDiscoveryCostEur } from "../lib/discovery/cost";
import {
  DEFAULT_DUTCH_AGENCY_PROFILE,
  buildOpportunityKey,
  canonicalizeHttpsUrl,
  collectWebSearchEvidenceUrls,
  countWebSearchCalls,
  validateDiscoveryOutput,
} from "../lib/discovery/validation";

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

test("accepts a cited, recent, concrete candidate and creates deterministic keys", () => {
  const output = { searchQueries: ["Dutch digital agency pitch"], candidates: [candidate] };
  const [result] = validateDiscoveryOutput({
    output,
    consultedUrls: ["https://example.nl/news/item?utm_medium=email"],
    profile: DEFAULT_DUTCH_AGENCY_PROFILE,
    now: new Date("2026-09-23T00:00:00Z"),
  });
  assert.equal(result.accepted, true);
  assert.equal(result.rejectionReasons.length, 0);
  assert.equal(result.opportunityKey, buildOpportunityKey(candidate.organization, candidate.title));
});

test("rejects uncited, stale, low-confidence, and restricted candidates", () => {
  const stale = { ...candidate, canonicalSourceUrl: "https://linkedin.com/posts/1", publicationDate: "2025-01-01", confidence: 0.4 };
  const [result] = validateDiscoveryOutput({
    output: { searchQueries: ["query"], candidates: [stale] },
    consultedUrls: ["https://example.nl/other"],
    profile: DEFAULT_DUTCH_AGENCY_PROFILE,
    now: new Date("2026-09-23T00:00:00Z"),
  });
  assert.deepEqual(result.rejectionReasons.sort(), ["low_confidence", "outside_lookback", "restricted_source", "uncited_url"].sort());
});

test("allows explicitly undated evidence and audits duplicate candidates", () => {
  const undated = { ...candidate, publicationDate: null };
  const results = validateDiscoveryOutput({
    output: { searchQueries: ["query"], candidates: [undated, undated] },
    consultedUrls: [candidate.canonicalSourceUrl],
    profile: DEFAULT_DUTCH_AGENCY_PROFILE,
  });
  assert.equal(results[0].accepted, true);
  assert.deepEqual(results[1].rejectionReasons, ["duplicate_candidate"]);
});

test("cost estimator includes token and hosted-search usage", () => {
  assert.equal(estimateDiscoveryCostEur({ inputTokens: 1_000_000, outputTokens: 1_000_000, webSearchCalls: 2 }), 5.27);
});
