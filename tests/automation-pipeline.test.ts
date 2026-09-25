import assert from "node:assert/strict";
import test from "node:test";

import { dimensionNames } from "../lib/domain";
import type { AutomatedAssessmentOutput } from "../lib/automation/contracts";
import { ACTIONABLE_CONTACT_ROUTE_FIELD, ensureRequiredResearchQuestions, evaluateCostLimit, prioritizeGaps, resolveActionableContactRoute, retryDelaySeconds, routeAssessment, sourceScoutCompletion, validateResearchPass, validateSourceProposalEvidence } from "../lib/automation/pipeline";

const supportedContact = {
  supported: true,
  label: "Procurement desk",
  status: "confirmed" as const,
  confidence: 0.86,
  sourceUrls: ["https://example.nl/contact"],
};

const assessment = (score: number, confidence = 0.82): AutomatedAssessmentOutput => ({
  dimensions: dimensionNames.map((name) => ({ name, score, confidence, explanation: "Supported by the evidence snapshot.", evidenceRefs: ["signal-1"] })),
  commercialFit: {
    budgetEvidenceStatus: "confirmed",
    totalProjectValueEur: 75_000,
    addressableScopeValueEur: 75_000,
    addressableScopeStatus: "bounded",
    confidence: 0.82,
    evidenceRefs: ["signal-1"],
    explanation: "The evidence supports a €75k addressable package.",
  },
  hardExclusion: null,
  deliveryRoute: "direct",
  whyNow: "The organization is defining the programme before supplier selection.",
  suggestedNextAction: "Approach the programme owner with a relevant case study.",
  risks: [],
});

test("automatic routing qualifies strong final assessments", () => {
  const result = routeAssessment(assessment(8.4), "final", false, undefined, supportedContact);
  assert.equal(result.lifecycleStatus, "qualified");
  assert.equal(result.score.score, 84);
});

test("initial assessments route decision-relevant gaps to research", () => {
  const result = routeAssessment(assessment(8.4), "initial", true);
  assert.equal(result.lifecycleStatus, "needs_research");
  assert.equal(result.nextStage, "gap_analysis");
});

test("low confidence and partner routes become human exceptions", () => {
  const lowConfidence = assessment(9, 0.4);
  lowConfidence.dimensions = lowConfidence.dimensions.map((dimension) =>
    dimension.name === "Budget fit" || dimension.name === "Delivery fit"
      ? { ...dimension, confidence: 0.82 }
      : dimension,
  );
  assert.equal(routeAssessment(lowConfidence, "final", false, undefined, supportedContact).exceptionKind, "low_confidence");
  assert.equal(routeAssessment({ ...assessment(8.4), deliveryRoute: "partner" }, "final", false, undefined, supportedContact).exceptionKind, "partner_required");
});

test("unknown commercial fit cannot be washed out by strong technical dimensions", () => {
  const result = routeAssessment({
    ...assessment(9),
    commercialFit: {
      budgetEvidenceStatus: "unknown",
      totalProjectValueEur: null,
      addressableScopeValueEur: null,
      addressableScopeStatus: "unknown",
      confidence: 0.3,
      evidenceRefs: [],
      explanation: "No supported budget was found.",
    },
  }, "final", false, undefined, supportedContact);
  assert.equal(result.lifecycleStatus, "needs_review");
  assert.equal(result.exceptionKind, "commercial_fit_uncertain");
});

test("large total procurements need a bounded YipYip-addressable scope", () => {
  const result = routeAssessment({
    ...assessment(9),
    commercialFit: {
      budgetEvidenceStatus: "confirmed",
      totalProjectValueEur: 7_000_000,
      addressableScopeValueEur: null,
      addressableScopeStatus: "unknown",
      confidence: 0.9,
      evidenceRefs: ["signal-1"],
      explanation: "Only the total procurement value is known.",
    },
  }, "final", false, undefined, supportedContact);
  assert.equal(result.lifecycleStatus, "needs_review");
  assert.equal(result.exceptionKind, "unusual_budget");
});

test("a large programme may qualify when the YipYip-addressable package is supported", () => {
  const result = routeAssessment({
    ...assessment(8.4),
    commercialFit: {
      budgetEvidenceStatus: "confirmed",
      totalProjectValueEur: 7_000_000,
      addressableScopeValueEur: 75_000,
      addressableScopeStatus: "bounded",
      confidence: 0.86,
      evidenceRefs: ["signal-1"],
      explanation: "A cited lot identifies the addressable digital package.",
    },
  }, "final", false, undefined, supportedContact);
  assert.equal(result.lifecycleStatus, "qualified");
});

test("application policy always researches an inferred or missing contact route", () => {
  const questions = ensureRequiredResearchQuestions(
    { contactLabel: "Digital team", contactStatus: "inferred" },
    [{ field: "office", question: "Which office?", currentStatus: "missing", decisionImpact: "low", researchability: "high", stopRule: "One search." }],
  );
  assert.equal(questions.length, 1);
  assert.equal(questions[0].field, ACTIONABLE_CONTACT_ROUTE_FIELD);
  assert.equal(questions[0].decisionImpact, "high");
});

test("citation-backed contact routes qualify while bounded unknowns need attention", () => {
  const opportunity = { contactLabel: "Contact research pending", contactStatus: "unknown" as const };
  const supported = resolveActionableContactRoute(opportunity, [{
    field: ACTIONABLE_CONTACT_ROUTE_FIELD,
    status: "confirmed",
    value: "Team Inkoop via the official tender portal",
    explanation: "The tender page identifies the procurement channel.",
    confidence: 0.84,
    sourceUrls: ["https://example.nl/tender"],
  }]);
  assert.equal(supported.supported, true);
  assert.equal(supported.label, "Team Inkoop via the official tender portal");

  const unresolved = resolveActionableContactRoute(opportunity, [
    {
      field: ACTIONABLE_CONTACT_ROUTE_FIELD,
      status: "unknown",
      value: null,
      explanation: "The latest bounded pass found no public route.",
      confidence: 0,
      sourceUrls: [],
    },
    {
      field: ACTIONABLE_CONTACT_ROUTE_FIELD,
      status: "confirmed",
      value: "An older contact route",
      explanation: "Historical evidence.",
      confidence: 0.95,
      sourceUrls: ["https://example.nl/old-contact"],
    },
  ]);
  const result = routeAssessment(assessment(8.8), "final", false, undefined, unresolved);
  assert.equal(result.lifecycleStatus, "needs_review");
  assert.equal(result.exceptionKind, "contact_route_unresolved");
});

test("gap prioritization excludes low-value research and retry is bounded", () => {
  const gaps = prioritizeGaps([
    { field: "budget", question: "Is funding approved?", currentStatus: "missing", decisionImpact: "high", researchability: "high", stopRule: "Two primary-source searches." },
    { field: "office", question: "Which room?", currentStatus: "missing", decisionImpact: "low", researchability: "high", stopRule: "One search." },
  ]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].field, "budget");
  assert.equal(retryDelaySeconds(1), 60);
  assert.equal(retryDelaySeconds(4), null);
});

test("workflow cost stops include the response that crosses the estimate", () => {
  assert.deepEqual(evaluateCostLimit(0.42, 0.11, 0.5), { allowed: false, projected: 0.53, overrun: 0.03 });
  assert.equal(evaluateCostLimit(0.25, 0.25, 0.5).allowed, true);
});

test("research completion accepts terminal cited findings and preserves explicit unknowns", () => {
  const questions = [
    { field: "budget", question: "Is funding approved?", currentStatus: "missing" as const, decisionImpact: "high" as const, researchability: "high" as const, stopRule: "Two searches." },
    { field: "contact", question: "Who owns the programme?", currentStatus: "weak" as const, decisionImpact: "medium" as const, researchability: "high" as const, stopRule: "Two searches." },
  ];
  const result = validateResearchPass(questions, [
    { field: "budget", status: "confirmed", value: "€300k", explanation: "The budget note confirms it.", confidence: 0.9, sourceUrls: ["https://example.nl/budget?utm_source=test"] },
    { field: "contact", status: "unknown", value: null, explanation: "No accountable owner was named.", confidence: 0.2, sourceUrls: [] },
  ], ["https://www.example.nl/budget"]);
  assert.equal(result.acceptedFindings.length, 2);
  assert.equal(result.unresolvedQuestions.length, 0);
});

test("research completion rejects omitted, duplicate, and uncited answers for another bounded pass", () => {
  const questions = [
    { field: "budget", question: "Is funding approved?", currentStatus: "missing" as const, decisionImpact: "high" as const, researchability: "high" as const, stopRule: "Two searches." },
    { field: "timing", question: "When does work begin?", currentStatus: "weak" as const, decisionImpact: "high" as const, researchability: "high" as const, stopRule: "Two searches." },
  ];
  const result = validateResearchPass(questions, [
    { field: "budget", status: "confirmed", value: "€300k", explanation: "Claimed by an uncited page.", confidence: 0.8, sourceUrls: ["https://other.example/budget"] },
    { field: "budget", status: "unknown", value: null, explanation: "Conflicting output.", confidence: 0.1, sourceUrls: [] },
  ], ["https://example.nl/budget"]);
  assert.deepEqual(result.unresolvedQuestions.map((question) => question.field), ["budget", "timing"]);
  assert.equal(result.acceptedFindings.length, 0);
});

test("source proposals require sample evidence from consulted results on the proposed host", () => {
  const proposal = {
    name: "Example newsroom",
    sourceFamily: "newsroom",
    jurisdiction: "NL",
    baseUrl: "https://example.nl",
    classification: "primary" as const,
    publicAccess: true,
    observedUpdateFrequency: "weekly",
    signalAreas: ["announcements" as const],
    coverageRationale: "Publishes early programme announcements.",
    sampleEvidence: [{ title: "Digital programme", url: "https://example.nl/news/digital", relevance: "Shows relevant work." }],
    policyChecks: { permittedMethod: "public_web_search" as const, robotsConcern: false, termsConcern: false, personalDataRisk: "low" as const, note: "Public pages." },
    confidence: 0.82,
    estimatedMonthlyCostEur: 0.2,
  };
  assert.equal(validateSourceProposalEvidence(proposal, ["https://www.example.nl/news/digital"]), true);
  assert.equal(validateSourceProposalEvidence(proposal, ["https://unrelated.example/news/digital"]), false);
  assert.equal(validateSourceProposalEvidence({ ...proposal, baseUrl: "not a URL" }, ["https://example.nl/news/digital"]), false);
});

test("source scout waits for approval only when reviewable proposals exist", () => {
  assert.deepEqual(sourceScoutCompletion(2), {
    terminalStatus: "waiting_approval",
    outcome: "waiting_approval",
  });
  assert.deepEqual(sourceScoutCompletion(0), {
    terminalStatus: "succeeded",
    outcome: "no_reviewable_proposals",
  });
});
