import type { AutomationStage, AutomatedAssessmentOutput, GapQuestion, ResearchFindingOutput, SourceProposal } from "@/lib/automation/contracts";
import { canonicalizeHttpsUrl } from "@/lib/discovery/validation";
import { applyCommercialBudgetScore, calculateScore, initialPolicy, type DimensionInput, type ScoreResult, type ScoringPolicy } from "@/lib/scoring";

export interface QualificationRoute {
  score: ScoreResult;
  dimensions: DimensionInput[];
  nextStage: AutomationStage | null;
  lifecycleStatus: "rejected" | "needs_research" | "needs_review" | "qualified";
  exceptionKind: "low_confidence" | "borderline_score" | "partner_required" | "commercial_fit_uncertain" | "unusual_budget" | "contact_route_unresolved" | null;
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

function isContactRouteField(field: string): boolean {
  const normalized = normalizedField(field);
  return normalized === ACTIONABLE_CONTACT_ROUTE_FIELD
    || /(^|\s)(contact|commissioning owner|procurement desk|tender channel|commercial access)(\s|$)/.test(normalized);
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
    const canonicalSources = finding.sourceUrls.map(canonicalizeHttpsUrl);
    const invalidSource = canonicalSources.some((url) => !url || !allowed.has(url));
    const supported = !["unknown", "not_found"].includes(finding.status);
    if (invalidSource || (supported && canonicalSources.length === 0)) {
      unresolvedQuestions.push(question);
      issues.push(`Finding for ${question.field} does not resolve exclusively to consulted web-search sources.`);
      continue;
    }
    acceptedFindings.push(finding);
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
): QualificationRoute {
  const dimensions = applyCommercialBudgetScore(assessment.dimensions, assessment.commercialFit, policy);
  const addressableValue = assessment.commercialFit.addressableScopeValueEur;
  const confirmedTooSmall = assessment.commercialFit.budgetEvidenceStatus === "confirmed"
    && addressableValue !== null
    && addressableValue < policy.commercial.minimumProjectBudgetEur;
  const hardExclusion = confirmedTooSmall
    ? `Confirmed YipYip-addressable scope is below €${policy.commercial.minimumProjectBudgetEur.toLocaleString("en-US")}.`
    : assessment.hardExclusion ?? undefined;
  const score = calculateScore(dimensions, policy, hardExclusion);
  const dimensionByName = new Map(dimensions.map((dimension) => [dimension.name, dimension]));
  const missingMinimum = (Object.keys(policy.minimumDimensionScore) as Array<keyof typeof policy.minimumDimensionScore>).some((name) => {
    const dimension = dimensionByName.get(name);
    return !dimension
      || dimension.score < (policy.minimumDimensionScore[name] ?? 0)
      || dimension.confidence < (policy.minimumDimensionConfidence[name] ?? 0);
  });
  const commercialUnknown = ["unknown", "conflicting"].includes(assessment.commercialFit.budgetEvidenceStatus);
  const unresolvedLargeTotal = (assessment.commercialFit.totalProjectValueEur ?? 0) > policy.commercial.largeProjectReviewEur
    && (addressableValue === null || assessment.commercialFit.addressableScopeStatus !== "bounded");
  const delivery = dimensionByName.get("Delivery fit");
  const unusuallyLargeScope = (addressableValue ?? 0) > policy.commercial.largeProjectReviewEur
    && !(assessment.commercialFit.addressableScopeStatus === "bounded"
      && (delivery?.score ?? 0) >= 7
      && (delivery?.confidence ?? 0) >= 0.7);

  if (hardExclusion) {
    return { score, dimensions, nextStage: null, lifecycleStatus: "rejected", exceptionKind: null };
  }
  if (phase === "initial" && (score.decision === "research" || hasMaterialGaps || missingMinimum || commercialUnknown || unresolvedLargeTotal || !contactRoute.supported)) {
    return { score, dimensions, nextStage: "gap_analysis", lifecycleStatus: "needs_research", exceptionKind: null };
  }
  if (phase === "final" && (unresolvedLargeTotal || unusuallyLargeScope)) {
    return { score, dimensions, nextStage: null, lifecycleStatus: "needs_review", exceptionKind: "unusual_budget" };
  }
  if (phase === "final" && (missingMinimum || commercialUnknown)) {
    return { score, dimensions, nextStage: null, lifecycleStatus: "needs_review", exceptionKind: "commercial_fit_uncertain" };
  }
  if (phase === "final" && !contactRoute.supported) {
    return { score, dimensions, nextStage: null, lifecycleStatus: "needs_review", exceptionKind: "contact_route_unresolved" };
  }
  if (score.decision === "reject") {
    return { score, dimensions, nextStage: null, lifecycleStatus: "rejected", exceptionKind: null };
  }
  if (assessment.deliveryRoute === "partner" || assessment.deliveryRoute === "consortium") {
    return { score, dimensions, nextStage: null, lifecycleStatus: "needs_review", exceptionKind: "partner_required" };
  }
  if (score.decision === "review") {
    return {
      score,
      dimensions,
      nextStage: null,
      lifecycleStatus: "needs_review",
      exceptionKind: score.confidence < 0.62 ? "low_confidence" : "borderline_score",
    };
  }
  return { score, dimensions, nextStage: null, lifecycleStatus: "qualified", exceptionKind: null };
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
    return { ...assessment, commercialFit: { ...assessment.commercialFit, evidenceRefs: supportedRefs } };
  }
  return {
    ...assessment,
    commercialFit: {
      budgetEvidenceStatus: "unknown",
      totalProjectValueEur: null,
      addressableScopeValueEur: null,
      addressableScopeStatus: "unknown",
      confidence: Math.min(assessment.commercialFit.confidence, 0.4),
      evidenceRefs: [],
      explanation: `Unsupported commercial claim was downgraded to unknown. ${assessment.commercialFit.explanation}`.slice(0, 500),
    },
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
