import "server-only";

import type {
  CommercialFitView,
  DashboardData,
  DeliveryRoute,
  LifecycleStatus,
  OpportunityStage,
  OpportunityView,
  ScoreDimension,
} from "@/lib/domain";
import { describeAutomationError, writeAutomationLog } from "@/lib/automation/diagnostics";
import { resolveActionableContactRoute } from "@/lib/automation/pipeline";
import type { ResearchFindingOutput } from "@/lib/automation/contracts";
import { createDemoDashboardData, type DemoMode } from "@/lib/demo-mode";
import { activeQualificationOpportunityIds } from "@/lib/opportunity-attention-action-state";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface DashboardRow {
  id: string;
  workspace_id: string;
  organization: string;
  title: string;
  description: string;
  maturity_stage: OpportunityStage;
  lifecycle_status: LifecycleStatus;
  route: DeliveryRoute | null;
  score: number | null;
  confidence: number | null;
  first_seen_at: string;
  last_assessed_at: string | null;
  latest_assessment_id: string | null;
  latest_assessment_type: "initial" | "final" | "human_adjusted" | null;
  signal_count: number;
  primary_signal_type: string | null;
  location: string | null;
  budget: { label?: string; inferred?: boolean } | null;
  technical_scope: { difficulty?: OpportunityView["technicalDifficulty"]; work_mode?: string; inferred?: boolean } | null;
  contact_hint: string | null;
  why_now: string | null;
  suggested_next_action: string | null;
  dimensions: ScoreDimension[] | null;
  missing_fields: string[] | null;
  evidence: unknown;
  commercial_fit: unknown;
  qualification_checks: unknown;
  qualification_exception: unknown;
  lead_id: string | null;
  lead_version: number | null;
  lead_status: string | null;
  review_record: unknown;
  lead_research_pending: boolean | null;
  outreach_draft: unknown;
  lead_origin: string | null;
  promoted_at: string | null;
  promotion_reason: string | null;
  promotion_notes: string | null;
}

function dashboardQueryError(operation: string, error: unknown): Error {
  const source = describeAutomationError(error);
  return Object.assign(new Error(source.message, { cause: error }), {
    name: "DashboardQueryError",
    operation,
    ...(error && typeof error === "object" && "code" in error
      ? { code: String((error as { code?: unknown }).code ?? "") }
      : {}),
    ...(source.details ? { details: source.details } : {}),
    ...(source.hint ? { hint: source.hint } : {}),
  });
}

function mapCommercialFit(value: unknown): CommercialFitView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const budgetStatuses = new Set(["confirmed", "proxy", "unknown", "conflicting"]);
  const scopeStatuses = new Set(["bounded", "unbounded", "unknown"]);
  const scopeBases = new Set(["dedicated_package", "explicit_lot", "whole_procurement", "proxy", "unknown"]);
  const budgetEvidenceStatus = String(row.budgetEvidenceStatus ?? "unknown");
  const addressableScopeStatus = String(row.addressableScopeStatus ?? "unknown");
  return {
    budgetEvidenceStatus: budgetStatuses.has(budgetEvidenceStatus)
      ? budgetEvidenceStatus as CommercialFitView["budgetEvidenceStatus"]
      : "unknown",
    totalProjectValueEur: typeof row.totalProjectValueEur === "number" ? row.totalProjectValueEur : null,
    addressableScopeValueEur: typeof row.addressableScopeValueEur === "number" ? row.addressableScopeValueEur : null,
    addressableScopeStatus: scopeStatuses.has(addressableScopeStatus)
      ? addressableScopeStatus as CommercialFitView["addressableScopeStatus"]
      : "unknown",
    scopeBasis: scopeBases.has(String(row.scopeBasis))
      ? String(row.scopeBasis) as CommercialFitView["scopeBasis"]
      : "unknown",
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    explanation: typeof row.explanation === "string" ? row.explanation : "Commercial fit has not been established.",
  };
}

function mapQualificationChecks(value: unknown): OpportunityView["qualificationChecks"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const checks = row.checks && typeof row.checks === "object" && !Array.isArray(row.checks)
    ? row.checks as Record<string, "passed" | "rejected" | "unresolved" | "review">
    : {};
  const capabilityRow = row.capabilityEvidence && typeof row.capabilityEvidence === "object" && !Array.isArray(row.capabilityEvidence)
    ? row.capabilityEvidence as Record<string, unknown>
    : null;
  const capabilityStatuses = new Set(["supported", "partial", "unsupported", "unknown"]);
  const capacityRow = row.capacityEvidence && typeof row.capacityEvidence === "object" && !Array.isArray(row.capacityEvidence)
    ? row.capacityEvidence as Record<string, unknown>
    : null;
  const capacityStatuses = new Set(["available", "limited", "unavailable", "unknown"]);
  return {
    policyVersion: typeof row.policyVersion === "string" ? row.policyVersion : "unknown",
    allPassed: row.allPassed === true,
    hardRejection: typeof row.hardRejection === "string" ? row.hardRejection : null,
    checks,
    reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
    capabilityEvidence: capabilityRow ? {
      status: capabilityStatuses.has(String(capabilityRow.status))
        ? capabilityRow.status as "supported" | "partial" | "unsupported" | "unknown"
        : "unknown",
      matchedServices: Array.isArray(capabilityRow.matchedServices) ? capabilityRow.matchedServices.map(String) : [],
      unmatchedRequirements: Array.isArray(capabilityRow.unmatchedRequirements) ? capabilityRow.unmatchedRequirements.map(String) : [],
      confidence: typeof capabilityRow.confidence === "number" ? capabilityRow.confidence : 0,
      evidenceRefs: Array.isArray(capabilityRow.evidenceRefs) ? capabilityRow.evidenceRefs.map(String) : [],
      explanation: typeof capabilityRow.explanation === "string" ? capabilityRow.explanation : "",
    } : null,
    capacityEvidence: capacityRow ? {
      status: capacityStatuses.has(String(capacityRow.status))
        ? capacityRow.status as "available" | "limited" | "unavailable" | "unknown"
        : "unknown",
      effectiveUntil: typeof capacityRow.effectiveUntil === "string" ? capacityRow.effectiveUntil : null,
      expired: capacityRow.expired === true,
      score: typeof capacityRow.score === "number" ? capacityRow.score : 0,
      confidence: typeof capacityRow.confidence === "number" ? capacityRow.confidence : 0,
    } : null,
  };
}

function mapOutreachDraft(value: unknown): NonNullable<OpportunityView["lead"]>["outreachDraft"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.language !== "nl" && row.language !== "en") return null;
  const channels = new Set(["email", "call", "tender_portal", "procurement_desk"]);
  if (!channels.has(String(row.recommendedChannel))) return null;
  if (typeof row.emailSubject !== "string" || typeof row.emailBody !== "string" || typeof row.callOpening !== "string") return null;
  return {
    language: row.language,
    recommendedChannel: String(row.recommendedChannel) as "email" | "call" | "tender_portal" | "procurement_desk",
    emailSubject: row.emailSubject,
    emailBody: row.emailBody,
    callOpening: row.callOpening,
    discoveryQuestions: Array.isArray(row.discoveryQuestions) ? row.discoveryQuestions.map(String).slice(0, 3) : [],
    evidenceRefs: Array.isArray(row.evidenceRefs) ? row.evidenceRefs.map(String) : [],
    caveats: Array.isArray(row.caveats) ? row.caveats.map(String) : [],
  };
}

const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function commercialBudgetLabel(commercialFit: CommercialFitView | null, fallback: DashboardRow["budget"]): string {
  if (commercialFit?.addressableScopeValueEur !== null && commercialFit?.addressableScopeValueEur !== undefined) {
    const prefix = commercialFit.budgetEvidenceStatus === "confirmed" ? "Confirmed" : "Inferred";
    return `${prefix} · ${eur.format(commercialFit.addressableScopeValueEur)} YipYip scope`;
  }
  if (commercialFit?.totalProjectValueEur !== null && commercialFit?.totalProjectValueEur !== undefined) {
    return `Total ${eur.format(commercialFit.totalProjectValueEur)} · YipYip scope unknown`;
  }
  if (commercialFit?.budgetEvidenceStatus === "proxy") return "Supported budget proxy · amount unknown";
  return fallback?.label ? `${fallback.inferred ? "Inferred · " : ""}${fallback.label}` : "Budget not confirmed";
}

function mapEvidence(value: unknown): OpportunityView["evidence"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.url !== "string") return [];
    const allowedStatuses = new Set(["confirmed", "strongly_inferred", "contradicted", "not_found", "unknown"]);
    return [{
      id: row.id,
      title: row.title,
      publisher: typeof row.publisher === "string" ? row.publisher : "Unknown publisher",
      url: row.url,
      publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : new Date(0).toISOString(),
      type: typeof row.type === "string" ? row.type : "Unknown",
      status: allowedStatuses.has(String(row.status)) ? row.status as OpportunityView["evidence"][number]["status"] : "unknown",
      excerpt: typeof row.excerpt === "string" ? row.excerpt : undefined,
    }];
  });
}

export function mapOpportunityDashboardRow(row: DashboardRow): OpportunityView {
  const commercialFit = mapCommercialFit(row.commercial_fit);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    organization: row.organization,
    title: row.title,
    summary: row.description,
    maturityStage: row.maturity_stage,
    lifecycleStatus: row.lifecycle_status,
    route: row.route ?? "monitor",
    score: row.score,
    confidence: row.confidence,
    firstSeenAt: row.first_seen_at,
    lastAssessedAt: row.last_assessed_at,
    latestAssessmentId: row.latest_assessment_id,
    latestAssessmentType: row.latest_assessment_type,
    signalCount: row.signal_count,
    primarySignalType: row.primary_signal_type ?? "Unknown",
    location: row.location ?? "Location not confirmed",
    workMode: row.technical_scope?.work_mode ?? "Work mode unknown",
    budgetLabel: commercialBudgetLabel(commercialFit, row.budget),
    technicalDifficulty: row.technical_scope?.difficulty ?? "Unknown",
    technicalDifficultyInferred: row.technical_scope?.inferred ?? false,
    contactLabel: row.contact_hint ?? "Contact research pending",
    contactStatus: row.contact_hint ? "inferred" : "unknown",
    contactEvidenceUrls: [],
    whyNow: row.why_now ?? "A timing rationale has not been recorded yet.",
    suggestedNextAction:
      row.suggested_next_action ?? "Review the evidence and choose a next action.",
    dimensions: row.dimensions ?? [],
    evidence: mapEvidence(row.evidence),
    missingFields: row.missing_fields ?? [],
    commercialFit,
    qualificationChecks: mapQualificationChecks(row.qualification_checks),
    qualificationException: row.qualification_exception && typeof row.qualification_exception === "object" && !Array.isArray(row.qualification_exception)
      ? {
          id: String((row.qualification_exception as Record<string, unknown>).id ?? ""),
          kind: String((row.qualification_exception as Record<string, unknown>).kind ?? "unknown"),
          summary: String((row.qualification_exception as Record<string, unknown>).summary ?? "Qualification requires review."),
          status: ((row.qualification_exception as Record<string, unknown>).status === "resolved" || (row.qualification_exception as Record<string, unknown>).status === "dismissed")
            ? (row.qualification_exception as Record<string, unknown>).status as "resolved" | "dismissed"
            : "open",
        }
      : null,
    attentionException: null,
    qualificationResearchPending: Boolean(row.lead_research_pending),
    lead: row.lead_id && row.lead_version && row.lead_status ? {
      id: row.lead_id,
      version: row.lead_version,
      status: row.lead_status as NonNullable<OpportunityView["lead"]>["status"],
      route: row.route ?? "monitor",
      pendingResearch: Boolean(row.lead_research_pending),
      outreachDraft: mapOutreachDraft(row.outreach_draft),
      origin: row.lead_origin === "manual_promotion" ? "manual_promotion" : "automated",
      promotedAt: row.promoted_at,
      promotionReason: row.promotion_reason,
      promotionNotes: row.promotion_notes,
    } : null,
    reviewHistory: [],
    reviewCapability: "read_only",
  };
}

export async function getDashboardData({
  demoMode,
}: {
  demoMode?: DemoMode | null;
} = {}): Promise<DashboardData> {
  if (demoMode) return createDemoDashboardData(demoMode);

  if (!hasSupabaseEnv()) {
    return createDemoDashboardData("sample");
  }

  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return createDemoDashboardData("sample");

    const [opportunityResult, membershipResult] = await Promise.all([
      supabase.from("opportunity_dashboard").select("*").order("score", { ascending: false, nullsFirst: false }),
      supabase.from("workspace_members").select("workspace_id,role").eq("user_id", authData.user.id),
    ]);

    if (opportunityResult.error) {
      throw dashboardQueryError("opportunity_dashboard.select", opportunityResult.error);
    }
    if (membershipResult.error) {
      throw dashboardQueryError("workspace_members.select", membershipResult.error);
    }
    const mapped = ((opportunityResult.data ?? []) as DashboardRow[]).map(mapOpportunityDashboardRow);
    const roles = new Map((membershipResult.data ?? []).map((item) => [item.workspace_id, item.role]));
    const opportunityIds = mapped.map((item) => item.id);
    const [reviewResult, contactFindingResult, exceptionResult, activeWorkflowResult] = opportunityIds.length
      ? await Promise.all([
        supabase.from("review_events")
          .select("id,opportunity_id,reviewer_id,decision,reason_code,notes,changes,created_at")
          .in("opportunity_id", opportunityIds)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("research_findings")
          .select("id,opportunity_id,field,status,value,explanation,confidence,source_refs,attempt_summary,created_at")
          .in("opportunity_id", opportunityIds)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("automation_exceptions")
          .select("id,opportunity_id,exception_kind,summary,details,status,created_at")
          .in("opportunity_id", opportunityIds)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("automation_workflow_runs")
          .select("opportunity_id,kind,status")
          .in("opportunity_id", opportunityIds)
          .eq("kind", "opportunity_qualification")
          .in("status", ["queued", "running"]),
      ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (reviewResult.error) {
      throw dashboardQueryError("review_events.select", reviewResult.error);
    }
    if (contactFindingResult.error) {
      throw dashboardQueryError("research_findings.select", contactFindingResult.error);
    }
    if (exceptionResult.error) {
      throw dashboardQueryError("automation_exceptions.select", exceptionResult.error);
    }
    if (activeWorkflowResult.error) {
      throw dashboardQueryError("automation_workflow_runs.select", activeWorkflowResult.error);
    }
    const activeQualificationIds = activeQualificationOpportunityIds(activeWorkflowResult.data ?? []);
    const historyByOpportunity = new Map<string, OpportunityView["reviewHistory"]>();
    for (const event of reviewResult.data ?? []) {
      if (!event.opportunity_id) continue;
      const existing = historyByOpportunity.get(event.opportunity_id) ?? [];
      existing.push({
        id: event.id,
        decision: event.decision,
        reasonCode: event.reason_code,
        notes: event.notes,
        createdAt: event.created_at,
        reviewerId: event.reviewer_id,
        changes: event.changes && typeof event.changes === "object" && !Array.isArray(event.changes)
          ? event.changes as Record<string, unknown>
          : {},
      });
      historyByOpportunity.set(event.opportunity_id, existing);
    }
    const findingsByOpportunity = new Map<string, ResearchFindingOutput[]>();
    const researchEvidenceByOpportunity = new Map<string, OpportunityView["evidence"]>();
    const researchCoverageByOpportunity = new Map<string, {
      passes: Set<number>;
      queries: Set<string>;
      consulted: Set<string>;
      cited: Set<string>;
      bundles: Set<string>;
    }>();
    const exceptionByOpportunity = new Map<string, NonNullable<OpportunityView["attentionException"]>>();
    for (const exception of exceptionResult.data ?? []) {
      if (!exception.opportunity_id || exceptionByOpportunity.has(exception.opportunity_id)) continue;
      exceptionByOpportunity.set(exception.opportunity_id, {
        id: exception.id,
        kind: exception.exception_kind,
        summary: exception.summary,
        status: exception.status === "resolved" || exception.status === "dismissed"
          ? exception.status
          : "open",
        details: exception.details && typeof exception.details === "object" && !Array.isArray(exception.details)
          ? exception.details as Record<string, unknown>
          : {},
        createdAt: exception.created_at,
      });
    }
    for (const finding of contactFindingResult.data ?? []) {
      const existing = findingsByOpportunity.get(finding.opportunity_id) ?? [];
      const rawValue = finding.value;
      existing.push({
        field: finding.field,
        status: finding.status,
        value: typeof rawValue === "string" ? rawValue : rawValue === null ? null : JSON.stringify(rawValue),
        explanation: finding.explanation,
        confidence: Number(finding.confidence),
        sourceUrls: Array.isArray(finding.source_refs) ? finding.source_refs.map(String) : [],
      });
      findingsByOpportunity.set(finding.opportunity_id, existing);

      const sourceRefs = Array.isArray(finding.source_refs) ? finding.source_refs.map(String) : [];
      const evidence = researchEvidenceByOpportunity.get(finding.opportunity_id) ?? [];
      for (const [index, url] of sourceRefs.entries()) {
        let publisher = "Research source";
        try {
          publisher = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          // Invalid source references are ignored by the deterministic research
          // validator; keep this fallback defensive for historical rows.
        }
        evidence.push({
          id: `research-${finding.id}-${index}`,
          title: `Research: ${finding.field}`,
          publisher,
          url,
          publishedAt: finding.created_at,
          type: "Research finding",
          status: finding.status,
          excerpt: finding.explanation,
        });
      }
      researchEvidenceByOpportunity.set(finding.opportunity_id, evidence);

      const coverage = researchCoverageByOpportunity.get(finding.opportunity_id) ?? {
        passes: new Set<number>(),
        queries: new Set<string>(),
        consulted: new Set<string>(),
        cited: new Set<string>(),
        bundles: new Set<string>(),
      };
      const summary = finding.attempt_summary && typeof finding.attempt_summary === "object" && !Array.isArray(finding.attempt_summary)
        ? finding.attempt_summary as Record<string, unknown>
        : {};
      const pass = Number(summary.pass);
      if (Number.isFinite(pass)) coverage.passes.add(pass);
      if (typeof summary.bundle === "string") coverage.bundles.add(summary.bundle);
      if (Array.isArray(summary.searchQueries)) summary.searchQueries.map(String).forEach((query) => coverage.queries.add(query));
      if (Array.isArray(summary.consultedUrls)) summary.consultedUrls.map(String).forEach((url) => coverage.consulted.add(url));
      sourceRefs.forEach((url) => coverage.cited.add(url));
      researchCoverageByOpportunity.set(finding.opportunity_id, coverage);
    }

    return {
      opportunities: mapped.map((opportunity) => {
        const role = opportunity.workspaceId ? roles.get(opportunity.workspaceId) : undefined;
        const contactRoute = resolveActionableContactRoute(
          opportunity,
          findingsByOpportunity.get(opportunity.id) ?? [],
        );
        const missingFields = contactRoute.supported
          ? opportunity.missingFields.filter((field) => !/(contact|commissioning owner|procurement desk|tender channel)/i.test(field))
          : opportunity.missingFields;
        const researchEvidence = researchEvidenceByOpportunity.get(opportunity.id) ?? [];
        const knownUrls = new Set(opportunity.evidence.map((item) => item.url));
        const combinedEvidence = [...opportunity.evidence];
        for (const evidence of researchEvidence) {
          if (knownUrls.has(evidence.url)) continue;
          knownUrls.add(evidence.url);
          combinedEvidence.push(evidence);
        }
        const coverage = researchCoverageByOpportunity.get(opportunity.id);
        return {
          ...opportunity,
          contactLabel: contactRoute.label ?? opportunity.contactLabel,
          contactStatus: contactRoute.supported ? contactRoute.status : opportunity.contactStatus,
          contactEvidenceUrls: contactRoute.sourceUrls,
          evidence: combinedEvidence,
          missingFields,
          reviewCapability: role === "owner" || role === "reviewer"
            ? "decide"
            : role === "operator" ? "research_only" : "read_only",
          reviewHistory: historyByOpportunity.get(opportunity.id) ?? [],
          attentionException: exceptionByOpportunity.get(opportunity.id) ?? null,
          qualificationResearchPending:
            opportunity.qualificationResearchPending || activeQualificationIds.has(opportunity.id),
          researchCoverage: coverage ? {
            passCount: coverage.passes.size,
            queryCount: coverage.queries.size,
            consultedSourceCount: coverage.consulted.size,
            citedSourceCount: coverage.cited.size,
            bundles: [...coverage.bundles],
          } : null,
        };
      }),
      mode: "supabase",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    const failure = describeAutomationError(error);
    // Dashboard query failures previously fell back to sample data silently,
    // which made an RLS/query defect look like an empty or healthy workspace.
    // Keep the safe fallback, but make the reason visible in the server log.
    // This path is handled by an explicit sample-data fallback, so keep it
    // visible in the terminal without turning it into a Next.js dev overlay.
    writeAutomationLog("warn", "dashboard.load_failed", {
      errorCode: failure.code,
      errorName: failure.name,
      message: failure.message,
      ...(failure.operation ? { operation: failure.operation } : {}),
      ...(failure.details ? { details: failure.details } : {}),
      ...(failure.hint ? { hint: failure.hint } : {}),
    });
    return {
      ...createDemoDashboardData("sample"),
      notice: `Live workspace data could not be loaded (${failure.code}). Showing sample data.`,
    };
  }
}
