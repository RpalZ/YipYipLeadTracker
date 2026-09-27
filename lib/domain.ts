export const dimensionNames = [
  "Social impact",
  "Technical fit",
  "Budget fit",
  "Timing fit",
  "Availability",
  "Delivery fit",
  "Commercial access",
  "Evidence confidence",
] as const;

export type DimensionName = (typeof dimensionNames)[number];
export type OpportunityStage =
  | "early_signal"
  | "exploring"
  | "funded"
  | "planning"
  | "selecting"
  | "formalized"
  | "closed";
export type LifecycleStatus =
  | "discovered"
  | "assessing"
  | "needs_research"
  | "ready_for_final_assessment"
  | "monitoring"
  | "needs_review"
  | "qualified"
  | "rejected"
  | "delivered";
export type DeliveryRoute = "direct" | "partner" | "nurture" | "monitor" | "unsuitable";
export type EvidenceStatus =
  | "confirmed"
  | "strongly_inferred"
  | "contradicted"
  | "not_found"
  | "unknown";

export interface ScoreDimension {
  name: DimensionName;
  score: number;
  confidence: number;
  explanation: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  type: string;
  status: EvidenceStatus;
  excerpt?: string;
}

export interface OpportunityView {
  readiness?: import("./readiness").ReadinessView | null;
  id: string;
  workspaceId?: string;
  organization: string;
  title: string;
  summary: string;
  maturityStage: OpportunityStage;
  lifecycleStatus: LifecycleStatus;
  route: DeliveryRoute;
  score: number | null;
  confidence: number | null;
  firstSeenAt: string;
  lastAssessedAt: string | null;
  latestAssessmentId?: string | null;
  latestAssessmentType?: "initial" | "final" | "human_adjusted" | null;
  signalCount: number;
  primarySignalType: string;
  location: string;
  workMode: string;
  budgetLabel: string;
  technicalDifficulty: "Low" | "Medium" | "High" | "Complex" | "Unknown";
  technicalDifficultyInferred?: boolean;
  contactLabel: string;
  contactStatus: "confirmed" | "inferred" | "unknown";
  contactEvidenceUrls?: string[];
  whyNow: string;
  suggestedNextAction: string;
  dimensions: ScoreDimension[];
  evidence: EvidenceItem[];
  missingFields: string[];
  commercialFit?: CommercialFitView | null;
  qualificationChecks?: QualificationChecksView | null;
  qualificationException?: QualificationExceptionView | null;
  attentionException?: AttentionExceptionView | null;
  qualificationResearchPending?: boolean;
  lead?: LeadReviewView | null;
  reviewCapability?: "decide" | "research_only" | "read_only";
  reviewHistory?: ReviewEventView[];
  researchCoverage?: ResearchCoverageView | null;
}

export interface ResearchCoverageView {
  passCount: number;
  queryCount: number;
  consultedSourceCount: number;
  citedSourceCount: number;
  bundles: string[];
}

export interface CommercialFitView {
  budgetEvidenceStatus: "confirmed" | "proxy" | "unknown" | "conflicting";
  totalProjectValueEur: number | null;
  addressableScopeValueEur: number | null;
  addressableScopeStatus: "bounded" | "unbounded" | "unknown";
  scopeBasis: "dedicated_package" | "explicit_lot" | "whole_procurement" | "proxy" | "unknown";
  confidence: number;
  explanation: string;
}

export interface LeadReviewView {
  id: string;
  version: number;
  status: "draft" | "in_review" | "approved" | "delivered" | "accepted" | "rejected" | "archived";
  route: DeliveryRoute;
  pendingResearch: boolean;
  outreachDraft: OutreachDraftView | null;
  origin: "automated" | "manual_promotion";
  promotedAt: string | null;
  promotionReason: string | null;
  promotionNotes: string | null;
}

export interface OutreachDraftView {
  language: "nl" | "en";
  recommendedChannel: "email" | "call" | "tender_portal" | "procurement_desk";
  emailSubject: string;
  emailBody: string;
  callOpening: string;
  discoveryQuestions: string[];
  evidenceRefs: string[];
  caveats: string[];
}

export interface QualificationChecksView {
  policyVersion: string;
  allPassed: boolean;
  hardRejection: string | null;
  checks: Record<string, "passed" | "rejected" | "unresolved" | "review">;
  reasons: string[];
  capabilityEvidence: CapabilityEvidenceView | null;
  capacityEvidence: CapacityEvidenceView | null;
}

export interface CapabilityEvidenceView {
  status: "supported" | "partial" | "unsupported" | "unknown";
  matchedServices: string[];
  unmatchedRequirements: string[];
  confidence: number;
  evidenceRefs: string[];
  explanation: string;
}

export interface CapacityEvidenceView {
  status: "available" | "limited" | "unavailable" | "unknown";
  effectiveUntil: string | null;
  expired: boolean;
  score: number;
  confidence: number;
}

export interface QualificationExceptionView {
  id: string;
  kind: string;
  summary: string;
  status: "open" | "resolved" | "dismissed";
}

export interface AttentionExceptionView extends QualificationExceptionView {
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ReviewEventView {
  id: string;
  decision: string;
  reasonCode: string | null;
  notes: string | null;
  createdAt: string;
  reviewerId: string;
  changes: Record<string, unknown>;
}

export interface DiscoveryJob {
  id: string;
  workspaceId: string;
  coverageProfileId: string;
  sourceId: string;
  name: string;
  enabled: boolean;
  model: string;
  resultLimit: number;
  maxTurns: number;
  timeoutSeconds: number;
  maxOutputTokens: number;
  estimatedCostLimit: number;
}

export interface DiscoveryRun {
  id: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed";
  createdAt: string;
  finishedAt: string | null;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  opportunitiesCreated: number;
  opportunitiesMatched: number;
  durationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  failureReason: string | null;
}

export interface DiscoveryRunResult {
  id: string;
  runId: string;
  status: "accepted" | "rejected" | "duplicate";
  title: string;
  organizationName: string;
  canonicalUrl: string | null;
  rejectionReasons: string[];
  opportunityId: string | null;
}

export interface LeadStrategy {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  version: number;
  active: boolean;
  automationEnabled: boolean;
  signalAreas: string[];
  sectors: string[];
  organizationTypes: string[];
  regions: string[];
  languages: string[];
  projectTypes: string[];
  services: string[];
  keywords: string[];
  exclusions: string[];
  hardExcludedSectors: string[];
  sensitiveSectors: string[];
  capacityStatus: "available" | "limited" | "unavailable" | "unknown";
  capacityEffectiveUntil: string | null;
  capacityNote: string | null;
  minimumProjectBudgetEur: number;
  preferredBudgetMinEur: number;
  preferredBudgetMaxEur: number;
  largeProjectReviewEur: number;
  lookbackDays: number;
  resultLimit: number;
  runCostLimit: number;
  dailyCostLimit: number;
  timezone: string;
  monitorHour: number;
  lastScoutedAt: string | null;
  nextScoutAt: string | null;
}

export interface SourceCandidate {
  id: string;
  name: string;
  sourceFamily: string;
  baseUrl: string;
  classification: "primary" | "secondary" | "aggregator" | null;
  coverageRationale: string;
  coverageGap: string | null;
  noveltyReason: string | null;
  confidence: number;
  reputationScore: number | null;
  publicAccess: boolean;
  updateFrequency: string | null;
  sampleEvidence: Array<{ title: string; url: string; relevance: string }>;
  policyChecks: Record<string, unknown>;
  estimatedMonthlyCost: number;
  status: "proposed" | "in_review" | "approved" | "rejected";
}

export interface ApprovedSource {
  id: string;
  name: string;
  sourceFamily: string;
  baseUrl: string | null;
  health: "healthy" | "degraded" | "paused" | "failing";
  scheduleEnabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  reputationScore: number | null;
}

export interface AutomationCycle {
  id: string;
  kind: "source_scout" | "source_monitor" | "opportunity_qualification";
  sourceName: string | null;
  status: "queued" | "running" | "waiting_approval" | "succeeded" | "failed" | "cancelled";
  currentStage: string;
  estimatedCost: number;
  stopReason: string | null;
  failureReason: string | null;
  createdAt: string;
  finishedAt: string | null;
  discoveryDiagnostics: DiscoveryActivityDiagnostics | null;
}

export interface DiscoveryActivityDiagnostics {
  generatedCandidates: number;
  acceptedCandidates: number;
  rejectedCandidates: number;
  programmeSignals: number;
  opportunitiesCreatedOrMatched: number;
  searchCalls: number;
  consultedUrls: number;
  rejectionCounts: Record<string, number>;
  zeroResultReason: string | null;
}

export interface AutomationException {
  id: string;
  kind: string;
  summary: string;
  status: "open" | "resolved" | "dismissed";
  opportunityId: string | null;
  sourceId: string | null;
  createdAt: string;
}

export interface DashboardData {
  readinessEnabled?: boolean;
  readinessViewerId?: string;
  readinessNotice?: string;
  opportunities: OpportunityView[];
  mode: "demo" | "supabase";
  demoMode?: "empty" | "sample";
  generatedAt: string;
  notice?: string;
}
