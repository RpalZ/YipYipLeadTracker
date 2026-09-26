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

export const sourceSignalAreas = [
  "pitching", "newsletters", "funding", "strategy", "hiring", "consultations",
  "announcements", "regional_networks", "other",
] as const;

export type SourceSignalArea = (typeof sourceSignalAreas)[number];

export const sourceProposalSchema = z.object({
  name: shortText(180),
  sourceFamily: shortText(80),
  jurisdiction: shortText(80).nullable(),
  baseUrl: agentUrlText,
  classification: z.enum(["primary", "secondary", "aggregator"]),
  publicAccess: z.boolean(),
  observedUpdateFrequency: shortText(120).nullable(),
  signalAreas: z.array(z.enum(sourceSignalAreas)).min(1).max(9),
  coverageGap: z.enum(sourceSignalAreas),
  noveltyReason: shortText(300),
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

// Keep the provider-facing contract structural. Some Responses model/tool
// combinations can return structurally valid JSON that misses a Zod-only
// semantic bound (for example maxLength or maxItems). When that happens the
// Agents SDK rejects the entire final output and redacts the failing path.
// YipYip applies the bounded sourceProposalSchema to each proposal after this
// transport parse so one malformed proposal cannot discard valid siblings.
export const sourceScoutWireOutputSchema = z.object({
  searchQueries: z.array(z.string()),
  proposals: z.array(z.object({
    name: z.string(),
    sourceFamily: z.string(),
    jurisdiction: z.string().nullable(),
    baseUrl: z.string(),
    classification: z.enum(["primary", "secondary", "aggregator"]),
    publicAccess: z.boolean(),
    observedUpdateFrequency: z.string().nullable(),
    signalAreas: z.array(z.enum(sourceSignalAreas)),
    coverageGap: z.enum(sourceSignalAreas),
    noveltyReason: z.string(),
    coverageRationale: z.string(),
    sampleEvidence: z.array(z.object({
      title: z.string(),
      url: z.string(),
      relevance: z.string(),
    }).strict()),
    policyChecks: z.object({
      permittedMethod: z.enum(["public_web_search", "public_feed", "public_api"]),
      robotsConcern: z.boolean(),
      termsConcern: z.boolean(),
      personalDataRisk: z.enum(["low", "medium", "high"]),
      note: z.string(),
    }).strict(),
    confidence: z.number(),
    estimatedMonthlyCostEur: z.number(),
  }).strict()),
}).strict();

export const sourceScoutOutputSchema = z.object({
  searchQueries: z.array(shortText(300)).min(1).max(12),
  proposals: z.array(sourceProposalSchema).max(5),
}).strict();

export const assessmentDimensionSchema = z.object({
  name: z.enum(dimensionNames),
  score: z.number().min(0).max(10),
  confidence: z.number().min(0).max(1),
  explanation: shortText(500),
  evidenceRefs: z.array(z.string().trim().min(1).max(2_048)).max(12),
}).strict();

export const qualificationEvidenceSchema = z.object({
  sector: z.object({
    categories: z.array(shortText(80)).max(8),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(z.string().trim().min(1).max(2_048)).max(12),
  }).strict(),
  capability: z.object({
    status: z.enum(["supported", "partial", "unsupported", "unknown"]),
    matchedServices: z.array(shortText(120)).max(8),
    unmatchedRequirements: z.array(shortText(160)).max(8),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(z.string().trim().min(1).max(2_048)).max(12),
    explanation: shortText(500),
  }).strict(),
  actionability: z.object({
    status: z.enum(["current", "upcoming", "expired", "unknown"]),
    actionableUntil: z.iso.date().nullable(),
    activeFollowOn: z.boolean(),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(z.string().trim().min(1).max(2_048)).max(12),
    explanation: shortText(500),
  }).strict(),
}).strict();

export const outreachDraftSchema = z.object({
  language: z.enum(["nl", "en"]),
  recommendedChannel: z.enum(["email", "call", "tender_portal", "procurement_desk"]),
  emailSubject: shortText(160),
  emailBody: shortText(1_200),
  callOpening: shortText(700),
  discoveryQuestions: z.array(shortText(240)).max(3),
  evidenceRefs: z.array(z.string().trim().min(1).max(2_048)).max(12),
  caveats: z.array(shortText(240)).max(6),
}).strict();

export const automatedAssessmentOutputSchema = z.object({
  dimensions: z.array(assessmentDimensionSchema).length(dimensionNames.length),
  commercialFit: z.object({
    budgetEvidenceStatus: z.enum(["confirmed", "proxy", "unknown", "conflicting"]),
    totalProjectValueEur: z.number().min(0).max(1_000_000_000).nullable(),
    addressableScopeValueEur: z.number().min(0).max(1_000_000_000).nullable(),
    addressableScopeStatus: z.enum(["bounded", "unbounded", "unknown"]),
    scopeBasis: z.enum(["dedicated_package", "explicit_lot", "whole_procurement", "proxy", "unknown"]),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(z.string().trim().min(1).max(2_048)).max(12),
    explanation: shortText(500),
  }).strict(),
  qualificationEvidence: qualificationEvidenceSchema,
  hardExclusion: shortText(300).nullable(),
  deliveryRoute: z.enum(["direct", "partner", "consortium", "unsuitable"]),
  whyNow: shortText(600),
  suggestedNextAction: shortText(600),
  risks: z.array(shortText(300)).max(8),
  outreachDraft: outreachDraftSchema.nullable(),
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
export type SourceScoutWireOutput = z.infer<typeof sourceScoutWireOutputSchema>;
export type AutomatedAssessmentOutput = z.infer<typeof automatedAssessmentOutputSchema>;
export type QualificationEvidence = z.infer<typeof qualificationEvidenceSchema>;
export type OutreachDraft = z.infer<typeof outreachDraftSchema>;
export type GapQuestion = z.infer<typeof gapQuestionSchema>;
export type ResearchFindingOutput = z.infer<typeof researchFindingSchema>;
