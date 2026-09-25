import assert from "node:assert/strict";
import test from "node:test";

import { createDemoDashboardData, resolveDemoMode } from "../lib/demo-mode";

test("resolves supported demo modes and ignores invalid values", () => {
  assert.equal(resolveDemoMode("empty"), "empty");
  assert.equal(resolveDemoMode("sample"), "sample");
  assert.equal(resolveDemoMode(["empty", "sample"]), "empty");
  assert.equal(resolveDemoMode("unknown"), null);
  assert.equal(resolveDemoMode(undefined), null);
});

test("creates an empty demo without static opportunities", () => {
  const data = createDemoDashboardData("empty", "2026-09-24T00:00:00.000Z");

  assert.equal(data.mode, "demo");
  assert.equal(data.demoMode, "empty");
  assert.deepEqual(data.opportunities, []);
  assert.match(data.notice ?? "", /Empty demo workspace/);
});

test("keeps representative fixtures available as an explicit sample demo", () => {
  const data = createDemoDashboardData("sample", "2026-09-24T00:00:00.000Z");

  assert.equal(data.demoMode, "sample");
  assert.ok(data.opportunities.length > 0);
});
