import assert from "node:assert/strict";
import test from "node:test";

import { summarizeDiscoveryActivity } from "../lib/automation/activity-diagnostics";

test("a successful zero-result monitor is visible and explained", () => {
  const summary = summarizeDiscoveryActivity([{
    stage: "source_monitor",
    status: "succeeded",
    output_snapshot: { output: { candidates: [] } },
    usage: { webSearchCallCount: 4, consultedUrls: ["https://one.example", "https://two.example"] },
  }]);

  assert.equal(summary.generatedCandidates, 0);
  assert.equal(summary.searchCalls, 4);
  assert.equal(summary.consultedUrls, 2);
  assert.match(summary.zeroResultReason ?? "", /searched successfully/i);
});

test("diagnostics expose normalization rejections and resolved opportunities", () => {
  const summary = summarizeDiscoveryActivity([
    {
      stage: "source_monitor",
      status: "succeeded",
      output_snapshot: {
        candidateCount: 2,
        zeroResultReason: null,
        output: { candidates: [{ title: "One" }, { title: "Two" }] },
      },
      usage: { webSearchCallCount: 3, consultedUrls: ["https://one.example"] },
    },
    {
      stage: "normalize",
      status: "succeeded",
      output_snapshot: {
        acceptedCount: 1,
        rejectedCount: 1,
        rejectionCounts: { uncited_url: 1 },
        results: [{ accepted: true }, { accepted: false }],
      },
      usage: {},
    },
    {
      stage: "resolve",
      status: "succeeded",
      output_snapshot: { opportunityCount: 1, programmeSignalCount: 0 },
      usage: {},
    },
  ]);

  assert.deepEqual(summary, {
    generatedCandidates: 2,
    acceptedCandidates: 1,
    rejectedCandidates: 1,
    programmeSignals: 0,
    opportunitiesCreatedOrMatched: 1,
    searchCalls: 3,
    consultedUrls: 1,
    rejectionCounts: { uncited_url: 1 },
    zeroResultReason: null,
  });
});
