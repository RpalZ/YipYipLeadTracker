import assert from "node:assert/strict";
import test from "node:test";

import {
  removeReviewedItem,
  successfulReviewResultKey,
} from "../lib/lead-review-action-state";
import {
  activeQualificationOpportunityIds,
  successfulAttentionResultKey,
} from "../lib/opportunity-attention-action-state";

test("a successful review response has one stable consumption key", () => {
  const state = {
    ok: true,
    message: "Lead approved for pursuit.",
    action: "pursue",
    leadId: "lead-1",
    requestId: "request-1",
  };

  assert.equal(successfulReviewResultKey(state), "lead-1:pursue:request-1");
  assert.equal(successfulReviewResultKey({ ...state }), "lead-1:pursue:request-1");
  assert.equal(successfulReviewResultKey({ ...state, ok: false }), null);
  assert.equal(successfulReviewResultKey({ ...state, requestId: undefined }), null);
});

test("removing a reviewed item is referentially stable after the first removal", () => {
  const queue = ["lead-1", "lead-2"];
  const remaining = removeReviewedItem(queue, "lead-1");

  assert.deepEqual(remaining, ["lead-2"]);
  assert.notStrictEqual(remaining, queue);
  assert.strictEqual(removeReviewedItem(remaining, "lead-1"), remaining);
});

test("a successful Opportunity resolution has one stable consumption key", () => {
  const state = {
    ok: true,
    message: "Research queued.",
    action: "request_research" as const,
    opportunityId: "opportunity-1",
    requestId: "request-1",
  };

  assert.equal(successfulAttentionResultKey(state), "opportunity-1:request_research:request-1");
  assert.equal(successfulAttentionResultKey({ ...state, ok: false }), null);
  assert.equal(successfulAttentionResultKey({ ...state, requestId: undefined }), null);
});

test("automatic and requested qualification workflows both show research progress", () => {
  const active = activeQualificationOpportunityIds([
    { opportunity_id: "automatic", kind: "opportunity_qualification", status: "running" },
    { opportunity_id: "requested", kind: "opportunity_qualification", status: "queued" },
    { opportunity_id: "failed", kind: "opportunity_qualification", status: "failed" },
    { opportunity_id: "monitor", kind: "source_monitor", status: "running" },
    { opportunity_id: null, kind: "opportunity_qualification", status: "running" },
  ]);

  assert.deepEqual([...active], ["automatic", "requested"]);
});
