import { z } from "zod";

export const READINESS_POLICY_VERSION = "conversation-readiness-v1";
export const READINESS_INPUT_VERSION = "conversation-readiness-input-v1";
const evidence = { confidence: z.number().min(0).max(1), evidenceRefs: z.array(z.string()).max(12), rationale: z.string().max(600) };
const claim = <T extends readonly [string, ...string[]]>(values: T) => z.object({ status: z.enum(values), ...evidence }).strict();
export const buyingIntentSchema = claim(["external_demand", "unknown", "assigned_or_internal", "no_new_software"]);
export const conversationReadinessInputSchema = z.object({
  softwareNeed: claim(["concrete", "absent", "unknown"]),
  capability: claim(["transferable", "unsupported_mandatory", "unknown"]),
  buyingIntent: buyingIntentSchema,
  commercial: z.object({ status: z.enum(["confirmed_scope", "funding_proxy", "organization_size_only", "insufficient", "unknown"]),
    scopeBasis: z.enum(["dedicated_package", "whole_programme", "capacity_proxy", "unknown"]),
    addressableValueEur: z.number().min(0).nullable(), supportsMinimum: z.boolean(), ...evidence }).strict(),
  timing: z.object({ status: z.enum(["future_planning", "supplier_engagement", "active", "closed", "unknown"]),
    validUntil: z.string().nullable(), ...evidence }).strict(),
  contact: claim(["legitimate_route", "unknown"]),
  safeguards: claim(["clear", "hard_exclusion", "sensitive", "conflict", "unknown"]),
  questions: z.array(z.string().min(1).max(240)).max(3),
}).strict();
export type ConversationReadinessInput = z.infer<typeof conversationReadinessInputSchema>;
// Structural transport deliberately leaves semantic bounds to the shadow validator.
// A bad experimental claim must not discard an otherwise valid core assessment.
const wireClaim = z.object({ status: z.string(), confidence: z.number(), evidenceRefs: z.array(z.string()), rationale: z.string() }).strict();
export const buyingIntentWireSchema = wireClaim.nullable();
export const readinessWireSchema = z.object({
  softwareNeed: wireClaim, capability: wireClaim, buyingIntent: wireClaim,
  commercial: wireClaim.extend({ addressableValueEur: z.number().nullable(), supportsMinimum: z.boolean(), scopeBasis: z.string() }),
  timing: wireClaim.extend({ validUntil: z.string().nullable() }),
  contact: wireClaim, safeguards: wireClaim, questions: z.array(z.string()),
}).strict().nullable();
export const READINESS_AGENT_INSTRUCTIONS = `Separately fill conversationReadiness for a shadow experiment, without changing delivery scores or qualification evidence to make it pass. Software need statuses: concrete/absent/unknown. Capability: transferable/unsupported_mandatory/unknown; transferable engineering skills do not require previous experience with the named platform unless explicitly mandatory. Buying intent: external_demand/unknown/assigned_or_internal/no_new_software; assigned_or_internal means the whole relevant scope has no evidenced external opening. Commercial: confirmed_scope/funding_proxy/organization_size_only/insufficient/unknown. Set addressableValueEur only for a supported software package, never total programme funding. supportsMinimum requires cited grounds that suitable work could plausibly meet the strategy minimum; organization size alone is insufficient. Timing: future_planning/supplier_engagement/active/closed/unknown, with validUntil only if evidenced. Contact: legitimate_route/unknown. Safeguards: clear/hard_exclusion/sensitive/conflict/unknown. Every non-unknown claim needs confidence, allowed evidence references and a short factual rationale. No unsupported certainty. Give up to three questions for the prospect. This is not authorization to qualify, send outreach, or commit staffing. Return null if the input cannot support the rubric.`;
export type ReadinessStatus = "conversation_ready" | "monitor" | "not_suitable" | "not_evaluated";
export const READINESS_SCOPE_INSTRUCTIONS = "Commercial scopeBasis must be dedicated_package, whole_programme, capacity_proxy, or unknown. Whole-programme funding can be a cited funding proxy only; never put it in addressableValueEur. Funding proxies must leave addressableValueEur null.";
export interface ConversationReadinessEvaluation {
  policyVersion: string; status: ReadinessStatus; reasons: string[]; uncertainties: string[];
  evidenceRefs: string[]; questions: string[]; validUntil: string | null;
}
export interface ReadinessContext {
  allowedEvidenceRefs: string[]; minimumBudgetEur: number; evaluatedAt: string;
  hardRejection?: string | null;
}
export interface ReadinessView {
  id: string; assessmentId: string; createdAt: string;
  input: ConversationReadinessInput | null; result: ConversationReadinessEvaluation; evidenceAt?: string;
  labels: ReadinessLabel[];
}
export const readinessLabels = ["worth_contacting", "monitor", "pass", "insufficient_evidence"] as const;
export const readinessReasons = ["concrete_need", "commercial_potential", "budget_uncertain", "no_external_demand", "timing", "capability", "evidence_missing", "other"] as const;
export interface ReadinessLabel { id: string; reviewerId: string; label: typeof readinessLabels[number]; reason: string; notes: string | null; createdAt: string; }
export function parseDemoReadinessLabels(raw: unknown): Record<string, ReadinessLabel[]> {
  const schema = z.record(z.string(), z.array(z.object({ id: z.string(), reviewerId: z.string(), label: z.enum(readinessLabels), reason: z.enum(readinessReasons), notes: z.string().max(1000).nullable(), createdAt: z.iso.datetime() })));
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/** Shadow-only policy: no dependency on the router and no writes or model calls. */
export function evaluateConversationReadiness(raw: unknown, context: ReadinessContext): ConversationReadinessEvaluation {
  const result: ConversationReadinessEvaluation = { policyVersion: READINESS_POLICY_VERSION, status: "not_evaluated", reasons: [], uncertainties: [], evidenceRefs: [], questions: [], validUntil: null };
  const parsed = conversationReadinessInputSchema.safeParse(raw);
  if (!parsed.success) return { ...result, reasons: ["missing_or_invalid_structured_evidence"] };
  const input = parsed.data;
  const allowed = new Set(context.allowedEvidenceRefs);
  const entries = Object.entries(input).filter(([key]) => key !== "questions") as Array<[string, { status: string; confidence: number; evidenceRefs: string[]; rationale: string }]>;
  const supported = (value: { confidence: number; evidenceRefs: string[]; rationale: string }) => value.confidence >= 0.65
    && value.evidenceRefs.length > 0 && value.evidenceRefs.every((ref) => allowed.has(ref)) && Boolean(value.rationale.trim());
  if (entries.some(([, value]) => value.evidenceRefs.some((ref) => !allowed.has(ref)))) return { ...result, reasons: ["invalid_citations"] };
  const invalidClaim = entries.find(([, value]) => value.status !== "unknown" && !supported(value));
  if (invalidClaim) return { ...result, reasons: [`unsupported_claim:${invalidClaim[0]}`] };
  const date = input.timing.validUntil;
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return { ...result, reasons: ["invalid_timing_date"] };
  result.validUntil = date;
  result.evidenceRefs = [...new Set(entries.flatMap(([, value]) => value.evidenceRefs))];
  result.questions = input.questions;
  const negative = context.hardRejection ? "existing_hard_rejection"
    : input.safeguards.status === "hard_exclusion" ? "hard_exclusion"
    : input.softwareNeed.status === "absent" || input.buyingIntent.status === "no_new_software" ? "no_new_software"
    : input.buyingIntent.status === "assigned_or_internal" ? "no_external_opening"
    : input.capability.status === "unsupported_mandatory" ? "mandatory_capability_unsupported"
    : input.timing.status === "closed" || (date && `${date}T23:59:59.999Z` < new Date(context.evaluatedAt).toISOString()) ? "closed_or_expired"
    : input.commercial.status === "confirmed_scope" && input.commercial.scopeBasis === "dedicated_package" && input.commercial.addressableValueEur !== null && input.commercial.addressableValueEur < context.minimumBudgetEur ? "subminimum_addressable_scope" : null;
  if (negative) return { ...result, status: "not_suitable", reasons: [negative] };
  const checks: Record<string, boolean> = {
    software_need: input.softwareNeed.status === "concrete",
    transferable_capability: input.capability.status === "transferable",
    enquiry_timing: ["future_planning", "supplier_engagement", "active"].includes(input.timing.status),
    external_opening: input.buyingIntent.status === "external_demand" || (input.buyingIntent.status === "unknown" && ["future_planning", "supplier_engagement"].includes(input.timing.status)),
    commercial_potential: input.commercial.supportsMinimum && ((input.commercial.status === "funding_proxy" && input.commercial.scopeBasis !== "unknown" && input.commercial.addressableValueEur === null) || (input.commercial.status === "confirmed_scope" && input.commercial.scopeBasis === "dedicated_package" && input.commercial.addressableValueEur !== null && input.commercial.addressableValueEur >= context.minimumBudgetEur)),
    contact_route: input.contact.status === "legitimate_route",
    safeguards: input.safeguards.status === "clear",
  };
  const gaps = Object.entries(checks).filter(([, passed]) => !passed).map(([key]) => key);
  return { ...result, status: gaps.length ? "monitor" : "conversation_ready", reasons: gaps.length ? gaps : ["supported_exploratory_conversation"], uncertainties: [
    ...gaps,
    ...(input.commercial.status === "funding_proxy" ? ["exact_budget_and_scope_unconfirmed"] : []),
    ...(input.buyingIntent.status === "unknown" ? ["external_demand_unconfirmed"] : []),
    "no_delivery_capacity_commitment",
  ] };
}

/** Historical prose is not reinterpreted as evidence. Only the exact v1 field maps. */
export function historicalReadinessInput(snapshot: unknown): unknown {
  if (!snapshot || typeof snapshot !== "object") return null;
  const row = snapshot as Record<string, unknown>;
  return row.conversationReadiness ?? null;
}

/** Explicit legacy mappings preserve usable facts, but never fill missing rubric fields. */
export function historicalReadinessCoverage(snapshot: unknown, findings: Array<{ field: string; value?: unknown }> = []) {
  const source = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  const qualification = source.qualificationEvidence && typeof source.qualificationEvidence === "object" ? source.qualificationEvidence as Record<string, unknown> : {};
  const capability = z.object({ status: z.string(), confidence: z.number(), evidenceRefs: z.array(z.string()), explanation: z.string() }).safeParse(qualification.capability);
  const timing = z.object({ status: z.string(), actionableUntil: z.string().nullable(), activeFollowOn: z.boolean(), confidence: z.number(), evidenceRefs: z.array(z.string()), explanation: z.string() }).safeParse(qualification.actionability);
  const commercial = z.object({ budgetEvidenceStatus: z.string(), addressableScopeStatus: z.string(), scopeBasis: z.string(), addressableScopeValueEur: z.number().nullable(), confidence: z.number(), evidenceRefs: z.array(z.string()), explanation: z.string() }).safeParse(source.commercialFit);
  const mapped: Record<string, unknown> = {};
  if (capability.success && capability.data.status === "supported") mapped.capability = { status: "transferable", confidence: capability.data.confidence, evidenceRefs: capability.data.evidenceRefs, rationale: capability.data.explanation };
  // "Unsupported" legacy fit is not necessarily an unsupported mandatory requirement.
  if (timing.success && (timing.data.status === "current" || (timing.data.status === "expired" && !timing.data.activeFollowOn))) mapped.timing = {
    status: timing.data.status === "current" ? "active" : "closed", validUntil: timing.data.actionableUntil,
    confidence: timing.data.confidence, evidenceRefs: timing.data.evidenceRefs, rationale: timing.data.explanation,
  };
  if (commercial.success && commercial.data.budgetEvidenceStatus === "confirmed" && commercial.data.addressableScopeStatus === "bounded" && ["dedicated_package", "explicit_lot"].includes(commercial.data.scopeBasis)) mapped.commercial = {
    status: "confirmed_scope", scopeBasis: "dedicated_package", addressableValueEur: commercial.data.addressableScopeValueEur,
    confidence: commercial.data.confidence, evidenceRefs: commercial.data.evidenceRefs, rationale: commercial.data.explanation,
  };
  // Legacy finding values are free text, not machine-readable business classifications.
  const structuredFindings = findings.filter((finding) => finding.value !== null && typeof finding.value === "object");
  return { mappingVersion: "legacy-readiness-map-v1", mapped,
    missingFields: ["softwareNeed", "capability", "buyingIntent", "commercial", "timing", "contact", "safeguards"].filter((field) => !(field in mapped)),
    unmappedFindingCount: findings.length - structuredFindings.length,
    note: "Partial mappings are not a complete readiness input. Text findings are not guessed into classifications." };
}

export function readinessApplicability(view: ReadinessView, latestAssessmentId: string | null | undefined, now = new Date()): "current" | "superseded" | "expired" {
  if (view.assessmentId !== latestAssessmentId) return "superseded";
  if (view.result.validUntil && new Date(`${view.result.validUntil}T23:59:59.999Z`) < now) return "expired";
  // No dated signal can be considered current indefinitely.
  if (now.getTime() - Date.parse(view.evidenceAt ?? view.createdAt) > 90 * 86400_000) return "expired";
  return "current";
}

export function readinessMetrics(items: Array<{ evaluation: ReadinessView; current: boolean; qualified: boolean }>) {
  const latest = items.filter((item) => item.current);
  const judgments = latest.flatMap((item) => {
    const seen = new Set<string>();
    return [...item.evaluation.labels].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).filter((label) => {
      if (seen.has(label.reviewerId)) return false;
      seen.add(label.reviewerId); return true;
    }).map((label) => ({ ...item, label }));
  });
  const expected = { conversation_ready: "worth_contacting", monitor: "monitor", not_suitable: "pass", not_evaluated: "insufficient_evidence" };
  // Abstentions / missing-model-evidence are coverage gaps, not model accuracy.
  const comparable = judgments.filter((item) => item.label.label !== "insufficient_evidence" && item.evaluation.result.status !== "not_evaluated");
  return { evaluated: latest.filter((item) => item.evaluation.result.status !== "not_evaluated").length,
    labels: judgments.length, comparable: comparable.length,
    disagreements: comparable.filter((item) => expected[item.evaluation.result.status] !== item.label.label).length,
    falseNegativeCandidates: new Set(judgments.filter((item) => item.label.label === "worth_contacting" && !item.qualified).map((item) => item.evaluation.assessmentId)).size };
}
