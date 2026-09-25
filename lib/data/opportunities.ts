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
import { resolveActionableContactRoute } from "@/lib/automation/pipeline";
import type { ResearchFindingOutput } from "@/lib/automation/contracts";
import { createDemoDashboardData, type DemoMode } from "@/lib/demo-mode";
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
  lead_id: string | null;
  lead_version: number | null;
  lead_status: string | null;
  review_record: unknown;
  lead_research_pending: boolean | null;
}

function mapCommercialFit(value: unknown): CommercialFitView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const budgetStatuses = new Set(["confirmed", "proxy", "unknown", "conflicting"]);
  const scopeStatuses = new Set(["bounded", "unbounded", "unknown"]);
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
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    explanation: typeof row.explanation === "string" ? row.explanation : "Commercial fit has not been established.",
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
    lead: row.lead_id && row.lead_version && row.lead_status ? {
      id: row.lead_id,
      version: row.lead_version,
      status: row.lead_status as NonNullable<OpportunityView["lead"]>["status"],
      route: row.route ?? "monitor",
      pendingResearch: Boolean(row.lead_research_pending),
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

    if (opportunityResult.error) throw opportunityResult.error;
    if (membershipResult.error) throw membershipResult.error;
    const mapped = ((opportunityResult.data ?? []) as DashboardRow[]).map(mapOpportunityDashboardRow);
    const roles = new Map((membershipResult.data ?? []).map((item) => [item.workspace_id, item.role]));
    const opportunityIds = mapped.map((item) => item.id);
    const [reviewResult, contactFindingResult] = opportunityIds.length
      ? await Promise.all([
        supabase.from("review_events")
          .select("id,opportunity_id,reviewer_id,decision,reason_code,notes,changes,created_at")
          .in("opportunity_id", opportunityIds)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("research_findings")
          .select("opportunity_id,field,status,value,explanation,confidence,source_refs,created_at")
          .in("opportunity_id", opportunityIds)
          .order("created_at", { ascending: false })
          .limit(500),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (reviewResult.error) throw reviewResult.error;
    if (contactFindingResult.error) throw contactFindingResult.error;
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
        return {
          ...opportunity,
          contactLabel: contactRoute.label ?? opportunity.contactLabel,
          contactStatus: contactRoute.supported ? contactRoute.status : opportunity.contactStatus,
          contactEvidenceUrls: contactRoute.sourceUrls,
          missingFields,
          reviewCapability: role === "owner" || role === "reviewer"
            ? "decide"
            : role === "operator" ? "research_only" : "read_only",
          reviewHistory: historyByOpportunity.get(opportunity.id) ?? [],
        };
      }),
      mode: "supabase",
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return createDemoDashboardData("sample");
  }
}
