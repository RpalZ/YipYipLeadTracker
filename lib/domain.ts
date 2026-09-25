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
  lead?: LeadReviewView | null;
  reviewCapability?: "decide" | "research_only" | "read_only";
  reviewHistory?: ReviewEventView[];
}

export interface CommercialFitView {
  budgetEvidenceStatus: "confirmed" | "proxy" | "unknown" | "conflicting";
  totalProjectValueEur: number | null;
  addressableScopeValueEur: number | null;
  addressableScopeStatus: "bounded" | "unbounded" | "unknown";
  confidence: number;
  explanation: string;
}

export interface LeadReviewView {
  id: string;
  version: number;
  status: "draft" | "in_review" | "approved" | "delivered" | "accepted" | "rejected" | "archived";
  route: DeliveryRoute;
  pendingResearch: boolean;
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
  status: "queued" | "running" | "waiting_approval" | "succeeded" | "failed" | "cancelled";
  currentStage: string;
  estimatedCost: number;
  stopReason: string | null;
  failureReason: string | null;
  createdAt: string;
  finishedAt: string | null;
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
  opportunities: OpportunityView[];
  mode: "demo" | "supabase";
  demoMode?: "empty" | "sample";
  generatedAt: string;
  notice?: string;
}
