import assert from "node:assert/strict";
import test from "node:test";

import {
  removeReviewedItem,
  successfulReviewResultKey,
} from "../lib/lead-review-action-state";

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
