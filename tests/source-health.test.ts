import assert from "node:assert/strict";
import test from "node:test";

import type { DiscoveryRunHealthInput } from "../lib/discovery/contracts";
import { evaluateDiscoveryHealth } from "../lib/discovery/health";

const success = (acceptedCount = 0, candidateCount = 0): DiscoveryRunHealthInput => ({
  status: "succeeded",
  stopReason: "completed",
  acceptedCount,
  candidateCount,
});
const failure = (authenticationOrAccessFailure = false): DiscoveryRunHealthInput => ({
  status: "failed",
  stopReason: "error",
  acceptedCount: 0,
  candidateCount: 0,
  authenticationOrAccessFailure,
});

test("disabled jobs are paused and a valid zero-result run is healthy", () => {
  assert.equal(evaluateDiscoveryHealth({ enabled: false, currentHealth: "healthy", recentRuns: [] }).health, "paused");
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "paused", recentRuns: [success()] }).health, "healthy");
});

test("partial, low acceptance, and two recent failures are degraded", () => {
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "healthy", recentRuns: [{ ...success(2, 2), status: "partial" }] }).health, "degraded");
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "healthy", recentRuns: [success(3, 5)] }).health, "degraded");
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "healthy", recentRuns: [success(), failure(), failure(), success(), success()] }).health, "degraded");
});

test("auth failures or four consecutive failures are failing", () => {
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "healthy", recentRuns: [failure(true)] }).health, "failing");
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "degraded", recentRuns: [failure(), failure(), failure(), failure()] }).health, "failing");
});

test("failing requires three consecutive successes before healthy recovery", () => {
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "failing", recentRuns: [success(), success(), failure()] }).health, "degraded");
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "failing", recentRuns: [success(), success(), success(), failure(), success()] }).health, "healthy");
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "failing", recentRuns: [success(3, 5), success(), success()] }).health, "degraded");
});

test("exactly twenty percent recent failures is degraded", () => {
  assert.equal(evaluateDiscoveryHealth({ enabled: true, currentHealth: "healthy", recentRuns: [success(), success(), success(), success(), failure()] }).health, "degraded");
});
