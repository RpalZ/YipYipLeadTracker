import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialDemoWorkflowState,
  demoQualifiedOpportunities,
  getDemoWorkflowStatus,
  parseDemoWorkflowState,
  reduceDemoWorkflow,
} from "../lib/demo-workflow";

test("the autonomous demo starts with an empty browser-local workspace", () => {
  const state = createInitialDemoWorkflowState();
  assert.equal(getDemoWorkflowStatus(state), "empty");
  assert.equal(state.strategySaved, false);
  assert.equal(state.automationEnabled, false);
  assert.deepEqual(state.sourceCandidates, []);
  assert.deepEqual(state.opportunities, []);
});

test("saving the strategy automatically queues Source Scout", () => {
  const state = reduceDemoWorkflow(createInitialDemoWorkflowState(), { type: "save_strategy" });
  const scouted = reduceDemoWorkflow(state, { type: "complete_source_scout" });
  assert.equal(getDemoWorkflowStatus(state), "scouting");
  assert.equal(getDemoWorkflowStatus(scouted), "awaiting_approval");
  assert.equal(scouted.sourceCandidates.length, 3);
  assert.ok(scouted.sourceCandidates.every((source) => source.status === "proposed"));
});

test("source approval is the only routine gate before autonomous qualification", () => {
  const saved = reduceDemoWorkflow(createInitialDemoWorkflowState(), { type: "save_strategy" });
  const scouted = reduceDemoWorkflow(saved, { type: "complete_source_scout" });
  const approved = reduceDemoWorkflow(scouted, { type: "review_source", sourceId: scouted.sourceCandidates[0].id, decision: "approved" });
  const completed = reduceDemoWorkflow(approved, { type: "complete_automation", cycleId: "cycle-1", completedAt: "2026-09-24T10:00:00.000Z" });
  assert.equal(getDemoWorkflowStatus(approved), "automating");
  assert.equal(getDemoWorkflowStatus(completed), "completed");
  assert.equal(completed.opportunities.length, demoQualifiedOpportunities.length);
  assert.equal(completed.opportunities.filter((item) => item.lifecycleStatus === "qualified").length, 2);
  assert.equal(completed.opportunities.filter((item) => item.lifecycleStatus === "needs_review").length, 1);
  assert.ok(completed.opportunities.every((item) => item.score !== null && item.confidence !== null));
  assert.equal(completed.cycles[0].assessmentsCompleted, 6);
});

test("repeat monitoring demonstrates exact matching without duplicate opportunities", () => {
  const saved = reduceDemoWorkflow(createInitialDemoWorkflowState(), { type: "save_strategy" });
  const scouted = reduceDemoWorkflow(saved, { type: "complete_source_scout" });
  const approved = reduceDemoWorkflow(scouted, { type: "review_source", sourceId: scouted.sourceCandidates[0].id, decision: "approved" });
  const completed = reduceDemoWorkflow(approved, { type: "complete_automation", cycleId: "cycle-1", completedAt: "2026-09-24T10:00:00.000Z" });
  const repeated = reduceDemoWorkflow(completed, { type: "complete_repeat_cycle", cycleId: "cycle-2", completedAt: "2026-09-25T05:00:00.000Z" });
  assert.equal(repeated.opportunities.length, demoQualifiedOpportunities.length);
  assert.equal(repeated.cycles[0].opportunitiesCreated, 0);
  assert.equal(repeated.cycles[0].opportunitiesMatched, demoQualifiedOpportunities.length);
  assert.equal(repeated.cycles[0].assessmentsCompleted, 0);
});

test("invalid or stale stored demo state safely resets", () => {
  assert.deepEqual(parseDemoWorkflowState("not-json"), createInitialDemoWorkflowState());
  assert.deepEqual(parseDemoWorkflowState(JSON.stringify({ version: 1 })), createInitialDemoWorkflowState());
});
