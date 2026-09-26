import type { AutomationStage, AutomatedAssessmentOutput, GapQuestion, ResearchFindingOutput, SourceProposal } from "@/lib/automation/contracts";
import { canonicalizeHttpsUrl } from "@/lib/discovery/validation";
import type { DeliveryCapacityStatus } from "@/lib/automation/strategy";
import { applyCommercialBudgetScore, calculateScore, capacityDimension, initialPolicy, type DimensionInput, type ScoreResult, type ScoringPolicy } from "@/lib/scoring";

export type QualificationCheckStatus = "passed" | "rejected" | "unresolved" | "review";

export interface QualificationChecks {
  policyVersion: string;
  allPassed: boolean;
  hardRejection: string | null;
  checks: {
    sector: QualificationCheckStatus;
    actionability: QualificationCheckStatus;
    commercial: QualificationCheckStatus;
    capability: QualificationCheckStatus;
    fitAxis: QualificationCheckStatus;
    timing: QualificationCheckStatus;
    contact: QualificationCheckStatus;
    capacity: QualificationCheckStatus;
    delivery: QualificationCheckStatus;
    outreach: QualificationCheckStatus;
    score: QualificationCheckStatus;
  };
  reasons: string[];
  capabilityEvidence: {
    status: AutomatedAssessmentOutput["qualificationEvidence"]["capability"]["status"];
    matchedServices: string[];
    unmatchedRequirements: string[];
    confidence: number;
    evidenceRefs: string[];
    explanation: string;
  };
  capacityEvidence: {
    status: DeliveryCapacityStatus;
    effectiveUntil: string | null;
    expired: boolean;
    score: number;
    confidence: number;
  };
}

export interface QualificationPolicyContext {
  hardExcludedSectors: string[];
  sensitiveSectors: string[];
  capacityStatus: DeliveryCapacityStatus;
  capacityEffectiveUntil: string | null;
  now?: Date;
}

export interface QualificationRoute {
  score: ScoreResult;
  dimensions: DimensionInput[];
  nextStage: AutomationStage | null;
  lifecycleStatus: "rejected" | "needs_research" | "monitoring" | "needs_review" | "qualified";
  exceptionKind: "low_confidence" | "borderline_score" | "partner_required" | "sensitive_sector" | "commercial_fit_uncertain" | "unusual_budget" | "contact_route_unresolved" | "capability_fit_uncertain" | "delivery_capacity_uncertain" | "actionability_uncertain" | "outreach_draft_invalid" | null;
  qualificationChecks: QualificationChecks;
}

export const ACTIONABLE_CONTACT_ROUTE_FIELD = "actionable contact route";

export interface ContactRouteResolution {
  supported: boolean;
  label: string | null;
  status: "confirmed" | "inferred" | "unknown";
  confidence: number;
  sourceUrls: string[];
}

export interface SourceScoutCompletion {
  terminalStatus: "waiting_approval" | "succeeded";
  outcome: "waiting_approval" | "no_reviewable_proposals";
}

export function sourceScoutCompletion(proposalCount: number): SourceScoutCompletion {
  return proposalCount > 0
    ? { terminalStatus: "waiting_approval", outcome: "waiting_approval" }
    : { terminalStatus: "succeeded", outcome: "no_reviewable_proposals" };
}

export function prioritizeGaps(questions: GapQuestion[]): GapQuestion[] {
  const rank = { low: 1, medium: 2, high: 3 } as const;
  return [...questions]
    .filter((question) => question.decisionImpact !== "low" && question.researchability !== "low")
    .sort((left, right) =>
      (rank[right.decisionImpact] * rank[right.researchability]) -
      (rank[left.decisionImpact] * rank[left.researchability]),
    );
}

export const MAX_RESEARCH_PASSES = 8;
export const MAX_RESEARCH_ATTEMPTS_PER_QUESTION = 2;
export const RESEARCH_BUNDLE_SIZE = 3;

export type ResearchBundleKind = "commercial" | "buyer_access" | "capability" | "timing" | "other";

export interface ResearchBundleSelection {
  kind: ResearchBundleKind;
  questions: GapQuestion[];
  attempt: number;
  diversifiedRetry: boolean;
}

function researchBundleKind(field: string): ResearchBundleKind {
  const normalized = normalizedField(field).replace(/[^a-z0-9]+/g, " ");
  if (/budget|commercial|funding|addressable|contract value|lot|package/.test(normalized)) return "commercial";
  if (/contact|buyer|owner|procurement|tender|access/.test(normalized)) return "buyer_access";
  if (/capability|technical|delivery|service|scope/.test(normalized)) return "capability";
  if (/timing|deadline|actionab|fresh|start|follow on/.test(normalized)) return "timing";
  return "other";
}

/**
 * Select one decision-focused research bundle. Questions receive one broad
 * pass before any semantic unknown receives a second, diversified pass.
 */
export function selectResearchBundle(
  questions: GapQuestion[],
  attemptsByField: Readonly<Record<string, number>> = {},
): ResearchBundleSelection | null {
  const candidates = prioritizeGaps(questions)
    .map((question) => ({
      question,
      attempts: attemptsByField[normalizedField(question.field)] ?? 0,
      kind: researchBundleKind(question.field),
    }))
    .filter((item) => item.attempts < MAX_RESEARCH_ATTEMPTS_PER_QUESTION);
  if (!candidates.length) return null;

  const nextAttemptCount = Math.min(...candidates.map((item) => item.attempts));
  const bundleOrder: ResearchBundleKind[] = ["commercial", "buyer_access", "capability", "timing", "other"];
  const nextKind = bundleOrder.find((kind) => candidates.some((item) => item.attempts === nextAttemptCount && item.kind === kind));
  if (!nextKind) return null;

  return {
    kind: nextKind,
    questions: candidates
      .filter((item) => item.attempts === nextAttemptCount && item.kind === nextKind)
      .slice(0, RESEARCH_BUNDLE_SIZE)
      .map((item) => item.question),
    attempt: nextAttemptCount + 1,
    diversifiedRetry: nextAttemptCount > 0,
  };
}

function isContactRouteField(field: string): boolean {
  const normalized = normalizedField(field);
  const words = normalized.replace(/[^a-z0-9]+/g, " ").trim();
  return normalized === ACTIONABLE_CONTACT_ROUTE_FIELD
    || /(^|\s)(contact|commissioning owner|procurement desk|tender channel|tender access|commercial access)(\s|$)/.test(words);
}

export function ensureRequiredResearchQuestions(
  opportunity: Pick<import("@/lib/domain").OpportunityView, "contactLabel" | "contactStatus">,
  questions: GapQuestion[],
): GapQuestion[] {
  if (opportunity.contactStatus === "confirmed") return prioritizeGaps(questions);
  const withoutContactAliases = questions.filter((question) => !isContactRouteField(question.field));
  return prioritizeGaps([
    {
      field: ACTIONABLE_CONTACT_ROUTE_FIELD,
      question: "What evidence-backed route can YipYip use to reach the responsible buyer: a named person, responsible team, procurement desk, or official tender channel?",
      currentStatus: opportunity.contactStatus === "inferred" ? "inferred" : "missing",
      decisionImpact: "high",
      researchability: "high",
      stopRule: "Stop after two focused searches across primary organization, procurement, and tender sources; unknown is a valid result.",
    },
    ...withoutContactAliases,
  ]);
}

export function ensureQualificationResearchQuestions(
  opportunity: Pick<import("@/lib/domain").OpportunityView, "contactLabel" | "contactStatus">,
  assessment: AutomatedAssessmentOutput,
  questions: GapQuestion[],
): GapQuestion[] {
  const required: GapQuestion[] = [];
  if (["unknown", "conflicting"].includes(assessment.commercialFit.budgetEvidenceStatus)
    || assessment.commercialFit.addressableScopeStatus !== "bounded") {
    required.push({
      field: "YipYip-addressable commercial scope",
      question: "What cited budget, lot, package, funding, or capacity evidence bounds the portion of this project that YipYip could realistically deliver?",
      currentStatus: assessment.commercialFit.budgetEvidenceStatus === "conflicting" ? "conflicting" : "missing",
      decisionImpact: "high",
      researchability: "high",
      stopRule: "Stop after two focused primary-source searches; do not substitute the value of the whole procurement for a YipYip-addressable package.",
    });
  }
  if (["unknown", "partial"].includes(assessment.qualificationEvidence.capability.status)) {
    required.push({
      field: "YipYip capability fit",
      question: "Which cited project requirements match YipYip's configured software capabilities, and which material requirements remain unsupported?",
      currentStatus: assessment.qualificationEvidence.capability.status === "partial" ? "weak" : "missing",
      decisionImpact: "high",
      researchability: "high",
      stopRule: "Stop after two focused searches of the project brief and primary organization sources; unknown is valid.",
    });
  }
  if (assessment.qualificationEvidence.actionability.status === "unknown"
    || assessment.qualificationEvidence.actionability.confidence < 0.65) {
    required.push({
      field: "current actionability",
      question: "What current deadline, planning window, supplier-selection status, or separately cited active follow-on proves this opportunity can still be acted on?",
      currentStatus: "missing",
      decisionImpact: "high",
      researchability: "high",
      stopRule: "Stop after two focused primary-source searches; an expired item without a separate current follow-on is not actionable.",
    });
  }
  const requiredNames = new Set(required.map((item) => normalizedField(item.field)));
  const withoutAliases = questions.filter((question) => !requiredNames.has(normalizedField(question.field)));
  return ensureRequiredResearchQuestions(opportunity, [...required, ...withoutAliases]);
}

export function resolveActionableContactRoute(
  opportunity: Pick<import("@/lib/domain").OpportunityView, "contactLabel" | "contactStatus">,
  findings: ResearchFindingOutput[],
): ContactRouteResolution {
  if (opportunity.contactStatus === "confirmed" && opportunity.contactLabel.trim()) {
    return {
      supported: true,
      label: opportunity.contactLabel.trim(),
      status: "confirmed",
      confidence: 1,
      sourceUrls: [],
    };
  }

  // Callers provide findings newest first. The latest bounded attempt is
  // authoritative so an older optimistic answer cannot override a newer
  // unknown or contradiction.
  const supported = findings.find((finding) => isContactRouteField(finding.field));

  if (
    !supported
    || !["confirmed", "strongly_inferred"].includes(supported.status)
    || typeof supported.value !== "string"
    || !supported.value.trim()
    || supported.confidence < 0.65
    || supported.sourceUrls.length === 0
  ) {
    return { supported: false, label: null, status: "unknown", confidence: 0, sourceUrls: [] };
  }
  return {
    supported: true,
    label: supported.value!.trim(),
    status: supported.status === "confirmed" ? "confirmed" : "inferred",
    confidence: supported.confidence,
    sourceUrls: supported.sourceUrls.map(canonicalizeHttpsUrl).filter((url): url is string => Boolean(url)),
  };
}

function canonicalAllowList(urls: string[]): Set<string> {
  return new Set(urls.map(canonicalizeHttpsUrl).filter((url): url is string => Boolean(url)));
}

function normalizedField(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

export interface ResearchPassValidation {
  acceptedFindings: ResearchFindingOutput[];
  unresolvedQuestions: GapQuestion[];
  issues: string[];
}

export function validateResearchPass(
  questions: GapQuestion[],
  findings: ResearchFindingOutput[],
  consultedUrls: string[],
): ResearchPassValidation {
  const allowed = canonicalAllowList(consultedUrls);
  const acceptedFindings: ResearchFindingOutput[] = [];
  const unresolvedQuestions: GapQuestion[] = [];
  const issues: string[] = [];
  const expected = new Map(questions.map((question) => [normalizedField(question.field), question]));
  const grouped = new Map<string, ResearchFindingOutput[]>();

  for (const finding of findings) {
    const key = normalizedField(finding.field);
    if (!expected.has(key)) {
      issues.push(`Unexpected research field: ${finding.field}.`);
      continue;
    }
    grouped.set(key, [...(grouped.get(key) ?? []), finding]);
  }

  for (const question of questions) {
    const matches = grouped.get(normalizedField(question.field)) ?? [];
    if (matches.length !== 1) {
      unresolvedQuestions.push(question);
      issues.push(matches.length ? `Duplicate findings for ${question.field}.` : `Missing finding for ${question.field}.`);
      continue;
    }
    const finding = matches[0];
    const canonicalSources = [...new Set(finding.sourceUrls.map(canonicalizeHttpsUrl).filter((url): url is string => Boolean(url)))];
    const invalidSource = canonicalSources.length !== finding.sourceUrls.length
      || canonicalSources.some((url) => !allowed.has(url));
    const supported = !["unknown", "not_found"].includes(finding.status);
    if (invalidSource || (supported && canonicalSources.length === 0)) {
      unresolvedQuestions.push(question);
      issues.push(`Finding for ${question.field} does not resolve exclusively to consulted web-search sources.`);
      continue;
    }
    if (finding.status === "strongly_inferred" && canonicalSources.length < 2) {
      unresolvedQuestions.push(question);
      issues.push(`Strong inference for ${question.field} requires at least two cited sources.`);
      continue;
    }
    acceptedFindings.push({ ...finding, sourceUrls: canonicalSources });
  }

  return { acceptedFindings, unresolvedQuestions, issues };
}

export function validateSourceProposalEvidence(proposal: SourceProposal, consultedUrls: string[]): boolean {
  const allowed = canonicalAllowList(consultedUrls);
  const base = canonicalizeHttpsUrl(proposal.baseUrl);
  if (!base) return false;
  const baseHost = new URL(base).hostname;
  return proposal.sampleEvidence.some((sample) => {
    const sampleUrl = canonicalizeHttpsUrl(sample.url);
    if (!sampleUrl || !allowed.has(sampleUrl)) return false;
    const sampleHost = new URL(sampleUrl).hostname;
    return sampleHost === baseHost || sampleHost.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${sampleHost}`);
  });
}

export function routeAssessment(
  assessment: AutomatedAssessmentOutput,
  phase: "initial" | "final",
  hasMaterialGaps = false,
  policy: ScoringPolicy = initialPolicy,
  contactRoute: ContactRouteResolution = { supported: false, label: null, status: "unknown", confidence: 0, sourceUrls: [] },
  context: QualificationPolicyContext = {
    hardExcludedSectors: [],
    sensitiveSectors: [],
    capacityStatus: "available",
    capacityEffectiveUntil: null,
  },
): QualificationRoute {
  const capacity = capacityDimension(context.capacityStatus, context.capacityEffectiveUntil, context.now);
  const dimensions = applyCommercialBudgetScore(assessment.dimensions, assessment.commercialFit, policy)
    .map((dimension) => dimension.name === "Availability"
      ? { ...dimension, score: capacity.score, confidence: capacity.confidence }
      : dimension);
  const addressableValue = assessment.commercialFit.addressableScopeValueEur;
  const confirmedTooSmall = assessment.commercialFit.budgetEvidenceStatus === "confirmed"
    && addressableValue !== null
    && addressableValue < policy.commercial.minimumProjectBudgetEur;
  const dimensionByName = new Map(dimensions.map((dimension) => [dimension.name, dimension]));
  const missingMinimum = (Object.keys(policy.minimumDimensionScore) as Array<keyof typeof policy.minimumDimensionScore>).some((name) => {
    const dimension = dimensionByName.get(name);
    return !dimension
      || dimension.score < (policy.minimumDimensionScore[name] ?? 0)
      || dimension.confidence < (policy.minimumDimensionConfidence[name] ?? 0);
  });
  const social = dimensionByName.get("Social impact");
  const technical = dimensionByName.get("Technical fit");
  const fitAxisPassed = [social, technical].some((dimension) =>
    Boolean(dimension && dimension.score >= 6 && dimension.confidence >= 0.65));
  const fitAxisHighConfidenceFailure = [social, technical].every((dimension) =>
    Boolean(dimension && dimension.score < 6 && dimension.confidence >= 0.65));
  const commercialUnknown = ["unknown", "conflicting"].includes(assessment.commercialFit.budgetEvidenceStatus);
  const unresolvedLargeTotal = (assessment.commercialFit.totalProjectValueEur ?? 0) > policy.commercial.largeProjectReviewEur
    && (addressableValue === null
      || assessment.commercialFit.addressableScopeStatus !== "bounded"
      || assessment.commercialFit.scopeBasis === "whole_procurement");
  const delivery = dimensionByName.get("Delivery fit");
  const unusuallyLargeScope = (addressableValue ?? 0) > policy.commercial.largeProjectReviewEur
    && !(assessment.commercialFit.addressableScopeStatus === "bounded"
      && (delivery?.score ?? 0) >= 7
      && (delivery?.confidence ?? 0) >= 0.7);

  const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const categories = assessment.qualificationEvidence.sector.categories.map(normalize);
  const matchesPolicy = (values: string[]) => values.some((value) => {
    const term = normalize(value);
    return categories.some((category) => category === term || category.includes(term) || term.includes(category));
  });
  const hardSector = assessment.qualificationEvidence.sector.confidence >= 0.65
    && matchesPolicy(context.hardExcludedSectors);
  const sensitiveSector = assessment.qualificationEvidence.sector.confidence >= 0.65
    && matchesPolicy(context.sensitiveSectors);
  const actionability = assessment.qualificationEvidence.actionability;
  const actionabilityDate = actionability.actionableUntil
    ? new Date(`${actionability.actionableUntil}T23:59:59.999Z`)
    : null;
  const expiredByDate = Boolean(actionabilityDate
    && Number.isFinite(actionabilityDate.getTime())
    && actionabilityDate < (context.now ?? new Date()));
  const expired = (actionability.status === "expired" || expiredByDate) && !actionability.activeFollowOn;
  const actionabilityUnknown = actionability.status === "unknown" || actionability.confidence < 0.65;
  const capability = assessment.qualificationEvidence.capability;
  const capabilityRejected = capability.status === "unsupported" && capability.confidence >= 0.65;
  const capabilityConflict = capability.status === "partial" && capability.confidence >= 0.65;
  const capabilityUnknown = capability.status === "unknown" || capability.confidence < 0.65;
  const timing = dimensionByName.get("Timing fit");
  const timingUnknown = !timing || timing.confidence < 0.65;
  const outreachValid = phase === "initial" || assessment.outreachDraft !== null;
  const scoreWithoutHardGate = calculateScore(dimensions, policy);
  const fitAxisPotential = !fitAxisHighConfidenceFailure && [social, technical].some((dimension) =>
    Boolean(dimension && dimension.score >= 6));

  let hardRejection: string | null = null;
  if (hardSector) hardRejection = "Opportunity is in a hard-excluded sector.";
  else if (expired) hardRejection = "Opportunity is expired without a supported active follow-on.";
  else if (confirmedTooSmall) hardRejection = `Confirmed YipYip-addressable scope is below €${policy.commercial.minimumProjectBudgetEur.toLocaleString("en-US")}.`;
  else if (capabilityRejected) hardRejection = "The required capability is explicitly unsupported by YipYip.";
  else if (assessment.hardExclusion) hardRejection = assessment.hardExclusion;
  else if (fitAxisHighConfidenceFailure) hardRejection = "Neither Social impact nor Technical fit meets YipYip's minimum fit axis.";
  const score = hardRejection ? calculateScore(dimensions, policy, hardRejection) : scoreWithoutHardGate;

  const checks: QualificationChecks["checks"] = {
    sector: hardSector ? "rejected" : sensitiveSector ? "review" : "passed",
    actionability: expired ? "rejected" : actionabilityUnknown ? "unresolved" : "passed",
    commercial: confirmedTooSmall ? "rejected" : commercialUnknown || missingMinimum ? "unresolved" : unresolvedLargeTotal || unusuallyLargeScope ? "review" : "passed",
    capability: capabilityRejected ? "rejected" : capabilityConflict ? "review" : capabilityUnknown ? "unresolved" : "passed",
    fitAxis: fitAxisHighConfidenceFailure ? "rejected" : fitAxisPassed ? "passed" : "unresolved",
    timing: expired ? "rejected" : timingUnknown ? "unresolved" : "passed",
    contact: contactRoute.supported ? "passed" : "unresolved",
    capacity: context.capacityStatus === "unavailable" ? "review" : capacity.unresolved ? "unresolved" : "passed",
    delivery: assessment.deliveryRoute === "unsuitable" ? "rejected" : assessment.deliveryRoute === "partner" || assessment.deliveryRoute === "consortium" ? "review" : "passed",
    outreach: outreachValid ? "passed" : "unresolved",
    score: score.decision === "reject"
      ? fitAxisPotential && (commercialUnknown || missingMinimum || capabilityUnknown || actionabilityUnknown || timingUnknown || !contactRoute.supported)
        ? "unresolved"
        : "rejected"
      : score.decision === "qualify" ? "passed" : "review",
  };
  const reasons = Object.entries(checks)
    .filter(([, status]) => status !== "passed")
    .map(([name, status]) => `${name}: ${status}`);
  const build = (
    lifecycleStatus: QualificationRoute["lifecycleStatus"],
    nextStage: AutomationStage | null,
    exceptionKind: QualificationRoute["exceptionKind"],
  ): QualificationRoute => {
    const allPassed = lifecycleStatus === "qualified"
      && score.decision === "qualify"
      && Object.values(checks).every((status) => status === "passed");
    return {
      score,
      dimensions,
      nextStage,
      lifecycleStatus: allPassed ? "qualified" : lifecycleStatus === "qualified" ? "needs_review" : lifecycleStatus,
      exceptionKind: allPassed ? null : exceptionKind,
      qualificationChecks: {
        policyVersion: policy.version,
        allPassed,
        hardRejection,
        checks,
        reasons,
        capabilityEvidence: {
          status: capability.status,
          matchedServices: capability.matchedServices,
          unmatchedRequirements: capability.unmatchedRequirements ?? [],
          confidence: capability.confidence,
          evidenceRefs: capability.evidenceRefs,
          explanation: capability.explanation,
        },
        capacityEvidence: {
          status: context.capacityStatus,
          effectiveUntil: context.capacityEffectiveUntil,
          expired: capacity.expired,
          score: capacity.score,
          confidence: capacity.confidence,
        },
      },
    };
  };

  // Deterministic gate order. Agents provide evidence; only application code routes.
  if (hardRejection || assessment.deliveryRoute === "unsuitable") {
    return build("rejected", null, null);
  }
  const unresolved = hasMaterialGaps
    || commercialUnknown
    || missingMinimum
    || capabilityUnknown
    || !fitAxisPassed
    || actionabilityUnknown
    || timingUnknown
    || !contactRoute.supported
    || capacity.unresolved;
  const researchWorthwhile = fitAxisPotential && unresolved;
  if (phase === "initial" && researchWorthwhile) {
    return build("needs_research", "gap_analysis", null);
  }
  if (phase === "final" && (unresolvedLargeTotal || unusuallyLargeScope)) return build("needs_review", null, "unusual_budget");
  if (phase === "final" && assessment.commercialFit.budgetEvidenceStatus === "conflicting") return build("needs_review", null, "commercial_fit_uncertain");
  if (phase === "final" && capabilityConflict) return build("needs_review", null, "capability_fit_uncertain");
  if (phase === "final" && capacity.unresolved) return build("needs_review", null, "delivery_capacity_uncertain");
  if (phase === "final" && context.capacityStatus === "unavailable") return build("needs_review", null, "delivery_capacity_uncertain");
  if (sensitiveSector) return build("needs_review", null, "sensitive_sector");
  if (assessment.deliveryRoute === "partner" || assessment.deliveryRoute === "consortium") return build("needs_review", null, "partner_required");
  if (score.decision === "reject") {
    if (phase === "final" && researchWorthwhile) {
      return build("monitoring", null, null);
    }
    return build("rejected", null, null);
  }
  if (phase === "initial" && (score.decision === "research" || unresolved || unresolvedLargeTotal || !outreachValid)) {
    return build("needs_research", "gap_analysis", null);
  }
  if (phase === "final" && fitAxisPotential && (commercialUnknown || missingMinimum || capabilityUnknown || actionabilityUnknown || timingUnknown || !contactRoute.supported)) {
    return build("monitoring", null, null);
  }
  if (phase === "final" && (commercialUnknown || missingMinimum)) return build("needs_review", null, "commercial_fit_uncertain");
  if (phase === "final" && capabilityUnknown) return build("needs_review", null, "capability_fit_uncertain");
  if (phase === "final" && (actionabilityUnknown || timingUnknown)) return build("needs_review", null, "actionability_uncertain");
  if (phase === "final" && !contactRoute.supported) return build("needs_review", null, "contact_route_unresolved");
  if (phase === "final" && !fitAxisPassed) return build("needs_review", null, "low_confidence");
  if (phase === "final" && !assessment.outreachDraft) return build("needs_review", null, "outreach_draft_invalid");
  if (score.decision !== "qualify") {
    return build("needs_review", null, score.confidence < policy.confidenceFloor ? "low_confidence" : "borderline_score");
  }
  return build("qualified", null, null);
}

export function validateCommercialFitEvidence(
  assessment: AutomatedAssessmentOutput,
  allowedEvidenceRefs: string[],
): AutomatedAssessmentOutput {
  const allowed = new Set(allowedEvidenceRefs);
  const supportedRefs = assessment.commercialFit.evidenceRefs.filter((reference) => allowed.has(reference));
  const claimsSupport = assessment.commercialFit.budgetEvidenceStatus === "confirmed"
    || assessment.commercialFit.budgetEvidenceStatus === "proxy"
    || assessment.commercialFit.addressableScopeStatus === "bounded"
    || assessment.commercialFit.totalProjectValueEur !== null
    || assessment.commercialFit.addressableScopeValueEur !== null;
  if (!claimsSupport || supportedRefs.length > 0) {
    return validateQualificationEvidence({ ...assessment, commercialFit: { ...assessment.commercialFit, evidenceRefs: supportedRefs } }, allowedEvidenceRefs);
  }
  return validateQualificationEvidence({
    ...assessment,
    commercialFit: {
      budgetEvidenceStatus: "unknown",
      totalProjectValueEur: null,
      addressableScopeValueEur: null,
      addressableScopeStatus: "unknown",
      scopeBasis: "unknown",
      confidence: Math.min(assessment.commercialFit.confidence, 0.4),
      evidenceRefs: [],
      explanation: `Unsupported commercial claim was downgraded to unknown. ${assessment.commercialFit.explanation}`.slice(0, 500),
    },
  }, allowedEvidenceRefs);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function validateQualificationEvidence(
  assessment: AutomatedAssessmentOutput,
  allowedEvidenceRefs: string[],
): AutomatedAssessmentOutput {
  const allowed = new Set(allowedEvidenceRefs);
  const filter = (refs: string[]) => refs.filter((reference) => allowed.has(reference));
  const sectorRefs = filter(assessment.qualificationEvidence.sector.evidenceRefs);
  const capabilityRefs = filter(assessment.qualificationEvidence.capability.evidenceRefs);
  const actionabilityRefs = filter(assessment.qualificationEvidence.actionability.evidenceRefs);
  const capabilitySupported = assessment.qualificationEvidence.capability.status === "unknown" || capabilityRefs.length > 0;
  const actionabilitySupported = assessment.qualificationEvidence.actionability.status === "unknown" || actionabilityRefs.length > 0;
  const sectorSupported = assessment.qualificationEvidence.sector.categories.length === 0 || sectorRefs.length > 0;
  const draftRefs = assessment.outreachDraft ? filter(assessment.outreachDraft.evidenceRefs) : [];
  const draftValid = Boolean(
    assessment.outreachDraft
    && wordCount(assessment.outreachDraft.emailBody) <= 120
    && wordCount(assessment.outreachDraft.callOpening) <= 60
    && assessment.outreachDraft.discoveryQuestions.length <= 3
    && draftRefs.length > 0
    && draftRefs.length === assessment.outreachDraft.evidenceRefs.length,
  );
  return {
    ...assessment,
    qualificationEvidence: {
      sector: sectorSupported
        ? { ...assessment.qualificationEvidence.sector, evidenceRefs: sectorRefs }
        : { categories: [], confidence: 0, evidenceRefs: [] },
      capability: capabilitySupported
        ? { ...assessment.qualificationEvidence.capability, evidenceRefs: capabilityRefs }
        : {
            status: "unknown",
            matchedServices: [],
            unmatchedRequirements: [],
            confidence: 0,
            evidenceRefs: [],
            explanation: "Unsupported capability claim was downgraded to unknown.",
          },
      actionability: actionabilitySupported
        ? { ...assessment.qualificationEvidence.actionability, evidenceRefs: actionabilityRefs }
        : {
            status: "unknown",
            actionableUntil: null,
            activeFollowOn: false,
            confidence: 0,
            evidenceRefs: [],
            explanation: "Unsupported actionability claim was downgraded to unknown.",
          },
    },
    outreachDraft: draftValid && assessment.outreachDraft
      ? { ...assessment.outreachDraft, evidenceRefs: draftRefs }
      : null,
  };
}

export function retryDelaySeconds(attempt: number): number | null {
  if (attempt >= 4) return null;
  return 60 * (2 ** Math.max(0, attempt - 1));
}

export function evaluateCostLimit(spent: number, next: number, limit: number) {
  const projected = Math.max(0, spent) + Math.max(0, next);
  return {
    allowed: projected <= Math.max(0, limit),
    projected,
    overrun: Math.round(Math.max(0, projected - Math.max(0, limit)) * 1_000_000) / 1_000_000,
  };
}
