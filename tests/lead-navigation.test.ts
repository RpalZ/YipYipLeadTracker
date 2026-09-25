import assert from "node:assert/strict";
import test from "node:test";

import { buildLeadHref, resolveLeadId } from "../lib/lead-navigation";

test("adds a lead while preserving existing query parameters", () => {
  assert.equal(
    buildLeadHref("/", "filter=strong_fit", "lead-2"),
    "/?filter=strong_fit&lead=lead-2",
  );
});

test("removes a lead without discarding unrelated query parameters", () => {
  assert.equal(
    buildLeadHref("/", "filter=strong_fit&lead=lead-2", null),
    "/?filter=strong_fit",
  );
  assert.equal(buildLeadHref("/", "lead=lead-2", null), "/");
});

test("resolves only lead identifiers present in the dashboard data", () => {
  const ids = ["lead-1", "lead-2"];
  assert.equal(resolveLeadId("lead-2", ids), "lead-2");
  assert.equal(resolveLeadId("missing", ids), null);
  assert.equal(resolveLeadId(null, ids), null);
});
