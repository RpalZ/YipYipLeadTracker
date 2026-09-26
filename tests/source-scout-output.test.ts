import assert from "node:assert/strict";
import test from "node:test";

import type { SourceScoutWireOutput } from "../lib/automation/contracts";
import { normalizeSourceScoutOutput } from "../lib/automation/source-scout-output";

const validProposal: SourceScoutWireOutput["proposals"][number] = {
  name: "TenderNed",
  sourceFamily: "public procurement",
  jurisdiction: "Netherlands",
  baseUrl: "https://www.tenderned.nl/",
  classification: "primary",
  publicAccess: true,
  observedUpdateFrequency: "daily",
  signalAreas: ["pitching", "announcements"],
  coverageGap: "pitching",
  noveltyReason: "Adds official procurement coverage beyond the existing newsroom sources.",
  coverageRationale: "Official public procurement notices can expose current digital delivery opportunities.",
  sampleEvidence: [{
    title: "ICT services notice",
    url: "https://www.tenderned.nl/aankondigingen/voorbeeld",
    relevance: "Shows that public digital-service notices are published on this source.",
  }],
  policyChecks: {
    permittedMethod: "public_web_search",
    robotsConcern: false,
    termsConcern: false,
    personalDataRisk: "low",
    note: "Use public search results and retain only short evidence excerpts.",
  },
  confidence: 0.91,
  estimatedMonthlyCostEur: 4,
};

test("Source Scout normalizes safe length excesses without losing the proposal", () => {
  const result = normalizeSourceScoutOutput({
    searchQueries: [`digital agency ${"x".repeat(400)}`],
    proposals: [{ ...validProposal, coverageRationale: "r".repeat(400) }],
  });

  assert.ok(result.output);
  assert.equal(result.output.proposals.length, 1);
  assert.equal(result.output.proposals[0].coverageRationale.length, 300);
  assert.equal(result.output.searchQueries[0].length, 300);
  assert.equal(result.issues.some((issue) => issue.code === "text_truncated"), true);
});

test("Source Scout accepts five bounded proposals and rejects overflow independently", () => {
  const proposals = Array.from({ length: 6 }, (_, index) => ({
    ...validProposal,
    name: `Source ${index + 1}`,
    baseUrl: `https://source-${index + 1}.example/`,
    sampleEvidence: [{
      ...validProposal.sampleEvidence[0],
      url: `https://source-${index + 1}.example/evidence`,
    }],
  }));
  const result = normalizeSourceScoutOutput({ searchQueries: ["coverage gaps"], proposals });

  assert.ok(result.output);
  assert.equal(result.output.proposals.length, 5);
  assert.equal(result.rejectedCount, 1);
  assert.equal(result.issues.some((issue) => issue.code === "too_many_items"), true);
});

test("Source Scout rejects one invalid proposal without discarding a valid sibling", () => {
  const result = normalizeSourceScoutOutput({
    searchQueries: ["Dutch digital public procurement sources"],
    proposals: [
      { ...validProposal, name: "Invalid confidence", confidence: 1.4 },
      validProposal,
    ],
  });

  assert.ok(result.output);
  assert.equal(result.output.proposals.length, 1);
  assert.equal(result.output.proposals[0].name, "TenderNed");
  assert.equal(result.rejectedCount, 1);
  assert.equal(result.issues.some((issue) => issue.path === "proposals.0.confidence"), true);
});

test("Source Scout does not misreport generated but wholly invalid proposals as a zero-result run", () => {
  const result = normalizeSourceScoutOutput({
    searchQueries: ["Dutch source families"],
    proposals: [{ ...validProposal, sampleEvidence: [], confidence: 2 }],
  });

  assert.equal(result.output, null);
  assert.equal(result.generatedCount, 1);
  assert.equal(result.rejectedCount, 1);
});

test("observed provider queries satisfy audit telemetry when the final output omits them", () => {
  const result = normalizeSourceScoutOutput(
    { searchQueries: [], proposals: [] },
    ["site:overheid.nl digitalisering aanbesteding"],
  );

  assert.deepEqual(result.output, {
    searchQueries: ["site:overheid.nl digitalisering aanbesteding"],
    proposals: [],
  });
});
