import "server-only";
import { readinessEnabled } from "@/lib/readiness-config";
import { buildReadinessSnapshot } from "@/lib/readiness-snapshot";
import { buyingIntentSchema } from "@/lib/readiness";

import { randomUUID } from "node:crypto";

import { runAssessmentAgent, runGapAnalysisAgent, runResearchAgent, runSourceScoutAgent } from "@/lib/automation/agent-runtime";
import { resolveAutomationExecutionTiming } from "@/lib/automation/runtime-config";
import { automationErrorIsRetryable, describeAutomationError, writeAutomationLog } from "@/lib/automation/diagnostics";
import type { AutomatedAssessmentOutput, AutomationStage, ResearchFindingOutput } from "@/lib/automation/contracts";
import { buildSourceCoverageContext, selectDiverseSourceProposals, type SourceCoverageRecord } from "@/lib/automation/source-coverage";
import { MAX_RESEARCH_ATTEMPTS_PER_QUESTION, MAX_RESEARCH_PASSES, ensureQualificationResearchQuestions, evaluateCostLimit, resolveActionableContactRoute, routeAssessment, selectResearchBundle, sourceScoutCompletion, validateCommercialFitEvidence, validateResearchPass, validateSourceProposalEvidence } from "@/lib/automation/pipeline";
import { buildSearchPlanSnapshot, defaultLeadStrategy, evaluateSourceReputation, sourceSuppressionFingerprint, type LeadStrategyInput } from "@/lib/automation/strategy";
import { mapOpportunityDashboardRow, type DashboardRow } from "@/lib/data/opportunities";
import type { DiscoveryProfileCriteria, ValidatedDiscoveryResult } from "@/lib/discovery/contracts";
import { runDiscoveryAgent } from "@/lib/discovery/runtime";
import { evaluateDiscoveryHealth } from "@/lib/discovery/health";
import { normalizeIdentity, resolveSignalSourceItemId, validateDiscoveryOutput } from "@/lib/discovery/validation";
import type { DiscoveryRunHealthInput } from "@/lib/discovery/contracts";
import type { OpportunityView } from "@/lib/domain";
import { initialPolicy, type ScoringPolicy } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

type AdminClient = ReturnType<typeof createAdminClient>;

interface ClaimedStage {
  id: string;
  workspace_id: string;
  workflow_run_id: string;
  stage: AutomationStage;
  attempt: number;
  pass: number;
  lease_token: string;
  input_snapshot: Record<string, unknown>;
}

interface WorkflowRow {
  id: string;
  kind: "source_scout" | "source_monitor" | "opportunity_qualification";
  workspace_id: string;
  coverage_profile_id: string;
  source_id: string | null;
  opportunity_id: string | null;
  cost_limit: number;
  estimated_cost: number;
  search_plan_snapshot: Record<string, unknown>;
}

interface CostTelemetry {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  model: string;
  promptVersion: string;
  estimatedCostEur: number;
}

class WorkflowCostLimitError extends Error {
  constructor(readonly telemetry: CostTelemetry, readonly projected: number, readonly limit: number) {
    super(`Workflow estimated cost €${projected.toFixed(4)} crossed the €${limit.toFixed(4)} limit.`);
  }
}

function enforceWorkflowCost(workflow: WorkflowRow, telemetry: CostTelemetry) {
  const evaluation = evaluateCostLimit(workflow.estimated_cost, telemetry.estimatedCostEur, workflow.cost_limit);
  if (!evaluation.allowed) throw new WorkflowCostLimitError(telemetry, evaluation.projected, workflow.cost_limit);
}

function strategyFromRow(row: Record<string, unknown>): LeadStrategyInput {
  const fallback = defaultLeadStrategy(String(row.workspace_id));
  return {
    ...fallback,
    workspaceId: String(row.workspace_id),
    name: String(row.name ?? fallback.name),
    description: String(row.description ?? fallback.description),
    signalAreas: Array.isArray(row.signal_areas) ? row.signal_areas.map(String) : fallback.signalAreas,
    sectors: Array.isArray(row.sectors) ? row.sectors.map(String) : fallback.sectors,
    organizationTypes: Array.isArray(row.organization_types) ? row.organization_types.map(String) : fallback.organizationTypes,
    regions: Array.isArray(row.regions) ? row.regions.map(String) : fallback.regions,
    languages: Array.isArray(row.languages) ? row.languages.map(String) : fallback.languages,
    projectTypes: Array.isArray(row.project_types) ? row.project_types.map(String) : fallback.projectTypes,
    services: Array.isArray(row.technical_themes) ? row.technical_themes.map(String) : fallback.services,
    impactThemes: Array.isArray(row.impact_themes) ? row.impact_themes.map(String) : fallback.impactThemes,
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : fallback.keywords,
    exclusions: Array.isArray(row.negative_terms) ? row.negative_terms.map(String) : fallback.exclusions,
    hardExcludedSectors: Array.isArray(row.hard_excluded_sectors) ? row.hard_excluded_sectors.map(String) : fallback.hardExcludedSectors,
    sensitiveSectors: Array.isArray(row.sensitive_sectors) ? row.sensitive_sectors.map(String) : fallback.sensitiveSectors,
    projectClues: Array.isArray(row.project_clues) ? row.project_clues.map(String) : fallback.projectClues,
    capacityStatus: ["available", "limited", "unavailable", "unknown"].includes(String(row.capacity_status))
      ? row.capacity_status as LeadStrategyInput["capacityStatus"]
      : fallback.capacityStatus,
    capacityEffectiveUntil: typeof row.capacity_effective_until === "string" ? row.capacity_effective_until : null,
    capacityNote: typeof row.capacity_note === "string" ? row.capacity_note : null,
    minimumProjectBudgetEur: Number(row.minimum_project_budget_eur ?? fallback.minimumProjectBudgetEur),
    preferredBudgetMinEur: Number(row.preferred_budget_min_eur ?? fallback.preferredBudgetMinEur),
    preferredBudgetMaxEur: Number(row.preferred_budget_max_eur ?? fallback.preferredBudgetMaxEur),
    largeProjectReviewEur: Number(row.large_project_review_eur ?? fallback.largeProjectReviewEur),
    lookbackDays: Number(String(row.lookback ?? "90").match(/\d+/)?.[0] ?? 90),
    resultLimit: Number(row.result_limit ?? 5),
    runCostLimit: Number(row.cost_limit ?? 0.5),
    dailyCostLimit: Number(row.daily_cost_limit ?? 2.5),
    timezone: String(row.timezone ?? "Europe/Amsterdam"),
    monitorHour: Number(row.monitor_hour ?? 7),
  };
}

function jsonObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function jsonStringArray(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function loadSourceCoverageRecords(
  admin: AdminClient,
  workspaceId: string,
  coverageProfileId: string,
): Promise<SourceCoverageRecord[]> {
  const [candidateResult, sourceResult] = await Promise.all([
    admin.from("discovery_source_candidates")
      .select("name,base_url,source_family,status,proposed_config")
      .eq("workspace_id", workspaceId)
      .eq("coverage_profile_id", coverageProfileId),
    admin.from("source_registry")
      .select("name,base_url,source_family,search_config")
      .eq("workspace_id", workspaceId)
      .not("approved_at", "is", null),
  ]);
  if (candidateResult.error) throw candidateResult.error;
  if (sourceResult.error) throw sourceResult.error;

  return [
    ...(candidateResult.data ?? []).map((candidate) => ({
      name: candidate.name,
      baseUrl: candidate.base_url,
      sourceFamily: candidate.source_family,
      signalAreas: jsonStringArray(jsonObject(candidate.proposed_config).signalAreas),
      status: candidate.status,
    })),
    ...(sourceResult.data ?? []).flatMap((source) => source.base_url ? [{
      name: source.name,
      baseUrl: source.base_url,
      sourceFamily: source.source_family,
      signalAreas: jsonStringArray(jsonObject(source.search_config).signalAreas),
      status: "approved" as const,
    }] : []),
  ];
}

function profileCriteria(strategy: LeadStrategyInput): DiscoveryProfileCriteria {
  return {
    lookbackDays: strategy.lookbackDays,
    minimumConfidence: 0.65,
    restrictedHosts: ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "x.com"],
    region: strategy.regions.join(", "),
    languages: strategy.languages,
    signalAreas: strategy.signalAreas,
    projectIntents: strategy.projectTypes,
    sectors: strategy.sectors,
    organizationTypes: strategy.organizationTypes,
    services: strategy.services,
    impactThemes: strategy.impactThemes,
    keywords: strategy.keywords,
    projectClues: strategy.projectClues,
    exclusions: strategy.exclusions,
    hardExcludedSectors: strategy.hardExcludedSectors,
    sensitiveSectors: strategy.sensitiveSectors,
    minimumProjectBudgetEur: strategy.minimumProjectBudgetEur,
    preferredBudgetMinEur: strategy.preferredBudgetMinEur,
    preferredBudgetMaxEur: strategy.preferredBudgetMaxEur,
    largeProjectReviewEur: strategy.largeProjectReviewEur,
  };
}

function usageOf(telemetry: {
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  model: string;
  promptVersion: string;
  webSearchCallCount?: number;
  maxWebSearchCalls?: number | null;
  consultedUrls?: string[];
  searchQueries?: string[];
  pricingVersion?: string;
  usdToEurRate?: number;
}) {
  return {
    inputTokens: telemetry.inputTokens,
    cachedInputTokens: telemetry.cachedInputTokens ?? 0,
    outputTokens: telemetry.outputTokens,
    totalTokens: telemetry.totalTokens,
    durationMs: telemetry.durationMs,
    model: telemetry.model,
    promptVersion: telemetry.promptVersion,
    webSearchCallCount: telemetry.webSearchCallCount ?? 0,
    maxWebSearchCalls: telemetry.maxWebSearchCalls ?? null,
    consultedUrls: telemetry.consultedUrls ?? [],
    searchQueries: telemetry.searchQueries ?? [],
    pricingVersion: telemetry.pricingVersion ?? null,
    usdToEurRate: telemetry.usdToEurRate ?? null,
  };
}

async function complete(
  admin: AdminClient,
  stage: ClaimedStage,
  output: Record<string, unknown>,
  usage: Record<string, unknown> = {},
  cost = 0,
  nextStage: AutomationStage | null = null,
  terminalStatus: "waiting_approval" | "succeeded" | "failed" | null = null,
) {
  const { error } = await admin.rpc("complete_automation_stage", {
    p_stage_run_id: stage.id,
    p_lease_token: stage.lease_token,
    p_output: output as unknown as Json,
    p_usage: usage as unknown as Json,
    p_estimated_cost: cost,
    p_next_stage: nextStage ?? undefined,
    p_terminal_status: terminalStatus ?? undefined,
  });
  if (error) throw error;
}

async function loadStrategy(admin: AdminClient, workflow: WorkflowRow) {
  const { data, error } = await admin.from("discovery_coverage_profiles").select("*").eq("id", workflow.coverage_profile_id).single();
  if (error) throw error;
  return { row: data as Record<string, unknown>, strategy: strategyFromRow(data as Record<string, unknown>) };
}

async function loadOpportunity(admin: AdminClient, opportunityId: string): Promise<OpportunityView> {
  const { data, error } = await admin.from("opportunity_dashboard").select("*").eq("id", opportunityId).single();
  if (error) throw error;
  return mapOpportunityDashboardRow(data as DashboardRow);
}

function scoringPolicyForStrategy(strategy: LeadStrategyInput, strategyVersion: number): ScoringPolicy {
  return {
    ...initialPolicy,
    version: `${initialPolicy.version}/strategy-v${strategyVersion}`,
    commercial: {
      minimumProjectBudgetEur: strategy.minimumProjectBudgetEur,
      preferredBudgetMinEur: strategy.preferredBudgetMinEur,
      preferredBudgetMaxEur: strategy.preferredBudgetMaxEur,
      largeProjectReviewEur: strategy.largeProjectReviewEur,
    },
  };
}

async function ensureScorePolicy(admin: AdminClient, workspaceId: string, policy: ScoringPolicy): Promise<string> {
  const result = await admin.rpc("ensure_current_score_policy", {
    p_workspace_id: workspaceId,
    p_version: policy.version,
    p_weights: policy.weights as unknown as Json,
    p_thresholds: {
      firstThreshold: policy.firstThreshold,
      finalThreshold: policy.finalThreshold,
      reviewBand: policy.reviewBand,
      confidenceFloor: policy.confidenceFloor,
      minimumDimensionScore: policy.minimumDimensionScore,
      minimumDimensionConfidence: policy.minimumDimensionConfidence,
      commercial: policy.commercial,
      commercialThresholdsSource: "lead_strategy",
    } as unknown as Json,
  });
  if (result.error) throw result.error;
  return result.data;
}

async function persistAssessment(
  admin: AdminClient,
  workflow: WorkflowRow,
  strategy: LeadStrategyInput,
  strategyVersion: number,
  phase: "initial" | "final",
  assessment: AutomatedAssessmentOutput,
  opportunity: OpportunityView,
  findings: ResearchFindingOutput[],
  allowedEvidenceRefs: string[],
  telemetry: { model: string; promptVersion: string; inputTokens: number; outputTokens: number; totalTokens: number; durationMs: number },
) {
  if (!workflow.opportunity_id) throw new Error("Qualification workflow has no Opportunity.");
  const validatedAssessment = validateCommercialFitEvidence(assessment, allowedEvidenceRefs);
  const contactRoute = resolveActionableContactRoute(opportunity, findings);
  const hasMaterialGaps = phase === "initial" && (
    validatedAssessment.dimensions.some((dimension) => dimension.confidence < 0.7)
    || validatedAssessment.commercialFit.budgetEvidenceStatus === "unknown"
    || validatedAssessment.commercialFit.addressableScopeStatus === "unknown"
    || validatedAssessment.qualificationEvidence.capability.status === "unknown"
    || validatedAssessment.qualificationEvidence.capability.status === "partial"
    || validatedAssessment.qualificationEvidence.actionability.status === "unknown"
    || strategy.capacityStatus === "unknown"
    || !contactRoute.supported
  );
  const policy = scoringPolicyForStrategy(strategy, strategyVersion);
  const route = routeAssessment(validatedAssessment, phase, hasMaterialGaps, policy, contactRoute, {
    hardExcludedSectors: strategy.hardExcludedSectors,
    sensitiveSectors: strategy.sensitiveSectors,
    capacityStatus: strategy.capacityStatus,
    capacityEffectiveUntil: strategy.capacityEffectiveUntil,
  });
  const policyId = await ensureScorePolicy(admin, workflow.workspace_id, policy);
  const inserted = await admin.from("assessments").insert({
    workspace_id: workflow.workspace_id,
    opportunity_id: workflow.opportunity_id,
    assessment_type: phase,
    profile_version: `lead-strategy-v${strategyVersion}`,
    score_policy_id: policyId,
    dimension_results: route.dimensions as unknown as Json,
    commercial_fit: validatedAssessment.commercialFit,
    qualification_checks: route.qualificationChecks as unknown as Json,
    overall_score: route.score.score,
    overall_confidence: route.score.confidence,
    decision: route.score.decision,
    delivery_route: assessment.deliveryRoute,
    rejection_reason: route.score.hardExclusion ? { hardRule: route.score.hardExclusion } : null,
    evidence_snapshot: assessment.dimensions.flatMap((dimension) => dimension.evidenceRefs),
    execution_metadata: {
      automated: true,
      model: telemetry.model,
      promptVersion: telemetry.promptVersion,
      strategyVersion,
      ...(readinessEnabled() ? { readinessEvidenceRefs: allowedEvidenceRefs } : {}),
      capacity: {
        status: strategy.capacityStatus,
        effectiveUntil: strategy.capacityEffectiveUntil,
      },
      usage: usageOf(telemetry),
    },
    assessed_by: null,
  }).select("id,created_at").single();
  if (inserted.error) throw inserted.error;
  if (phase === "final" && readinessEnabled()) {
    // Shadow writes are isolated: failure cannot reroute or fail qualification.
    try {
      const snapshot = buildReadinessSnapshot(assessment.conversationReadiness, {
        allowedEvidenceRefs, minimumBudgetEur: policy.commercial.minimumProjectBudgetEur,
        evaluatedAt: inserted.data.created_at, hardRejection: route.qualificationChecks.hardRejection,
      });
      const shadow = await admin.from("conversation_readiness_evaluations").upsert({
        workspace_id: workflow.workspace_id, opportunity_id: workflow.opportunity_id,
        assessment_id: inserted.data.id, policy_version: snapshot.result.policyVersion,
        input_fingerprint: snapshot.fingerprint, input_snapshot: snapshot.input as unknown as Json,
        result: snapshot.result as unknown as Json,
        provenance: { source: "final_assessment", context: snapshot.context } as unknown as Json,
      }, { onConflict: "assessment_id,input_fingerprint,policy_version", ignoreDuplicates: true });
      writeAutomationLog(shadow.error ? "warn" : "info", "readiness.evaluated", {
        assessmentId: inserted.data.id, status: snapshot.result.status,
        reasons: snapshot.result.reasons, ...(shadow.error ? { errorCode: shadow.error.code } : {}),
      });
    } catch {
      writeAutomationLog("warn", "readiness.persistence_failed", { assessmentId: inserted.data.id });
    }
  }
  return { route, assessment: validatedAssessment, assessmentId: inserted.data.id, contactRoute };
}

function signalType(value: string): "funding" | "hiring" | "pitch" | "strategy" | "project" | "consultation" | "policy" | "roadmap" | "other" {
  if (value === "pitching") return "pitch";
  if (["funding", "hiring", "strategy", "project", "consultation", "policy", "roadmap"].includes(value)) {
    return value as "funding" | "hiring" | "strategy" | "project" | "consultation" | "policy" | "roadmap";
  }
  if (value === "announcement" || value === "announcements") return "project";
  return "other";
}

function researchValueText(value: Json | null): string | null {
  if (value === null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.trim() ? text.slice(0, 600) : null;
}

async function updateSourceHealth(admin: AdminClient, workflow: WorkflowRow) {
  if (!workflow.source_id) return;
  const sourceResult = await admin.from("source_registry").select("health,enabled,schedule_enabled").eq("id", workflow.source_id).single();
  if (sourceResult.error) throw sourceResult.error;
  const workflows = await admin.from("automation_workflow_runs")
    .select("id,status,stop_reason,error_code,created_at")
    .eq("source_id", workflow.source_id)
    .eq("kind", "source_monitor")
    .in("status", ["succeeded", "failed"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (workflows.error) throw workflows.error;
  if (!(workflows.data ?? []).some((item) => item.id === workflow.id)) return;
  const workflowIds = (workflows.data ?? []).map((item) => item.id);
  const normalization = workflowIds.length
    ? await admin.from("automation_stage_runs").select("workflow_run_id,output_snapshot").in("workflow_run_id", workflowIds).eq("stage", "normalize").eq("status", "succeeded")
    : { data: [], error: null };
  if (normalization.error) throw normalization.error;
  const resultsByWorkflow = new Map((normalization.data ?? []).map((item) => {
    const output = item.output_snapshot && typeof item.output_snapshot === "object" && !Array.isArray(item.output_snapshot)
      ? item.output_snapshot as Record<string, Json | undefined> : {};
    return [item.workflow_run_id, Array.isArray(output.results) ? output.results : []];
  }));
  const recentRuns: DiscoveryRunHealthInput[] = (workflows.data ?? []).map((item) => {
    const results = resultsByWorkflow.get(item.id) ?? [];
    return {
      status: item.status === "succeeded" ? "succeeded" : "failed",
      stopReason: item.stop_reason ?? (item.status === "succeeded" ? "completed" : "error"),
      acceptedCount: results.filter((result) => Boolean(result && typeof result === "object" && !Array.isArray(result) && (result as Record<string, Json | undefined>).accepted)).length,
      candidateCount: results.length,
      authenticationOrAccessFailure: ["authentication", "access_denied", "policy"].includes(item.error_code ?? ""),
    };
  });
  const evaluation = evaluateDiscoveryHealth({
    enabled: sourceResult.data.enabled && sourceResult.data.schedule_enabled,
    currentHealth: sourceResult.data.health,
    recentRuns,
  });
  const update = await admin.from("source_registry").update({
    health: evaluation.health,
    last_attempt_at: new Date().toISOString(),
    last_success_at: recentRuns[0]?.status === "succeeded" ? new Date().toISOString() : undefined,
    error_rate: evaluation.metrics.recentFailureRate,
  }).eq("id", workflow.source_id);
  if (update.error) throw update.error;
  const event = await admin.from("source_health_events").insert({
    workspace_id: workflow.workspace_id,
    source_id: workflow.source_id,
    automation_workflow_run_id: workflow.id,
    previous_health: sourceResult.data.health,
    current_health: evaluation.health,
    policy_version: evaluation.policyVersion,
    reason: evaluation.reason,
    metrics: evaluation.metrics,
    evaluated_by: null,
  });
  if (event.error) throw event.error;
}

async function enqueueQualification(admin: AdminClient, workflow: WorkflowRow, opportunityId: string, fingerprint: string) {
  const workflowId = randomUUID();
  const created = await admin.from("automation_workflow_runs").upsert({
    id: workflowId,
    workspace_id: workflow.workspace_id,
    kind: "opportunity_qualification",
    coverage_profile_id: workflow.coverage_profile_id,
    opportunity_id: opportunityId,
    trigger_kind: "signal_created",
    idempotency_key: `qualification:${opportunityId}:${fingerprint}`,
    current_stage: "first_assessment",
    search_plan_snapshot: { sourceWorkflowId: workflow.id, fingerprint },
    cost_limit: 0.75,
  }, { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
  if (created.error) throw created.error;
  if (!created.data) return;
  const stage = await admin.from("automation_stage_runs").insert({
    workspace_id: workflow.workspace_id,
    workflow_run_id: created.data.id,
    stage: "first_assessment",
    input_snapshot: { opportunityId },
  });
  if (stage.error) throw stage.error;
}

async function resolveCandidates(admin: AdminClient, workflow: WorkflowRow, results: ValidatedDiscoveryResult[]) {
  if (!workflow.source_id) throw new Error("Source monitor workflow has no approved source.");
  const opportunityIds: string[] = [];
  let programmeSignalCount = 0;
  for (const result of results.filter((item) => item.accepted)) {
    if (!result.canonicalUrl || !result.fingerprint) continue;
    const candidate = result.candidate;
    // Queued resolve retries may carry a normalization snapshot created before
    // sourceItemId became explicit. Derive the same versioned identity so those
    // durable workflows resume instead of silently dropping accepted results.
    const sourceItemId = resolveSignalSourceItemId(candidate, result.canonicalUrl, result.sourceItemId);
    // This service-only RPC serializes revisions per governed source. It also
    // reuses an unchanged fingerprint, which makes a failed-stage retry safe
    // after an earlier candidate was already persisted.
    const signal = await admin.rpc("persist_automation_signal", {
      p_workspace_id: workflow.workspace_id,
      p_source_id: workflow.source_id,
      p_signal: {
        sourceItemId,
        canonicalUrl: result.canonicalUrl,
        title: candidate.title,
        rawText: candidate.evidenceExcerpt,
        publisher: candidate.publisher,
        publishedAt: candidate.publicationDate ? `${candidate.publicationDate}T00:00:00Z` : null,
        signalType: signalType(candidate.signalType),
        organizationMentions: [candidate.organization],
        extractedFacts: {
          facts: candidate.facts,
          projectClues: candidate.projectClues,
          entitySpecificity: candidate.entitySpecificity,
          sectorCategories: candidate.sectorCategories,
          actionabilityStatus: candidate.actionabilityStatus,
          actionableUntil: candidate.actionableUntil,
          ...(buyingIntentSchema.safeParse(candidate.buyingIntent).success ? { buyingIntent: candidate.buyingIntent as Json } : {}),
        },
        extractedInferences: {
          inferences: candidate.inferences,
          whyNow: candidate.whyNow,
          activeFollowOnClue: candidate.activeFollowOnClue,
        },
        contentFingerprint: result.fingerprint,
        processingMetadata: {
          provenance_status: "confirmed",
          automated: true,
          identity_version: "web-v1",
          entitySpecificity: candidate.entitySpecificity,
          routing: candidate.entitySpecificity === "programme_only" ? "programme_monitoring" : "opportunity_resolution",
        },
      },
    }).single();
    if (signal.error) throw signal.error;
    const signalId = signal.data.signal_id;

    // Funding calls and programmes with no identified commissioning buyer or
    // concrete applicant stay as source-level monitoring Signals. Creating a
    // synthetic Organization here would turn a coverage clue into a false lead.
    if (result.programmeOnly || !result.opportunityKey) {
      programmeSignalCount += 1;
      continue;
    }

    const organization = await admin.from("organizations").upsert({
      workspace_id: workflow.workspace_id,
      name: candidate.organization,
      normalized_name: normalizeIdentity(candidate.organization),
      metadata: { location: candidate.location },
    }, { onConflict: "workspace_id,normalized_name" }).select("id").single();
    if (organization.error) throw organization.error;

    const existingOpportunity = await admin.from("opportunities").select("id").eq("workspace_id", workflow.workspace_id).eq("discovery_key", result.opportunityKey).maybeSingle();
    if (existingOpportunity.error) throw existingOpportunity.error;
    let opportunityId = existingOpportunity.data?.id;
    if (!opportunityId) {
      const opportunity = await admin.from("opportunities").insert({
        workspace_id: workflow.workspace_id,
        organization_id: organization.data.id,
        title: candidate.title,
        description: candidate.summary,
        maturity_stage: candidate.maturity,
        technical_scope: { difficulty: candidate.technicalDifficulty, work_mode: candidate.workMode, inferred: true },
        budget: { label: candidate.budgetClue ?? "Budget not confirmed", inferred: candidate.budgetClue !== null },
        timeline: { clue: candidate.timingClue },
        missing_fields: ["confirmed budget", "confirmed contact", "procurement route"],
        lifecycle_status: "discovered",
        discovery_key: result.opportunityKey,
        resolution_metadata: { contact_hint: candidate.contactClue, why_now: candidate.whyNow, exactMatch: true, entitySpecificity: candidate.entitySpecificity },
      }).select("id").single();
      if (opportunity.error) throw opportunity.error;
      opportunityId = opportunity.data.id;
    }

    const link = await admin.from("opportunity_signals").upsert({
      workspace_id: workflow.workspace_id,
      opportunity_id: opportunityId,
      signal_id: signalId,
      link_reason: "Exact deterministic source-monitor match",
    }, { onConflict: "opportunity_id,signal_id", ignoreDuplicates: true });
    if (link.error) throw link.error;
    opportunityIds.push(opportunityId);
    await enqueueQualification(admin, workflow, opportunityId, result.fingerprint);
  }
  return { opportunityIds: [...new Set(opportunityIds)], programmeSignalCount };
}

async function processStage(admin: AdminClient, stage: ClaimedStage, workflow: WorkflowRow) {
  const { row: strategyRow, strategy } = await loadStrategy(admin, workflow);
  const searchPlanSnapshot = {
    ...buildSearchPlanSnapshot(strategy, Number(strategyRow.version ?? 1)),
    ...workflow.search_plan_snapshot,
  };
  const snapshotUpdate = await admin.from("automation_workflow_runs")
    .update({ search_plan_snapshot: searchPlanSnapshot as unknown as Json })
    .eq("id", workflow.id);
  if (snapshotUpdate.error) throw snapshotUpdate.error;
  workflow.search_plan_snapshot = searchPlanSnapshot;

  if (stage.stage === "source_scout") {
    const coverageRecords = await loadSourceCoverageRecords(
      admin,
      workflow.workspace_id,
      workflow.coverage_profile_id,
    );
    const coverage = buildSourceCoverageContext(strategy.signalAreas, coverageRecords);
    const scoutSearchPlanSnapshot = { ...workflow.search_plan_snapshot, sourceScoutCoverage: coverage };
    const coverageSnapshotUpdate = await admin.from("automation_workflow_runs")
      .update({ search_plan_snapshot: scoutSearchPlanSnapshot as unknown as Json })
      .eq("id", workflow.id);
    if (coverageSnapshotUpdate.error) throw coverageSnapshotUpdate.error;
    workflow.search_plan_snapshot = scoutSearchPlanSnapshot;

    writeAutomationLog("info", "source_scout.started", {
      workspaceId: workflow.workspace_id,
      workflowId: workflow.id,
      stageRunId: stage.id,
      coveragePolicyVersion: coverage.policyVersion,
      existingSourceCount: coverage.existingSources.length,
      rejectedDomainCount: coverage.rejectedDomains.length,
      uncoveredAreas: coverage.uncoveredAreas,
      priorityAreas: coverage.priorityAreas,
    });
    const telemetry = await runSourceScoutAgent(strategy, coverage);
    enforceWorkflowCost(workflow, telemetry);
    const diversity = selectDiverseSourceProposals(telemetry.output.proposals, coverage);
    let proposed = 0;
    let rejectedForEvidence = 0;
    let suppressedCount = 0;
    for (const proposal of diversity.accepted) {
      if (!validateSourceProposalEvidence(proposal, telemetry.consultedUrls)) {
        rejectedForEvidence += 1;
        continue;
      }
      const reputation = evaluateSourceReputation(proposal);
      const suppressionFingerprint = sourceSuppressionFingerprint(proposal);
      const suppressed = await admin.from("discovery_source_candidates").select("id")
        .eq("workspace_id", workflow.workspace_id)
        .eq("suppression_fingerprint", suppressionFingerprint)
        .eq("status", "rejected")
        .maybeSingle();
      if (suppressed.error) throw suppressed.error;
      if (suppressed.data) {
        suppressedCount += 1;
        continue;
      }
      const insert = await admin.from("discovery_source_candidates").upsert({
        workspace_id: workflow.workspace_id,
        coverage_profile_id: workflow.coverage_profile_id,
        origin: "source_scout",
        name: proposal.name,
        source_family: proposal.sourceFamily,
        jurisdiction: proposal.jurisdiction,
        base_url: proposal.baseUrl,
        proposed_config: {
          signalAreas: proposal.signalAreas,
          primaryCoverageGap: proposal.coverageGap,
          permittedMethod: proposal.policyChecks.permittedMethod,
        },
        sample_evidence: proposal.sampleEvidence,
        coverage_rationale: proposal.coverageRationale,
        confidence: proposal.confidence,
        estimated_monthly_cost: proposal.estimatedMonthlyCostEur,
        governance_questions: reputation.reviewable ? [] : reputation.reasons,
        status: "proposed",
        execution_metadata: {
          automated: true,
          searchQueries: telemetry.searchQueries,
          consultedUrls: telemetry.consultedUrls,
          webSearchCallCount: telemetry.webSearchCallCount,
          noveltyReason: proposal.noveltyReason,
          coveragePolicyVersion: coverage.policyVersion,
          coverageGap: proposal.coverageGap,
          coverageBefore: coverage.coverageCounts,
        },
        reputation_score: reputation.score,
        source_classification: proposal.classification,
        public_access: proposal.publicAccess,
        observed_update_frequency: proposal.observedUpdateFrequency,
        reputation_evidence: proposal.sampleEvidence,
        policy_checks: { ...proposal.policyChecks, termsNote: proposal.policyChecks.note },
        suppression_fingerprint: suppressionFingerprint,
      }, { onConflict: "coverage_profile_id,base_url" });
      if (insert.error) throw insert.error;
      proposed += 1;
    }
    await admin.from("discovery_coverage_profiles").update({
      last_scouted_at: new Date().toISOString(),
      next_scout_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    }).eq("id", workflow.coverage_profile_id);
    const completion = sourceScoutCompletion(proposed);
    await complete(admin, stage, {
      proposalCount: proposed,
      generatedCount: telemetry.outputValidation?.generatedCount ?? telemetry.output.proposals.length,
      rejectedForContract: telemetry.outputValidation?.rejectedCount ?? 0,
      contractIssues: telemetry.outputValidation?.issues ?? [],
      rejectedForEvidence,
      suppressedCount,
      rejectedForCoverage: diversity.rejected.length,
      coverageRejectionCounts: diversity.rejectionCounts,
      uncoveredAreas: coverage.uncoveredAreas,
      priorityAreas: coverage.priorityAreas,
    }, usageOf(telemetry), telemetry.estimatedCostEur, null, completion.terminalStatus);
    writeAutomationLog("info", "source_scout.completed", {
      workspaceId: workflow.workspace_id,
      workflowId: workflow.id,
      stageRunId: stage.id,
      generatedCount: telemetry.outputValidation?.generatedCount ?? telemetry.output.proposals.length,
      proposedCount: proposed,
      rejectedForEvidence,
      rejectedForCoverage: diversity.rejected.length,
      coverageRejectionCounts: diversity.rejectionCounts,
      suppressedCount,
      uncoveredAreas: coverage.uncoveredAreas,
      searchCallCount: telemetry.webSearchCallCount,
      estimatedCostEur: telemetry.estimatedCostEur,
    });
    return { stage: stage.stage, outcome: completion.outcome, count: proposed };
  }

  if (stage.stage === "source_monitor") {
    if (!workflow.source_id) throw new Error("Source monitor workflow has no approved source.");
    const source = await admin.from("source_registry").select("name, base_url").eq("id", workflow.source_id).single();
    if (source.error) throw source.error;
    const resultLimit = Math.max(
      1,
      Math.min(5, Number(workflow.search_plan_snapshot.resultLimitOverride ?? strategy.resultLimit)),
    );
    const telemetry = await runDiscoveryAgent({
      profile: profileCriteria(strategy),
      source: { name: source.data.name, baseUrl: source.data.base_url ?? "" },
      maxCandidates: resultLimit,
    });
    enforceWorkflowCost(workflow, telemetry);
    const candidates = telemetry.output.candidates.slice(0, resultLimit);
    // A source monitor with no candidates is operationally successful: the
    // source was searched, but it did not yield a promotable signal. Persist a
    // reason and telemetry so operators can distinguish that from a broken job.
    const zeroResultReason = candidates.length
      ? null
      : telemetry.output.zeroResultReason ?? "The agent found no current concrete project signal in this source.";
    await complete(admin, stage, {
      output: {
        ...telemetry.output,
        candidates,
        zeroResultReason,
      },
      candidateCount: candidates.length,
      zeroResultReason,
      consultedUrls: telemetry.consultedUrls,
      sourceId: workflow.source_id,
    }, usageOf(telemetry), telemetry.estimatedCostEur, "normalize");
    writeAutomationLog("info", "source_monitor.completed", {
      workspaceId: workflow.workspace_id,
      workflowId: workflow.id,
      stageRunId: stage.id,
      sourceId: workflow.source_id,
      candidateCount: candidates.length,
      zeroResultReason,
      searchCallCount: telemetry.webSearchCallCount,
      consultedUrlCount: telemetry.consultedUrls.length,
      estimatedCostEur: telemetry.estimatedCostEur,
    });
    return {
      stage: stage.stage,
      outcome: "continued",
      count: candidates.length,
    };
  }

  if (stage.stage === "normalize") {
    const input = stage.input_snapshot as { output?: unknown; consultedUrls?: unknown };
    const output = input.output as Parameters<typeof validateDiscoveryOutput>[0]["output"];
    const consultedUrls = Array.isArray(input.consultedUrls) ? input.consultedUrls.map(String) : [];
    const results = validateDiscoveryOutput({ output, consultedUrls, profile: profileCriteria(strategy) });
    const acceptedCount = results.filter((result) => result.accepted).length;
    const rejectionCounts = results.flatMap((result) => result.rejectionReasons).reduce<Record<string, number>>(
      (counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }),
      {},
    );
    // Normalization is the deterministic boundary. Anything rejected here is
    // kept in the stage snapshot with machine-readable reasons and never reaches
    // Organization or Opportunity resolution.
    await complete(admin, stage, {
      results,
      generatedCount: results.length,
      acceptedCount,
      rejectedCount: results.length - acceptedCount,
      rejectionCounts,
    }, {}, 0, "resolve");
    writeAutomationLog("info", "normalization.completed", {
      workspaceId: workflow.workspace_id,
      workflowId: workflow.id,
      stageRunId: stage.id,
      generatedCount: results.length,
      acceptedCount,
      rejectedCount: results.length - acceptedCount,
      rejectionCounts,
    });
    return { stage: stage.stage, outcome: "continued", count: acceptedCount };
  }

  if (stage.stage === "resolve") {
    const results = Array.isArray(stage.input_snapshot.results) ? stage.input_snapshot.results as unknown as ValidatedDiscoveryResult[] : [];
    const resolved = await resolveCandidates(admin, workflow, results);
    await complete(admin, stage, {
      opportunityIds: resolved.opportunityIds,
      opportunityCount: resolved.opportunityIds.length,
      programmeSignalCount: resolved.programmeSignalCount,
      acceptedSignalCount: resolved.opportunityIds.length + resolved.programmeSignalCount,
    }, {}, 0, null, "succeeded");
    await updateSourceHealth(admin, workflow);
    writeAutomationLog("info", "resolution.completed", {
      workspaceId: workflow.workspace_id,
      workflowId: workflow.id,
      stageRunId: stage.id,
      acceptedSignalCount: resolved.opportunityIds.length + resolved.programmeSignalCount,
      programmeSignalCount: resolved.programmeSignalCount,
      opportunityCount: resolved.opportunityIds.length,
    });
    return { stage: stage.stage, outcome: "succeeded", count: resolved.opportunityIds.length + resolved.programmeSignalCount };
  }

  if (!workflow.opportunity_id) throw new Error("Qualification stage has no Opportunity.");
  const opportunity = await loadOpportunity(admin, workflow.opportunity_id);

  if (stage.stage === "first_assessment" || stage.stage === "final_assessment") {
    const phase = stage.stage === "first_assessment" ? "initial" : "final";
    let findings: ResearchFindingOutput[] = [];
    if (phase === "final") {
      const findingRows = await admin.from("research_findings").select("field,status,value,explanation,confidence,source_refs,created_at").eq("opportunity_id", workflow.opportunity_id).order("created_at", { ascending: false });
      if (findingRows.error) throw findingRows.error;
      findings = (findingRows.data ?? []).map((finding) => ({
        field: finding.field,
        status: finding.status,
        value: researchValueText(finding.value),
        explanation: finding.explanation,
        confidence: Number(finding.confidence),
        sourceUrls: Array.isArray(finding.source_refs) ? finding.source_refs.map(String) : [],
      }));
    }
    const telemetry = await runAssessmentAgent(opportunity, strategy, findings, phase);
    enforceWorkflowCost(workflow, telemetry);
    const allowedEvidenceRefs = [
      ...opportunity.evidence.flatMap((item) => [item.id, item.url]),
      ...findings.flatMap((finding) => finding.sourceUrls),
    ];
    const persisted = await persistAssessment(
      admin,
      workflow,
      strategy,
      Number(strategyRow.version ?? 1),
      phase,
      telemetry.output,
      opportunity,
      findings,
      allowedEvidenceRefs,
      telemetry,
    );
    const output = { assessment: persisted.assessment, assessmentId: persisted.assessmentId, route: persisted.route, contactRoute: persisted.contactRoute };
    if (phase === "initial" && persisted.route.lifecycleStatus !== "rejected") {
      const next = persisted.route.lifecycleStatus === "needs_research" ? "gap_analysis" : "final_assessment";
      await admin.from("opportunities").update({ lifecycle_status: next === "gap_analysis" ? "needs_research" : "ready_for_final_assessment" }).eq("id", workflow.opportunity_id);
      await complete(admin, stage, output, usageOf(telemetry), telemetry.estimatedCostEur, next);
    } else {
      await complete(admin, stage, output, usageOf(telemetry), telemetry.estimatedCostEur, "route");
    }
    return { stage: stage.stage, outcome: "continued", count: 1 };
  }

  if (stage.stage === "gap_analysis") {
    const assessment = stage.input_snapshot.assessment as AutomatedAssessmentOutput;
    const telemetry = await runGapAnalysisAgent(opportunity, assessment);
    enforceWorkflowCost(workflow, telemetry);
    const questions = ensureQualificationResearchQuestions(opportunity, assessment, telemetry.output.questions);
    if (questions.length) {
      const insert = await admin.from("research_questions").insert(questions.map((question, index) => ({
        workspace_id: workflow.workspace_id,
        opportunity_id: workflow.opportunity_id!,
        field: question.field,
        question: question.question,
        priority: Math.min(5, index + 1),
        decision_impact: question.decisionImpact,
        stop_rule: question.stopRule,
      })));
      if (insert.error) throw insert.error;
    }
    await complete(admin, stage, { questionCount: questions.length }, usageOf(telemetry), telemetry.estimatedCostEur, questions.length ? "research" : "final_assessment");
    return { stage: stage.stage, outcome: "continued", count: questions.length };
  }

  if (stage.stage === "research") {
    const questionRows = await admin.from("research_questions").select("*").eq("opportunity_id", workflow.opportunity_id).eq("status", "open").order("priority");
    if (questionRows.error) throw questionRows.error;
    const questions = (questionRows.data ?? []).map((question) => ({
      field: question.field,
      question: question.question,
      currentStatus: "missing" as const,
      decisionImpact: (['low', 'medium', 'high'].includes(question.decision_impact) ? question.decision_impact : 'medium') as "low" | "medium" | "high",
      researchability: "high" as const,
      stopRule: question.stop_rule ?? "Two focused searches or source exhaustion.",
    }));
    if (!questions.length) {
      await complete(admin, stage, { findingCount: 0 }, {}, 0, "final_assessment");
      return { stage: stage.stage, outcome: "continued", count: 0 };
    }
    const findingRows = await admin.from("research_findings")
      .select("question_id,field,status,value,explanation,confidence,source_refs,attempt_summary,created_at")
      .eq("opportunity_id", workflow.opportunity_id)
      .order("created_at", { ascending: false });
    if (findingRows.error) throw findingRows.error;
    const attemptsByQuestion = new Map<string, number>();
    for (const finding of findingRows.data ?? []) {
      attemptsByQuestion.set(finding.question_id, (attemptsByQuestion.get(finding.question_id) ?? 0) + 1);
    }
    const attemptsByField = Object.fromEntries((questionRows.data ?? []).map((question) => [
      question.field.trim().toLowerCase(),
      attemptsByQuestion.get(question.id) ?? 0,
    ]));
    const bundle = selectResearchBundle(questions, attemptsByField);
    if (!bundle) {
      for (const question of questionRows.data ?? []) {
        const updated = await admin.from("research_questions").update({ status: "closed_unknown" }).eq("id", question.id);
        if (updated.error) throw updated.error;
      }
      await complete(admin, stage, {
        findingCount: 0,
        unresolvedCount: 0,
        pass: stage.pass,
        stopReason: "question_attempts_exhausted",
      }, {}, 0, "final_assessment");
      return { stage: stage.stage, outcome: "continued", count: 0 };
    }
    const selectedKeys = new Set(bundle.questions.map((question) => question.field.trim().toLowerCase()));
    const selectedRows = (questionRows.data ?? []).filter((question) => selectedKeys.has(question.field.trim().toLowerCase()));
    const selectedQuestionIds = new Set(selectedRows.map((question) => question.id));
    const previousFindings: ResearchFindingOutput[] = (findingRows.data ?? [])
      .filter((finding) => selectedQuestionIds.has(finding.question_id))
      .map((finding) => ({
        field: finding.field,
        status: finding.status,
        value: researchValueText(finding.value),
        explanation: finding.explanation,
        confidence: Number(finding.confidence),
        sourceUrls: Array.isArray(finding.source_refs) ? finding.source_refs.map(String) : [],
      }));
    const telemetry = await runResearchAgent(opportunity, bundle.questions, opportunity.evidence, {
      bundleKind: bundle.kind,
      previousFindings,
      diversifiedRetry: bundle.diversifiedRetry,
    });
    enforceWorkflowCost(workflow, telemetry);
    const validation = validateResearchPass(bundle.questions, telemetry.output.findings, telemetry.consultedUrls);
    const acceptedByField = new Map(validation.acceptedFindings.map((finding) => [finding.field.trim().toLowerCase(), finding]));
    const unresolvedKeys = new Set(validation.unresolvedQuestions.map((question) => question.field.trim().toLowerCase()));
    const closedQuestionIds = new Set<string>();
    for (const questionDefinition of bundle.questions) {
      const question = selectedRows.find(
        (item) => item.field.trim().toLowerCase() === questionDefinition.field.trim().toLowerCase(),
      );
      if (!question) continue;
      const finding = acceptedByField.get(questionDefinition.field.trim().toLowerCase());
      const attemptNumber = (attemptsByQuestion.get(question.id) ?? 0) + 1;
      const terminalUnknown = !finding || finding.status === "unknown" || finding.status === "not_found";
      const persistedFinding: ResearchFindingOutput = finding ?? {
        field: question.field,
        status: "unknown",
        value: null,
        explanation: "This focused pass ended without one complete, citation-valid answer for the requested field.",
        confidence: 0,
        sourceUrls: [],
      };
      const reportedFinding = telemetry.output.findings.find(
        (item) => item.field.trim().toLowerCase() === questionDefinition.field.trim().toLowerCase(),
      );
      const inserted = await admin.from("research_findings").insert({
        workspace_id: workflow.workspace_id,
        opportunity_id: workflow.opportunity_id,
        question_id: question.id,
        field: persistedFinding.field,
        status: persistedFinding.status,
        value: persistedFinding.value as Json | null,
        explanation: persistedFinding.explanation,
        confidence: persistedFinding.confidence,
        source_refs: persistedFinding.sourceUrls,
        attempt_summary: {
          automated: true,
          pass: stage.pass,
          questionAttempt: attemptNumber,
          bundle: bundle.kind,
          diversifiedRetry: bundle.diversifiedRetry,
          searchQueries: telemetry.searchQueries,
          consultedUrls: telemetry.consultedUrls,
          citedUrls: persistedFinding.sourceUrls,
          reportedSourceUrls: reportedFinding?.sourceUrls ?? [],
          validationIssues: validation.issues,
          outcome: unresolvedKeys.has(questionDefinition.field.trim().toLowerCase()) ? "validation_incomplete" : persistedFinding.status,
        },
      });
      if (inserted.error) throw inserted.error;
      const shouldClose = !terminalUnknown || attemptNumber >= MAX_RESEARCH_ATTEMPTS_PER_QUESTION;
      if (shouldClose) {
        const updated = await admin.from("research_questions")
          .update({ status: terminalUnknown ? "closed_unknown" : "resolved" })
          .eq("id", question.id);
        if (updated.error) throw updated.error;
        closedQuestionIds.add(question.id);
      }
    }

    let remainingOpenCount = (questionRows.data?.length ?? 0) - closedQuestionIds.size;
    if (stage.pass >= MAX_RESEARCH_PASSES && remainingOpenCount > 0) {
      for (const question of questionRows.data ?? []) {
        if (closedQuestionIds.has(question.id)) continue;
        if (!selectedQuestionIds.has(question.id)) {
          const inserted = await admin.from("research_findings").insert({
            workspace_id: workflow.workspace_id,
            opportunity_id: workflow.opportunity_id,
            question_id: question.id,
            field: question.field,
            status: "unknown",
            value: null,
            explanation: "The bounded research workflow reached its pass limit before this remaining question could be established.",
            confidence: 0,
            source_refs: [],
            attempt_summary: { automated: true, pass: stage.pass, stopReason: "max_research_passes" },
          });
          if (inserted.error) throw inserted.error;
        }
        const updated = await admin.from("research_questions").update({ status: "closed_unknown" }).eq("id", question.id);
        if (updated.error) throw updated.error;
      }
      remainingOpenCount = 0;
    }
    const shouldContinue = remainingOpenCount > 0 && stage.pass < MAX_RESEARCH_PASSES;
    await complete(admin, stage, {
      findingCount: validation.acceptedFindings.length,
      unresolvedCount: remainingOpenCount,
      validationIssues: validation.issues,
      pass: stage.pass,
      bundle: bundle.kind,
      questionAttempt: bundle.attempt,
      diversifiedRetry: bundle.diversifiedRetry,
      consultedSourceCount: telemetry.consultedUrls.length,
      citedSourceCount: new Set(validation.acceptedFindings.flatMap((finding) => finding.sourceUrls)).size,
    }, usageOf(telemetry), telemetry.estimatedCostEur, shouldContinue ? "research" : "final_assessment");
    return {
      stage: stage.stage,
      outcome: shouldContinue ? "research_continues" : "continued",
      count: validation.acceptedFindings.length,
    };
  }

  if (stage.stage === "route") {
    const route = stage.input_snapshot.route as ReturnType<typeof routeAssessment>;
    const assessment = stage.input_snapshot.assessment as AutomatedAssessmentOutput;
    const contactRoute = stage.input_snapshot.contactRoute as ReturnType<typeof resolveActionableContactRoute> | undefined;
    const assessmentId = String(stage.input_snapshot.assessmentId);
    await admin.from("opportunities").update({ lifecycle_status: route.lifecycleStatus }).eq("id", workflow.opportunity_id);
    if (route.lifecycleStatus === "qualified") {
      const leadRoute = assessment.deliveryRoute === "partner" || assessment.deliveryRoute === "consortium" ? "partner" : "direct";
      const lead = await admin.rpc("create_qualified_lead_version", {
        p_workspace_id: workflow.workspace_id,
        p_opportunity_id: workflow.opportunity_id,
        p_final_assessment_id: assessmentId,
        p_why_now: assessment.whyNow,
        p_suggested_next_action: assessment.suggestedNextAction,
        p_route: leadRoute,
        p_outreach_draft: assessment.outreachDraft as unknown as Json,
        p_review_record: { automatedQualification: true, risks: assessment.risks, contactRoute } as unknown as Json,
      });
      if (lead.error) throw lead.error;
    } else if (route.lifecycleStatus === "needs_review" && route.exceptionKind) {
      const exceptionSummary = route.exceptionKind === "capability_fit_uncertain"
        ? "Technical capability fit is partial or not supported by enough evidence."
        : route.exceptionKind === "delivery_capacity_uncertain"
          ? "YipYip delivery capacity is unavailable, unknown, or outside its valid-through date."
          : `Qualification requires review: ${route.exceptionKind.replaceAll('_', ' ')}`;
      const exception = await admin.from("automation_exceptions").insert({
        workspace_id: workflow.workspace_id,
        workflow_run_id: workflow.id,
        opportunity_id: workflow.opportunity_id,
        exception_kind: route.exceptionKind,
        summary: exceptionSummary,
        details: {
          score: route.score,
          deliveryRoute: assessment.deliveryRoute,
          contactRoute,
          capabilityEvidence: route.qualificationChecks.capabilityEvidence,
          capacityEvidence: route.qualificationChecks.capacityEvidence,
        } as unknown as Json,
      });
      if (exception.error) throw exception.error;
    }
    await complete(admin, stage, { lifecycleStatus: route.lifecycleStatus }, {}, 0, null, "succeeded");
    return { stage: stage.stage, outcome: "succeeded", count: 1 };
  }

  throw new Error(`Unsupported automation stage: ${stage.stage}`);
}

export async function processOneAutomationStage({
  workerId = `next-${randomUUID()}`,
  workspaceId,
  dispatchDue = workspaceId === undefined,
}: {
  workerId?: string;
  workspaceId?: string;
  dispatchDue?: boolean;
} = {}) {
  const admin = createAdminClient();
  const timing = resolveAutomationExecutionTiming(process.env.AUTOMATION_AGENT_TIMEOUT_SECONDS);
  const dispatched = dispatchDue
    ? await admin.rpc("dispatch_due_automation", { p_limit: 10 })
    : { data: 0, error: null };
  if (dispatched.error) throw dispatched.error;
  const claimed = workspaceId
    ? await admin.rpc("claim_workspace_automation_stage", { p_workspace_id: workspaceId, p_worker_id: workerId, p_lease_seconds: timing.stageLeaseSeconds })
    : await admin.rpc("claim_automation_stage", { p_worker_id: workerId, p_lease_seconds: timing.stageLeaseSeconds });
  if (claimed.error) throw claimed.error;
  const stage = claimed.data?.[0] as ClaimedStage | undefined;
  if (!stage) {
    writeAutomationLog("info", "queue.empty", {
      workspaceId: workspaceId ?? null,
      dispatched: dispatched.data ?? 0,
      hint: workspaceId
        ? "No ready stage exists for this workspace. Queue a source monitor or inspect future available_at values."
        : "No globally due stage exists.",
    });
    return { claimed: false as const, dispatched: dispatched.data ?? 0 };
  }
  const workflowResult = await admin.from("automation_workflow_runs").select("*").eq("id", stage.workflow_run_id).single();
  if (workflowResult.error) throw workflowResult.error;
  const workflow = workflowResult.data as unknown as WorkflowRow;
  writeAutomationLog("info", "stage.started", {
    workspaceId: workflow.workspace_id,
    workflowId: stage.workflow_run_id,
    stageRunId: stage.id,
    workflowKind: workflow.kind,
    sourceId: workflow.source_id,
    opportunityId: workflow.opportunity_id,
    stage: stage.stage,
    attempt: stage.attempt,
    pass: stage.pass,
  });
  try {
    const result = await processStage(admin, stage, workflow);
    writeAutomationLog("info", "stage.completed", {
      workspaceId: workflow.workspace_id,
      workflowId: workflow.id,
      stageRunId: stage.id,
      workflowKind: workflow.kind,
      sourceId: workflow.source_id,
      opportunityId: workflow.opportunity_id,
      stage: stage.stage,
      attempt: stage.attempt,
      pass: stage.pass,
      outcome: result.outcome,
      count: result.count,
    });
    return { claimed: true as const, workflowId: workflow.id, ...result };
  } catch (error) {
    const failure = describeAutomationError(error);
    const message = failure.message;
    const costLimit = error instanceof WorkflowCostLimitError;
    const retryable = !costLimit && automationErrorIsRetryable(failure, stage.attempt);
    const errorCode = costLimit ? "cost_limit" : failure.code;
    writeAutomationLog("error", "stage.failed", {
      workspaceId: workflow.workspace_id,
      workflowId: workflow.id,
      stageRunId: stage.id,
      workflowKind: workflow.kind,
      sourceId: workflow.source_id,
      opportunityId: workflow.opportunity_id,
      stage: stage.stage,
      attempt: stage.attempt,
      pass: stage.pass,
      errorCode,
      errorName: failure.name,
      message,
      retryable,
    });
    const failed = await admin.rpc("fail_automation_stage", {
      p_stage_run_id: stage.id,
      p_lease_token: stage.lease_token,
      p_error_code: costLimit ? "cost_limit" : errorCode,
      p_failure_reason: message,
      p_retryable: retryable,
    });
    if (failed.error) throw failed.error;
    if (costLimit) {
      const stageCost = await admin.from("automation_stage_runs").update({
        usage: usageOf(error.telemetry),
        estimated_cost: error.telemetry.estimatedCostEur,
      }).eq("id", stage.id);
      if (stageCost.error) throw stageCost.error;
      const workflowCost = await admin.from("automation_workflow_runs").update({ estimated_cost: error.projected }).eq("id", workflow.id);
      if (workflowCost.error) throw workflowCost.error;
    }
    if (workflow.source_id) await updateSourceHealth(admin, workflow);
    return {
      claimed: true as const,
      workflowId: workflow.id,
      stage: stage.stage,
      outcome: retryable ? "retry_scheduled" : "failed",
      failureReason: message,
      count: 0,
    };
  }
}
