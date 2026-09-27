import assert from "node:assert/strict";
import test from "node:test";

import type { AutomatedAssessmentOutput } from "../lib/automation/contracts";
import { routeAssessment, validateCommercialFitEvidence } from "../lib/automation/pipeline";
import { defaultLeadStrategy } from "../lib/automation/strategy";
import type { DiscoveryAgentOutput } from "../lib/discovery/contracts";
import { DEFAULT_DUTCH_AGENCY_PROFILE, validateDiscoveryOutput } from "../lib/discovery/validation";
import { dimensionNames } from "../lib/domain";
import { evaluateConversationReadiness } from "../lib/readiness";

const sourceUrl = "https://example.nl/current-digital-lot";
const discovery: DiscoveryAgentOutput = {
  searchQueries: ["site:example.nl digital platform lot"],
  zeroResultReason: null,
  candidates: [{
    title: "Accessible service platform lot",
    organization: "Example Public Foundation",
    summary: "A current public notice defines a bounded digital platform package.",
    whyNow: "Market engagement remains open this quarter.",
    projectClues: ["Dedicated digital platform lot"],
    maturity: "selecting",
    budgetClue: "€75,000 lot",
    timingClue: "Responses accepted until 31 December 2026",
    contactClue: "Official procurement desk",
    location: "Netherlands",
    workMode: "Hybrid",
    technicalDifficulty: "High",
    entitySpecificity: "organization_specific",
    sectorCategories: ["public services"],
    actionabilityStatus: "current",
    actionableUntil: "2026-12-31",
    activeFollowOnClue: null,
    canonicalSourceUrl: sourceUrl,
    publisher: "Example Public Foundation",
    publicationDate: "2026-09-20",
    evidenceExcerpt: "The €75,000 platform lot remains open for supplier engagement.",
    facts: ["A dedicated €75,000 platform lot is published."],
    inferences: ["YipYip could deliver the bounded software package."],
    signalType: "pitching",
    confidence: 0.9,
  }],
};

function finalAssessment(): AutomatedAssessmentOutput {
  return {
    dimensions: dimensionNames.map((name) => ({ name, score: 8.4, confidence: 0.86, explanation: "Supported by the current notice.", evidenceRefs: [sourceUrl] })),
    commercialFit: {
      budgetEvidenceStatus: "confirmed",
      totalProjectValueEur: 75_000,
      addressableScopeValueEur: 75_000,
      addressableScopeStatus: "bounded",
      scopeBasis: "explicit_lot",
      confidence: 0.9,
      evidenceRefs: [sourceUrl],
      explanation: "The source identifies a dedicated €75,000 lot.",
    },
    qualificationEvidence: {
      sector: { categories: ["public services"], confidence: 0.9, evidenceRefs: [sourceUrl] },
      capability: { status: "supported", matchedServices: ["digital platforms", "back-end systems"], unmatchedRequirements: [], confidence: 0.86, evidenceRefs: [sourceUrl], explanation: "The cited scope matches configured capabilities." },
      actionability: { status: "current", actionableUntil: "2026-12-31", activeFollowOn: false, confidence: 0.92, evidenceRefs: [sourceUrl], explanation: "The cited response window remains open." },
    },
    hardExclusion: null,
    deliveryRoute: "direct",
    whyNow: "Supplier engagement is current.",
    suggestedNextAction: "Contact the procurement desk with a focused platform case.",
    risks: [],
    outreachDraft: {
      language: "en",
      recommendedChannel: "procurement_desk",
      emailSubject: "Accessible platform delivery conversation",
      emailBody: "We noticed the current €75,000 digital platform lot. YipYip builds custom platforms and back-end systems for public-interest services. We would welcome a short conversation about the required integrations, accessibility outcomes, and delivery constraints before the response deadline.",
      callOpening: "We noticed your current digital platform lot. YipYip builds public-interest platforms and back-end systems, and we would like to understand the integration and accessibility priorities before the response deadline.",
      discoveryQuestions: ["Which integrations are mandatory?", "How will accessibility be evaluated?"],
      evidenceRefs: [sourceUrl],
      caveats: [],
    },
  };
}

test("invalid shadow evidence cannot change delivery routing or normal intake", () => {
  const assessment = finalAssessment();
  const before = routeAssessment(assessment, "final", false);
  const withShadow = { ...assessment, conversationReadiness: { invented: true } };
  assert.equal(evaluateConversationReadiness(withShadow.conversationReadiness, { allowedEvidenceRefs: [sourceUrl], evaluatedAt: "2026-09-27", minimumBudgetEur: 30000 }).status, "not_evaluated");
  assert.deepEqual(routeAssessment(withShadow, "final", false), before);
  const args = { output: discovery, consultedUrls: [sourceUrl], profile: DEFAULT_DUTCH_AGENCY_PROFILE, now: new Date("2026-09-25") };
  assert.deepEqual(validateDiscoveryOutput({ ...args, output: { ...discovery, candidates: discovery.candidates.map((candidate) => ({ ...candidate, buyingIntent: { status: "unknown", confidence: 0, evidenceRefs: [], rationale: "Not known" } })) } }).map((row) => [row.accepted, row.rejectionReasons]), validateDiscoveryOutput(args).map((row) => [row.accepted, row.rejectionReasons]));
});

test("mocked monitor-to-qualified-Lead path preserves evidence and outreach", () => {
  const [normalized] = validateDiscoveryOutput({
    output: discovery,
    consultedUrls: [sourceUrl],
    profile: DEFAULT_DUTCH_AGENCY_PROFILE,
    now: new Date("2026-09-25T00:00:00Z"),
  });
  assert.equal(normalized.accepted, true);

  const assessment = validateCommercialFitEvidence(finalAssessment(), [sourceUrl]);
  const strategy = defaultLeadStrategy("workspace");
  const route = routeAssessment(assessment, "final", false, undefined, {
    supported: true,
    label: "Official procurement desk",
    status: "confirmed",
    confidence: 0.9,
    sourceUrls: [sourceUrl],
  }, {
    hardExcludedSectors: strategy.hardExcludedSectors,
    sensitiveSectors: strategy.sensitiveSectors,
    capacityStatus: "available",
    capacityEffectiveUntil: "2026-12-31",
    now: new Date("2026-09-25T00:00:00Z"),
  });
  assert.equal(route.lifecycleStatus, "qualified");
  assert.equal(route.score.decision, "qualify");
  assert.equal(route.qualificationChecks.allPassed, true);
  assert.equal(assessment.outreachDraft?.language, "en");
});

test("mocked stale, excluded, capability-misaligned, and unresolved results never qualify", () => {
  const strategy = defaultLeadStrategy("workspace");
  const context = {
    hardExcludedSectors: strategy.hardExcludedSectors,
    sensitiveSectors: strategy.sensitiveSectors,
    capacityStatus: "available" as const,
    capacityEffectiveUntil: "2026-12-31",
    now: new Date("2026-09-25T00:00:00Z"),
  };
  const contact = { supported: true, label: "Desk", status: "confirmed" as const, confidence: 0.9, sourceUrls: [sourceUrl] };
  const stale = finalAssessment();
  stale.qualificationEvidence.actionability = { ...stale.qualificationEvidence.actionability, status: "expired", actionableUntil: "2026-08-01" };
  assert.equal(routeAssessment(stale, "final", false, undefined, contact, context).lifecycleStatus, "rejected");
  const excluded = finalAssessment();
  excluded.qualificationEvidence.sector = { categories: ["gambling"], confidence: 0.9, evidenceRefs: [sourceUrl] };
  assert.equal(routeAssessment(excluded, "final", false, undefined, contact, context).lifecycleStatus, "rejected");
  const misaligned = finalAssessment();
  misaligned.qualificationEvidence.capability = { ...misaligned.qualificationEvidence.capability, status: "unsupported" };
  assert.equal(routeAssessment(misaligned, "final", false, undefined, contact, context).lifecycleStatus, "rejected");
  const unresolved = finalAssessment();
  unresolved.commercialFit = { ...unresolved.commercialFit, budgetEvidenceStatus: "unknown", addressableScopeValueEur: null, addressableScopeStatus: "unknown", scopeBasis: "unknown" };
  assert.equal(routeAssessment(unresolved, "final", false, undefined, contact, context).lifecycleStatus, "monitoring");
});
