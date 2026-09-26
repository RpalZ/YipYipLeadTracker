import assert from "node:assert/strict";
import test from "node:test";

import { dimensionNames } from "../lib/domain";
import { budgetFitScore, calculateScore, capacityDimension, initialPolicy } from "../lib/scoring";

const dimensionsAt = (score: number, confidence = 0.8) =>
  dimensionNames.map((name) => ({ name, score, confidence }));

test("qualifies a strong, well-supported opportunity", () => {
  const result = calculateScore(dimensionsAt(8.2, 0.82));
  assert.equal(result.score, 82);
  assert.equal(result.confidence, 0.82);
  assert.equal(result.decision, "qualify");
});

test("routes a promising opportunity to research below the final threshold", () => {
  const result = calculateScore(dimensionsAt(7, 0.78));
  assert.equal(result.score, 70);
  assert.equal(result.decision, "research");
});

test("routes a high score with weak evidence to review", () => {
  const result = calculateScore(dimensionsAt(9, 0.5));
  assert.equal(result.score, 90);
  assert.equal(result.decision, "review");
});

test("hard exclusions override weighted scoring", () => {
  const result = calculateScore(dimensionsAt(10, 1), undefined, "Excluded sector");
  assert.equal(result.score, 0);
  assert.equal(result.decision, "reject");
  assert.equal(result.hardExclusion, "Excluded sector");
});

test("missing dimensions contribute zero rather than being silently reweighted", () => {
  const result = calculateScore([
    { name: "Social impact", score: 10, confidence: 1 },
  ]);
  assert.equal(result.score, 12);
  assert.equal(result.decision, "reject");
});

test("commercial budget curve honors the YipYip floor and preferred range", () => {
  assert.equal(budgetFitScore(29_999), 0);
  assert.equal(budgetFitScore(30_000), 6);
  assert.equal(budgetFitScore(50_000), 10);
  assert.equal(budgetFitScore(100_000), 10);
  assert.ok(budgetFitScore(150_000) >= 7);
  assert.equal(budgetFitScore(250_001), 6);
});

test("recalibrated weights total one", () => {
  const total = Object.values(initialPolicy.weights).reduce((sum, weight) => sum + weight, 0);
  assert.equal(Math.round(total * 100), 100);
});

test("capacity states and expiry are deterministic", () => {
  const now = new Date("2026-09-25T00:00:00Z");
  assert.deepEqual(capacityDimension("available", "2026-12-31", now), { score: 10, confidence: 1, unresolved: false, expired: false });
  assert.deepEqual(capacityDimension("limited", "2026-12-31", now), { score: 6, confidence: 1, unresolved: false, expired: false });
  assert.deepEqual(capacityDimension("unavailable", "2026-12-31", now), { score: 2, confidence: 1, unresolved: false, expired: false });
  assert.deepEqual(capacityDimension("unknown", null, now), { score: 5, confidence: 0, unresolved: true, expired: false });
  assert.deepEqual(capacityDimension("available", "2026-09-01", now), { score: 5, confidence: 0, unresolved: true, expired: true });
});
