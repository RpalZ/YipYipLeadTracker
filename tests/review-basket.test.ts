import assert from "node:assert/strict";
import test from "node:test";

import {
  parseReviewBasket,
  reconcileReviewBasket,
  reviewBasketStorageKey,
  toggleReviewBasketItem,
} from "../lib/review-basket";

test("review basket parsing rejects malformed values and removes duplicates", () => {
  assert.deepEqual(parseReviewBasket(null), []);
  assert.deepEqual(parseReviewBasket("not-json"), []);
  assert.deepEqual(parseReviewBasket(JSON.stringify(["lead-1", "lead-1", 7, ""])), ["lead-1"]);
});

test("review basket toggles saved leads and scopes session keys", () => {
  assert.deepEqual(toggleReviewBasketItem([], "lead-1"), ["lead-1"]);
  assert.deepEqual(toggleReviewBasketItem(["lead-1", "lead-2"], "lead-1"), ["lead-2"]);
  assert.equal(reviewBasketStorageKey("demo:empty"), "yipyip.review-basket.v1:demo:empty");
});

test("review basket removes IDs that are no longer available", () => {
  assert.deepEqual(
    reconcileReviewBasket(["lead-1", "removed-lead", "lead-2"], ["lead-2", "lead-1"]),
    ["lead-1", "lead-2"],
  );
  assert.deepEqual(reconcileReviewBasket(["stale-lead"], []), []);
});
