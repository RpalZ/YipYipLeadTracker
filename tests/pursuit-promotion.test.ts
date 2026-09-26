import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialDemoWorkflowState,
  demoQualifiedOpportunities,
  reduceDemoWorkflow,
} from "../lib/demo-workflow";
import { successfulPromotionResultKey } from "../lib/pursuit-promotion-action-state";

test("manual demo promotion preserves automated routing and creates an attributed pursuit Lead", () => {
  const target = demoQualifiedOpportunities.find((opportunity) => opportunity.id === "demo-auto-brabant");
  assert.ok(target);
  assert.equal(target.lifecycleStatus, "needs_review");
  assert.equal(target.lead, undefined);

  const state = {
    ...createInitialDemoWorkflowState(),
    phase: "completed" as const,
    opportunities: demoQualifiedOpportunities,
  };
  const promotedAt = "2026-09-26T08:00:00.000Z";
  const next = reduceDemoWorkflow(state, {
    type: "promote_opportunity",
    opportunityId: target.id,
    reasonCode: "seasonal_capacity",
    notes: "Promote for a quiet delivery week.",
    route: "direct",
    language: "en",
    promotedAt,
  });
  const promoted = next.opportunities.find((opportunity) => opportunity.id === target.id);

  assert.ok(promoted?.lead);
  assert.equal(promoted.lifecycleStatus, "needs_review");
  assert.equal(promoted.lead.origin, "manual_promotion");
  assert.equal(promoted.lead.promotedAt, promotedAt);
  assert.equal(promoted.lead.promotionReason, "seasonal_capacity");
  assert.equal(promoted.lead.outreachDraft?.language, "en");
  assert.match(promoted.lead.outreachDraft?.caveats[0] ?? "", /manually promoted/i);
  assert.equal(promoted.reviewHistory?.[0]?.decision, "manual_promote");
});

test("manual demo promotion is a no-op after a Lead already exists", () => {
  const opportunity = demoQualifiedOpportunities[0];
  assert.ok(opportunity.lead);
  const state = {
    ...createInitialDemoWorkflowState(),
    phase: "completed" as const,
    opportunities: demoQualifiedOpportunities,
  };

  const next = reduceDemoWorkflow(state, {
    type: "promote_opportunity",
    opportunityId: opportunity.id,
    reasonCode: "strategic_interest",
    route: "direct",
    language: "nl",
    promotedAt: "2026-09-26T08:00:00.000Z",
  });

  assert.equal(next, state);
});

test("successful promotion result keys only acknowledge persisted requests", () => {
  assert.equal(successfulPromotionResultKey({ ok: false, message: "No" }), null);
  assert.equal(successfulPromotionResultKey({ ok: true, message: "Saved" }), null);
  assert.equal(successfulPromotionResultKey({ ok: true, message: "Saved", requestId: "request-1" }), "request-1");
});
