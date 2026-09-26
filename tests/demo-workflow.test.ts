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
  assert.deepEqual(scouted.sourceCandidates.map((source) => source.coverageGap), ["pitching", "strategy", "hiring"]);
  assert.ok(scouted.sourceCandidates.every((source) => source.noveltyReason.length > 0));
  assert.ok(scouted.sourceCandidates.every((source) => source.publicAccess));
  assert.ok(scouted.sourceCandidates.every((source) => source.updateFrequency.length > 0));
  assert.ok(scouted.sourceCandidates.every((source) => source.sampleEvidence.length >= 2));
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

test("publishing a new demo strategy version preserves history and queues a fresh scout", () => {
  const completed = reduceDemoWorkflow({
    ...createInitialDemoWorkflowState(),
    phase: "completed",
    strategySaved: true,
    automationEnabled: true,
    sourceCandidates: [],
    opportunities: structuredClone(demoQualifiedOpportunities),
    cycles: [{
      id: "old-cycle",
      completedAt: "2026-09-24T10:00:00.000Z",
      acceptedSignals: 1,
      opportunitiesCreated: 1,
      opportunitiesMatched: 0,
      assessmentsCompleted: 2,
      researchFindings: 1,
      leadsQualified: 1,
      exceptionsCreated: 0,
      durationMs: 1_000,
    }],
  }, { type: "save_strategy" });

  assert.equal(completed.phase, "scouting");
  assert.equal(completed.strategySaved, true);
  assert.equal(completed.automationEnabled, true);
  assert.deepEqual(completed.sourceCandidates, []);
  assert.equal(completed.opportunities.length, demoQualifiedOpportunities.length);
  assert.equal(completed.cycles.length, 1);
  assert.equal(completed.activity[0].label, "Lead Strategy saved");
});

test("a Needs-attention Opportunity can request research without becoming a Lead", () => {
  const saved = reduceDemoWorkflow(createInitialDemoWorkflowState(), { type: "save_strategy" });
  const scouted = reduceDemoWorkflow(saved, { type: "complete_source_scout" });
  const approved = reduceDemoWorkflow(scouted, { type: "review_source", sourceId: scouted.sourceCandidates[0].id, decision: "approved" });
  const completed = reduceDemoWorkflow(approved, { type: "complete_automation", cycleId: "cycle-attention", completedAt: "2026-09-24T10:00:00.000Z" });
  const target = completed.opportunities.find((item) => item.lifecycleStatus === "needs_review");
  assert.ok(target?.attentionException);

  const resolved = reduceDemoWorkflow(completed, {
    type: "resolve_attention",
    opportunityId: target.id,
    action: "request_research",
    reasonCode: "budget",
    notes: "Resolve the addressable scope.",
    resolvedAt: "2026-09-24T11:00:00.000Z",
  });
  const next = resolved.opportunities.find((item) => item.id === target.id);
  assert.equal(next?.lifecycleStatus, "needs_research");
  assert.equal(next?.qualificationResearchPending, true);
  assert.equal(next?.attentionException, null);
  assert.equal(next?.lead, undefined);
  assert.equal(next?.reviewHistory?.[0].decision, "request_research");
});

test("passing a Needs-attention Opportunity records the decision without creating a Lead", () => {
  const completed = reduceDemoWorkflow({
    ...createInitialDemoWorkflowState(),
    phase: "completed",
    strategySaved: true,
    automationEnabled: true,
    opportunities: structuredClone(demoQualifiedOpportunities),
  }, {
    type: "resolve_attention",
    opportunityId: "demo-auto-brabant",
    action: "pass",
    reasonCode: "no_access",
    resolvedAt: "2026-09-24T12:00:00.000Z",
  });
  const next = completed.opportunities.find((item) => item.id === "demo-auto-brabant");
  assert.equal(next?.lifecycleStatus, "rejected");
  assert.equal(next?.attentionException, null);
  assert.equal(next?.reviewHistory?.[0].decision, "pass");
  assert.equal(next?.lead, undefined);
});

test("invalid or stale stored demo state safely resets", () => {
  assert.deepEqual(parseDemoWorkflowState("not-json"), createInitialDemoWorkflowState());
  assert.deepEqual(parseDemoWorkflowState(JSON.stringify({ version: 1 })), createInitialDemoWorkflowState());
});
