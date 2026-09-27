import assert from "node:assert/strict";
import { evaluateConversationReadiness, readinessApplicability, readinessMetrics, historicalReadinessInput, historicalReadinessCoverage, type ConversationReadinessInput, type ReadinessView } from "../lib/readiness";
import { buildReadinessSnapshot } from "../lib/readiness-snapshot";

const ref = "https://example.org/project";
const evidence = { confidence: 0.8, evidenceRefs: [ref], rationale: "Supported by project evidence." };
const fixture = (): ConversationReadinessInput => ({
  softwareNeed: { status: "concrete", ...evidence }, capability: { status: "transferable", ...evidence },
  buyingIntent: { status: "unknown", confidence: 0, evidenceRefs: [], rationale: "No selection notice." },
  commercial: { status: "funding_proxy", scopeBasis: "capacity_proxy", addressableValueEur: null, supportsMinimum: true, ...evidence },
  timing: { status: "future_planning", validUntil: "2027-01-01", ...evidence },
  contact: { status: "legitimate_route", ...evidence }, safeguards: { status: "clear", ...evidence },
  questions: ["Is external development support being considered?"],
});
const context = { allowedEvidenceRefs: [ref], minimumBudgetEur: 30_000, evaluatedAt: "2026-09-27T00:00:00Z" };
const evaluate = (input: unknown) => evaluateConversationReadiness(input, context);
assert.equal(evaluate(fixture()).status, "conversation_ready");
for (const status of ["organization_size_only", "insufficient", "unknown"] as const) {
  const input = fixture(); input.commercial.status = status;
  assert.equal(evaluate(input).status, "monitor");
}
for (const status of ["assigned_or_internal", "no_new_software"] as const) {
  const input = fixture(); input.buyingIntent = { status, ...evidence };
  assert.equal(evaluate(input).status, "not_suitable");
}
const active = fixture(); active.timing.status = "active";
assert.equal(evaluate(active).status, "monitor");
active.buyingIntent = { status: "external_demand", ...evidence };
assert.equal(evaluate(active).status, "conversation_ready");
const low = fixture(); low.commercial = { status: "confirmed_scope", scopeBasis: "dedicated_package", addressableValueEur: 29_999, supportsMinimum: true, ...evidence };
assert.equal(evaluate(low).status, "not_suitable");
low.commercial.addressableValueEur = 30_000;
assert.equal(evaluate(low).status, "conversation_ready");
low.commercial.scopeBasis = "whole_programme"; low.commercial.addressableValueEur = 7_000_000;
assert.equal(evaluate(low).status, "monitor");
for (const status of ["sensitive", "conflict", "unknown"] as const) {
  const input = fixture(); input.safeguards.status = status;
  assert.equal(evaluate(input).status, "monitor");
}
const excluded = fixture(); excluded.safeguards.status = "hard_exclusion";
assert.equal(evaluate(excluded).status, "not_suitable");
const unsupported = fixture(); unsupported.capability.status = "unsupported_mandatory";
assert.equal(evaluate(unsupported).status, "not_suitable");
const expired = fixture(); expired.timing.validUntil = "2026-01-01";
assert.equal(evaluate(expired).status, "not_suitable");
expired.timing.validUntil = "2026-02-30";
assert.equal(evaluate(expired).status, "not_evaluated");
const uncited = fixture(); uncited.contact = { ...uncited.contact, evidenceRefs: ["https://invented.invalid"] };
assert.equal(evaluate(uncited).status, "not_evaluated");
uncited.contact.evidenceRefs = []; assert.equal(evaluate(uncited).status, "not_evaluated");
assert.equal(evaluate(null).status, "not_evaluated");
assert.equal(historicalReadinessInput({ commercialFit: {}, rationale: "Seems ideal" }), null);
const legacy = historicalReadinessCoverage({ qualificationEvidence: { capability: { status: "unsupported", confidence: .9, evidenceRefs: [ref], explanation: "No named platform experience" } } }, [{ field: "buying_intent", value: "Definitely a buyer" }]);
assert.deepEqual(legacy.mapped, {});
assert.ok(legacy.missingFields.includes("buyingIntent"));
assert.equal(legacy.unmappedFindingCount, 1);
const snapshot = buildReadinessSnapshot(fixture(), context);
assert.equal(snapshot.fingerprint, buildReadinessSnapshot(fixture(), context).fingerprint);
const view: ReadinessView = { id: "e", assessmentId: "a", createdAt: context.evaluatedAt, input: fixture(), result: snapshot.result, labels: [] };
assert.equal(readinessApplicability(view, "b", new Date(context.evaluatedAt)), "superseded");
assert.equal(readinessApplicability(view, "a", new Date("2027-03-01")), "expired");
assert.equal(readinessApplicability({ ...view, createdAt: "2027-03-01T00:00:00Z", evidenceAt: context.evaluatedAt }, "a", new Date("2027-03-01")), "expired");
assert.deepEqual(readinessMetrics([{ evaluation: view, current: true, qualified: false }]), { evaluated: 1, labels: 0, comparable: 0, disagreements: 0, falseNegativeCandidates: 0 });
view.labels = [{ id: "1", reviewerId: "u", label: "pass", reason: "other", notes: "not a buyer", createdAt: "2026-09-27T01:00:00Z" }, { id: "2", reviewerId: "u", label: "worth_contacting", reason: "concrete_need", notes: null, createdAt: "2026-09-27T02:00:00Z" }];
assert.equal(readinessMetrics([{ evaluation: view, current: true, qualified: false }]).labels, 1);
assert.equal(readinessMetrics([{ evaluation: view, current: true, qualified: false }]).falseNegativeCandidates, 1);
// Evaluation is referentially transparent and cannot change the core input.
const input = fixture(); const before = JSON.stringify(input); evaluate(input); assert.equal(JSON.stringify(input), before);
