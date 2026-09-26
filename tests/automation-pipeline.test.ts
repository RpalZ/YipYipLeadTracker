import assert from "node:assert/strict";
import test from "node:test";

import { dimensionNames } from "../lib/domain";
import type { AutomatedAssessmentOutput } from "../lib/automation/contracts";
import { ACTIONABLE_CONTACT_ROUTE_FIELD, ensureQualificationResearchQuestions, ensureRequiredResearchQuestions, evaluateCostLimit, prioritizeGaps, resolveActionableContactRoute, retryDelaySeconds, routeAssessment, selectResearchBundle, sourceScoutCompletion, validateQualificationEvidence, validateResearchPass, validateSourceProposalEvidence } from "../lib/automation/pipeline";

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
    scopeBasis: "dedicated_package",
    confidence: 0.82,
    evidenceRefs: ["signal-1"],
    explanation: "The evidence supports a €75k addressable package.",
  },
  qualificationEvidence: {
    sector: { categories: ["public services"], confidence: 0.85, evidenceRefs: ["signal-1"] },
    capability: { status: "supported", matchedServices: ["back-end systems"], unmatchedRequirements: [], confidence: 0.85, evidenceRefs: ["signal-1"], explanation: "The brief requires a custom back-end system." },
    actionability: { status: "current", actionableUntil: "2026-12-31", activeFollowOn: false, confidence: 0.85, evidenceRefs: ["signal-1"], explanation: "The response window remains open." },
  },
  hardExclusion: null,
  deliveryRoute: "direct",
  whyNow: "The organization is defining the programme before supplier selection.",
  suggestedNextAction: "Approach the programme owner with a relevant case study.",
  risks: [],
  outreachDraft: {
    language: "en",
    recommendedChannel: "email",
    emailSubject: "A relevant delivery conversation",
    emailBody: "We noticed the current programme and would welcome a brief conversation about the supported digital work package.",
    callOpening: "We noticed the current programme and would like to understand the digital delivery need.",
    discoveryQuestions: ["Which package is addressable?"],
    evidenceRefs: ["signal-1"],
    caveats: [],
  },
});

test("automatic routing qualifies strong final assessments", () => {
  const result = routeAssessment(assessment(8.4), "final", false, undefined, supportedContact);
  assert.equal(result.lifecycleStatus, "qualified");
  assert.equal(result.score.score, 86);
  assert.equal(result.qualificationChecks.allPassed, true);
});

test("a 66/100 final result cannot fall through to qualified", () => {
  const result = routeAssessment(assessment(6.2), "final", false, undefined, supportedContact);
  assert.equal(result.score.decision, "research");
  assert.equal(result.lifecycleStatus, "needs_review");
  assert.equal(result.exceptionKind, "borderline_score");
  assert.equal(result.qualificationChecks.allPassed, false);
});

test("the final review band keeps 72–76 in Needs attention while 77 may qualify", () => {
  const review = routeAssessment(assessment(7), "final", false, undefined, supportedContact);
  assert.equal(review.score.score, 73);
  assert.equal(review.lifecycleStatus, "needs_review");
  const qualified = routeAssessment(assessment(7.45), "final", false, undefined, supportedContact);
  assert.equal(qualified.score.score, 77);
  assert.equal(qualified.lifecycleStatus, "qualified");
});

test("the original-brief sector, capability, actionability, and capacity gates are deterministic", () => {
  const policyContext = {
    hardExcludedSectors: ["gambling", "video games", "retail/e-commerce", "heavy-polluting industry"],
    sensitiveSectors: ["pharma", "unresolved ethical concerns"],
    capacityStatus: "available" as const,
    capacityEffectiveUntil: "2026-12-31",
    now: new Date("2026-09-25T00:00:00Z"),
  };
  for (const category of policyContext.hardExcludedSectors) {
    const excluded = assessment(8.8);
    excluded.qualificationEvidence.sector = { categories: [category], confidence: 0.9, evidenceRefs: ["signal-1"] };
    assert.equal(routeAssessment(excluded, "final", false, undefined, supportedContact, policyContext).lifecycleStatus, "rejected");
  }

  for (const category of policyContext.sensitiveSectors) {
    const sensitive = assessment(8.8);
    sensitive.qualificationEvidence.sector = { categories: [category], confidence: 0.9, evidenceRefs: ["signal-1"] };
    assert.equal(routeAssessment(sensitive, "final", false, undefined, supportedContact, policyContext).exceptionKind, "sensitive_sector");
  }

  const unsupported = assessment(8.8);
  unsupported.qualificationEvidence.capability = { status: "unsupported", matchedServices: [], unmatchedRequirements: ["embedded hardware engineering"], confidence: 0.9, evidenceRefs: ["signal-1"], explanation: "The required capability is outside the strategy." };
  assert.equal(routeAssessment(unsupported, "final", false, undefined, supportedContact, policyContext).lifecycleStatus, "rejected");

  const expired = assessment(8.8);
  expired.qualificationEvidence.actionability = { status: "expired", actionableUntil: "2026-08-01", activeFollowOn: false, confidence: 0.9, evidenceRefs: ["signal-1"], explanation: "The deadline passed." };
  assert.equal(routeAssessment(expired, "final", false, undefined, supportedContact, policyContext).lifecycleStatus, "rejected");

  const noCapacity = routeAssessment(assessment(8.8), "final", false, undefined, supportedContact, { ...policyContext, capacityStatus: "unknown" });
  assert.equal(noCapacity.lifecycleStatus, "needs_review");
  assert.equal(noCapacity.qualificationChecks.checks.capacity, "unresolved");
  assert.equal(noCapacity.exceptionKind, "delivery_capacity_uncertain");
  assert.equal(noCapacity.qualificationChecks.checks.capability, "passed");
  assert.equal(noCapacity.qualificationChecks.capacityEvidence.status, "unknown");
});

test("either fit axis may pass, while confident failure rejects and uncertainty researches", () => {
  const socialFit = assessment(9.2);
  socialFit.dimensions = socialFit.dimensions.map((dimension) => dimension.name === "Technical fit" ? { ...dimension, score: 3, confidence: 0.9 } : dimension);
  assert.equal(routeAssessment(socialFit, "final", false, undefined, supportedContact).lifecycleStatus, "qualified");

  const noFit = assessment(8.2);
  noFit.dimensions = noFit.dimensions.map((dimension) => ["Social impact", "Technical fit"].includes(dimension.name) ? { ...dimension, score: 4, confidence: 0.9 } : dimension);
  assert.equal(routeAssessment(noFit, "final", false, undefined, supportedContact).lifecycleStatus, "rejected");

  const uncertain = assessment(8.2);
  uncertain.dimensions = uncertain.dimensions.map((dimension) => ["Social impact", "Technical fit"].includes(dimension.name) ? { ...dimension, score: 5, confidence: 0.4 } : dimension);
  assert.equal(routeAssessment(uncertain, "initial", false, undefined, supportedContact).lifecycleStatus, "needs_research");
});

test("upcoming work may qualify but unknown actionability and partial capability remain exceptions", () => {
  const upcoming = assessment(8.4);
  upcoming.qualificationEvidence.actionability = { ...upcoming.qualificationEvidence.actionability, status: "upcoming" };
  assert.equal(routeAssessment(upcoming, "final", false, undefined, supportedContact).lifecycleStatus, "qualified");

  const unknown = assessment(8.4);
  unknown.qualificationEvidence.actionability = { ...unknown.qualificationEvidence.actionability, status: "unknown", confidence: 0 };
  assert.equal(routeAssessment(unknown, "final", false, undefined, supportedContact).lifecycleStatus, "monitoring");

  const partial = assessment(8.4);
  partial.qualificationEvidence.capability = { ...partial.qualificationEvidence.capability, status: "partial", unmatchedRequirements: ["24/7 managed operations"] };
  const partialRoute = routeAssessment(partial, "final", false, undefined, supportedContact);
  assert.equal(partialRoute.exceptionKind, "capability_fit_uncertain");
  assert.deepEqual(partialRoute.qualificationChecks.capabilityEvidence.matchedServices, ["back-end systems"]);
  assert.deepEqual(partialRoute.qualificationChecks.capabilityEvidence.unmatchedRequirements, ["24/7 managed operations"]);
});

test("initial assessments route decision-relevant gaps to research", () => {
  const result = routeAssessment(assessment(8.4), "initial", true);
  assert.equal(result.lifecycleStatus, "needs_research");
  assert.equal(result.nextStage, "gap_analysis");
});

test("unresolved evidence and partner routes become human exceptions", () => {
  const lowConfidence = assessment(9, 0.4);
  lowConfidence.dimensions = lowConfidence.dimensions.map((dimension) =>
    dimension.name === "Budget fit" || dimension.name === "Delivery fit"
      ? { ...dimension, confidence: 0.82 }
      : dimension,
  );
  assert.equal(routeAssessment(lowConfidence, "final", false, undefined, supportedContact).lifecycleStatus, "monitoring");
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
      scopeBasis: "unknown",
      confidence: 0.3,
      evidenceRefs: [],
      explanation: "No supported budget was found.",
    },
  }, "final", false, undefined, supportedContact);
  assert.equal(result.lifecycleStatus, "monitoring");
  assert.equal(result.exceptionKind, null);
});

test("large total procurements need a bounded YipYip-addressable scope", () => {
  const result = routeAssessment({
    ...assessment(9),
    commercialFit: {
      budgetEvidenceStatus: "confirmed",
      totalProjectValueEur: 7_000_000,
      addressableScopeValueEur: null,
      addressableScopeStatus: "unknown",
      scopeBasis: "whole_procurement",
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
      scopeBasis: "explicit_lot",
      confidence: 0.86,
      evidenceRefs: ["signal-1"],
      explanation: "A cited lot identifies the addressable digital package.",
    },
  }, "final", false, undefined, supportedContact);
  assert.equal(result.lifecycleStatus, "qualified");
});

test("a whole-procurement value cannot masquerade as the YipYip-addressable package", () => {
  const result = routeAssessment({
    ...assessment(8.8),
    commercialFit: {
      ...assessment(8.8).commercialFit,
      totalProjectValueEur: 7_000_000,
      addressableScopeValueEur: 75_000,
      addressableScopeStatus: "bounded",
      scopeBasis: "whole_procurement",
    },
  }, "final", false, undefined, supportedContact);
  assert.equal(result.lifecycleStatus, "needs_review");
  assert.equal(result.exceptionKind, "unusual_budget");
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

test("unknown commercial, capability, and actionability evidence creates focused research", () => {
  const unresolved = assessment(8.5);
  unresolved.commercialFit = { ...unresolved.commercialFit, budgetEvidenceStatus: "unknown", addressableScopeValueEur: null, addressableScopeStatus: "unknown", scopeBasis: "unknown" };
  unresolved.qualificationEvidence.capability = { ...unresolved.qualificationEvidence.capability, status: "unknown", confidence: 0 };
  unresolved.qualificationEvidence.actionability = { ...unresolved.qualificationEvidence.actionability, status: "unknown", confidence: 0 };
  const questions = ensureQualificationResearchQuestions(
    { contactLabel: "Contact pending", contactStatus: "unknown" },
    unresolved,
    [],
  );
  assert.deepEqual(questions.map((question) => question.field), [
    ACTIONABLE_CONTACT_ROUTE_FIELD,
    "YipYip-addressable commercial scope",
    "YipYip capability fit",
    "current actionability",
  ]);
});

test("outreach validation enforces word caps and the evidence allow-list", () => {
  const valid = validateQualificationEvidence(assessment(8.5), ["signal-1"]);
  assert.ok(valid.outreachDraft);
  const unsupported = assessment(8.5);
  unsupported.outreachDraft = { ...unsupported.outreachDraft!, evidenceRefs: ["invented"] };
  assert.equal(validateQualificationEvidence(unsupported, ["signal-1"]).outreachDraft, null);
  const tooLong = assessment(8.5);
  tooLong.outreachDraft = { ...tooLong.outreachDraft!, emailBody: Array.from({ length: 121 }, () => "word").join(" ") };
  assert.equal(validateQualificationEvidence(tooLong, ["signal-1"]).outreachDraft, null);

  const unsupportedCapability = assessment(8.5);
  unsupportedCapability.qualificationEvidence.capability = {
    status: "partial",
    matchedServices: ["back-end systems"],
    unmatchedRequirements: ["24/7 managed operations"],
    confidence: 0.8,
    evidenceRefs: ["invented"],
    explanation: "This assertion is not in the evidence allow-list.",
  };
  const downgraded = validateQualificationEvidence(unsupportedCapability, ["signal-1"]);
  assert.equal(downgraded.qualificationEvidence.capability.status, "unknown");
  assert.deepEqual(downgraded.qualificationEvidence.capability.matchedServices, []);
  assert.deepEqual(downgraded.qualificationEvidence.capability.unmatchedRequirements, []);
});

test("contact research is not spent on opportunities that already fail the score threshold", () => {
  const result = routeAssessment(assessment(3), "initial");
  assert.equal(result.lifecycleStatus, "rejected");
  assert.equal(result.nextStage, null);
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
  assert.equal(result.lifecycleStatus, "monitoring");
  assert.equal(result.exceptionKind, null);
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

test("strong inferences need corroborating cited sources", () => {
  const questions = [
    { field: "addressable scope", question: "What package is addressable?", currentStatus: "missing" as const, decisionImpact: "high" as const, researchability: "high" as const, stopRule: "Two searches." },
  ];
  const oneSource = validateResearchPass(questions, [{
    field: "addressable scope",
    status: "strongly_inferred",
    value: "A likely €75k package",
    explanation: "The package is inferred from the programme documents.",
    confidence: 0.72,
    sourceUrls: ["https://example.nl/programme"],
  }], ["https://example.nl/programme"]);
  assert.deepEqual(oneSource.unresolvedQuestions.map((question) => question.field), ["addressable scope"]);

  const corroborated = validateResearchPass(questions, [{
    field: "addressable scope",
    status: "strongly_inferred",
    value: "A likely €75k package",
    explanation: "Two documents support the bounded inference.",
    confidence: 0.78,
    sourceUrls: ["https://example.nl/programme", "https://example.nl/budget"],
  }], ["https://example.nl/programme", "https://example.nl/budget"]);
  assert.equal(corroborated.acceptedFindings.length, 1);
});

test("research bundles are focused and semantic unknowns receive a diversified second pass", () => {
  const questions = [
    { field: "YipYip-addressable commercial scope", question: "What package is addressable?", currentStatus: "missing" as const, decisionImpact: "high" as const, researchability: "high" as const, stopRule: "Two searches." },
    { field: ACTIONABLE_CONTACT_ROUTE_FIELD, question: "Who is the buyer?", currentStatus: "missing" as const, decisionImpact: "high" as const, researchability: "high" as const, stopRule: "Two searches." },
    { field: "current actionability", question: "Is it current?", currentStatus: "missing" as const, decisionImpact: "high" as const, researchability: "high" as const, stopRule: "Two searches." },
  ];
  const first = selectResearchBundle(questions, {});
  assert.equal(first?.kind, "commercial");
  assert.equal(first?.diversifiedRetry, false);

  const buyerFirst = selectResearchBundle(questions, { "yipyip-addressable commercial scope": 1 });
  assert.equal(buyerFirst?.kind, "buyer_access");

  const commercialRetry = selectResearchBundle(questions, {
    "yipyip-addressable commercial scope": 1,
    [ACTIONABLE_CONTACT_ROUTE_FIELD]: 1,
    "current actionability": 1,
  });
  assert.equal(commercialRetry?.kind, "commercial");
  assert.equal(commercialRetry?.attempt, 2);
  assert.equal(commercialRetry?.diversifiedRetry, true);
});

test("a low weighted score with a proven fit axis and material unknowns still receives research", () => {
  const uncertain = assessment(4.6);
  uncertain.dimensions = uncertain.dimensions.map((dimension) => dimension.name === "Social impact"
    ? { ...dimension, score: 8, confidence: 0.85 }
    : dimension);
  uncertain.commercialFit = {
    ...uncertain.commercialFit,
    budgetEvidenceStatus: "unknown",
    addressableScopeValueEur: null,
    addressableScopeStatus: "unknown",
    scopeBasis: "unknown",
    confidence: 0.2,
    evidenceRefs: [],
  };
  const result = routeAssessment(uncertain, "initial", true);
  assert.equal(result.score.decision, "reject");
  assert.equal(result.lifecycleStatus, "needs_research");
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
    coverageGap: "announcements" as const,
    noveltyReason: "Adds a primary publisher not already present in the source network.",
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
