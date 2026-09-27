import { z } from "zod";
import { buyingIntentWireSchema } from "@/lib/readiness";

export const DISCOVERY_POLICY_VERSION = "discovery-validation-v3-entity-specificity";
export const DISCOVERY_PROMPT_VERSION = "yipyip-discovery-v3-entity-specificity";
export const DEFAULT_DISCOVERY_MODEL = "gpt-5.4-mini-2026-03-17";
export const DEFAULT_DISCOVERY_LIMITS = {
  maxCandidates: 5,
  maxTurns: 5,
  timeoutMs: 150_000,
  maxOutputTokens: 1_200,
  maxProviderOutputTokens: 4_000,
  estimatedCostEur: 0.5,
} as const;

const nullableShortText = (max: number) => z.string().trim().min(1).max(max).nullable();
const agentUrlText = z.string().trim().min(1).max(2_048)
  .describe("An absolute HTTPS URL returned by web search.");

export const discoveryCandidateSchema = z.object({
  title: z.string().trim().min(3).max(180),
  organization: z.string().trim().min(2).max(180),
  summary: z.string().trim().min(10).max(600),
  whyNow: z.string().trim().min(5).max(500),
  projectClues: z.array(z.string().trim().min(2).max(240)).min(1).max(8),
  maturity: z.enum(["early_signal", "exploring", "funded", "planning", "selecting", "formalized"]),
  budgetClue: nullableShortText(240),
  timingClue: nullableShortText(240),
  contactClue: nullableShortText(240),
  location: nullableShortText(180),
  workMode: nullableShortText(80),
  technicalDifficulty: z.enum(["Low", "Medium", "High", "Complex", "Unknown"]),
  entitySpecificity: z.enum(["organization_specific", "programme_only"]),
  sectorCategories: z.array(z.string().trim().min(2).max(80)).max(8),
  actionabilityStatus: z.enum(["current", "upcoming", "expired", "unknown"]),
  actionableUntil: z.iso.date().nullable(),
  activeFollowOnClue: nullableShortText(300),
  canonicalSourceUrl: agentUrlText,
  publisher: z.string().trim().min(2).max(180),
  publicationDate: z.iso.date().nullable(),
  evidenceExcerpt: z.string().trim().min(8).max(500),
  facts: z.array(z.string().trim().min(2).max(240)).min(1).max(10),
  inferences: z.array(z.string().trim().min(2).max(240)).max(10),
  signalType: z.enum(["pitching", "newsletter", "funding", "strategy", "hiring", "announcement"]),
  confidence: z.number().min(0).max(1),
}).strict();

export const discoveryAgentOutputSchema = z.object({
  searchQueries: z.array(z.string().trim().min(2).max(300)).min(1).max(12),
  candidates: z.array(discoveryCandidateSchema).max(DEFAULT_DISCOVERY_LIMITS.maxCandidates),
  zeroResultReason: nullableShortText(500)
    .describe("A concise operational reason when candidates is empty; otherwise null."),
}).strict();

export const shadowDiscoveryOutputSchema = discoveryAgentOutputSchema.extend({ candidates: z.array(discoveryCandidateSchema.extend({ buyingIntent: buyingIntentWireSchema })).max(DEFAULT_DISCOVERY_LIMITS.maxCandidates) });
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema> & { buyingIntent?: unknown };
export type DiscoveryAgentOutput = Omit<z.infer<typeof discoveryAgentOutputSchema>, "candidates"> & { candidates: DiscoveryCandidate[] };

export type DiscoveryRejectionReason =
  | "uncited_url"
  | "invalid_https_url"
  | "outside_lookback"
  | "missing_organization"
  | "missing_project_clue"
  | "missing_evidence_excerpt"
  | "low_confidence"
  | "restricted_source"
  | "duplicate_candidate";

export interface DiscoveryProfileCriteria {
  lookbackDays: number;
  minimumConfidence: number;
  restrictedHosts: string[];
  region: string;
  languages: string[];
  signalAreas: string[];
  projectIntents: string[];
  sectors: string[];
  organizationTypes: string[];
  services: string[];
  impactThemes: string[];
  keywords: string[];
  projectClues: string[];
  exclusions: string[];
  hardExcludedSectors: string[];
  sensitiveSectors: string[];
  minimumProjectBudgetEur: number;
  preferredBudgetMinEur: number;
  preferredBudgetMaxEur: number;
  largeProjectReviewEur: number;
}

export interface ValidatedDiscoveryResult {
  candidate: DiscoveryCandidate;
  canonicalUrl: string | null;
  fingerprint: string | null;
  sourceItemId: string | null;
  opportunityKey: string | null;
  programmeOnly: boolean;
  accepted: boolean;
  rejectionReasons: DiscoveryRejectionReason[];
}

export type DiscoveryRunTerminalStatus = "succeeded" | "partial" | "failed";
export type DiscoveryHealth = "healthy" | "degraded" | "paused" | "failing";

export interface DiscoveryRunHealthInput {
  status: DiscoveryRunTerminalStatus;
  stopReason: string | null;
  acceptedCount: number;
  candidateCount: number;
  authenticationOrAccessFailure?: boolean;
}

export interface HealthEvaluation {
  health: DiscoveryHealth;
  reason: string;
  policyVersion: "discovery-health-v1";
  metrics: {
    recentRunCount: number;
    recentFailureCount: number;
    recentFailureRate: number;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    latestAcceptanceRate: number;
  };
}
