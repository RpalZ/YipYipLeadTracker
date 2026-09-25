import { z } from "zod";

import { dimensionNames } from "@/lib/domain";

export const automationStages = [
  "source_scout",
  "source_monitor",
  "normalize",
  "resolve",
  "first_assessment",
  "gap_analysis",
  "research",
  "final_assessment",
  "route",
] as const;

export type AutomationStage = (typeof automationStages)[number];
export type AutomationWorkflowKind = "source_scout" | "source_monitor" | "opportunity_qualification";

const shortText = (max: number) => z.string().trim().min(1).max(max);

// OpenAI strict structured outputs do not accept JSON Schema's `format: "uri"`.
// Keep agent-facing URLs as bounded strings, then enforce HTTPS, canonicalization,
// citation allow-listing, and source matching in the deterministic pipeline.
const agentUrlText = z.string().trim().min(1).max(2_048)
  .describe("An absolute HTTPS URL returned by web search.");

export const sourceProposalSchema = z.object({
  name: shortText(180),
  sourceFamily: shortText(80),
  jurisdiction: shortText(80).nullable(),
  baseUrl: agentUrlText,
  classification: z.enum(["primary", "secondary", "aggregator"]),
  publicAccess: z.boolean(),
  observedUpdateFrequency: shortText(120).nullable(),
  signalAreas: z.array(z.enum([
    "pitching", "newsletters", "funding", "strategy", "hiring", "consultations",
    "announcements", "regional_networks", "other",
  ])).min(1).max(9),
  coverageRationale: shortText(300),
  sampleEvidence: z.array(z.object({
    title: shortText(180),
    url: agentUrlText,
    relevance: shortText(300),
  }).strict()).min(1).max(2),
  policyChecks: z.object({
    permittedMethod: z.enum(["public_web_search", "public_feed", "public_api"]),
    robotsConcern: z.boolean(),
    termsConcern: z.boolean(),
    personalDataRisk: z.enum(["low", "medium", "high"]),
    note: shortText(250),
  }).strict(),
  confidence: z.number().min(0).max(1),
  estimatedMonthlyCostEur: z.number().min(0).max(250),
}).strict();

export const sourceScoutOutputSchema = z.object({
  searchQueries: z.array(shortText(300)).min(1).max(12),
  proposals: z.array(sourceProposalSchema).max(3),
}).strict();

export const assessmentDimensionSchema = z.object({
  name: z.enum(dimensionNames),
  score: z.number().min(0).max(10),
  confidence: z.number().min(0).max(1),
  explanation: shortText(500),
  evidenceRefs: z.array(z.string().trim().min(1).max(2_048)).max(12),
}).strict();

export const automatedAssessmentOutputSchema = z.object({
  dimensions: z.array(assessmentDimensionSchema).length(dimensionNames.length),
  commercialFit: z.object({
    budgetEvidenceStatus: z.enum(["confirmed", "proxy", "unknown", "conflicting"]),
    totalProjectValueEur: z.number().min(0).max(1_000_000_000).nullable(),
    addressableScopeValueEur: z.number().min(0).max(1_000_000_000).nullable(),
    addressableScopeStatus: z.enum(["bounded", "unbounded", "unknown"]),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(z.string().trim().min(1).max(2_048)).max(12),
    explanation: shortText(500),
  }).strict(),
  hardExclusion: shortText(300).nullable(),
  deliveryRoute: z.enum(["direct", "partner", "consortium", "unsuitable"]),
  whyNow: shortText(600),
  suggestedNextAction: shortText(600),
  risks: z.array(shortText(300)).max(8),
}).strict();

export const gapQuestionSchema = z.object({
  field: shortText(100),
  question: shortText(400),
  currentStatus: z.enum(["missing", "weak", "inferred", "conflicting", "stale"]),
  decisionImpact: z.enum(["low", "medium", "high"]),
  researchability: z.enum(["low", "medium", "high"]),
  stopRule: shortText(300),
}).strict();

export const gapAnalysisOutputSchema = z.object({
  questions: z.array(gapQuestionSchema).max(8),
}).strict();

export const researchFindingSchema = z.object({
  field: shortText(100),
  status: z.enum(["confirmed", "strongly_inferred", "contradicted", "not_found", "unknown"]),
  // Strict Structured Outputs requires every anyOf branch to have a concrete
  // JSON Schema type. Research values are concise qualification facts, so a
  // bounded nullable string is sufficient and avoids z.unknown() -> {}.
  value: shortText(600).nullable(),
  explanation: shortText(600),
  confidence: z.number().min(0).max(1),
  sourceUrls: z.array(agentUrlText).max(8),
}).strict().superRefine((finding, context) => {
  if (!['unknown', 'not_found'].includes(finding.status) && finding.sourceUrls.length === 0) {
    context.addIssue({ code: "custom", message: "Supported research findings require a source URL." });
  }
});

export const researchOutputSchema = z.object({
  findings: z.array(researchFindingSchema).min(1).max(8),
  searchQueries: z.array(shortText(300)).min(1).max(12),
}).strict();

export type SourceProposal = z.infer<typeof sourceProposalSchema>;
export type SourceScoutOutput = z.infer<typeof sourceScoutOutputSchema>;
export type AutomatedAssessmentOutput = z.infer<typeof automatedAssessmentOutputSchema>;
export type GapQuestion = z.infer<typeof gapQuestionSchema>;
export type ResearchFindingOutput = z.infer<typeof researchFindingSchema>;
