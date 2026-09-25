import "server-only";

import { randomUUID } from "node:crypto";

import { runAssessmentAgent, runGapAnalysisAgent, runResearchAgent, runSourceScoutAgent } from "@/lib/automation/agent-runtime";
import { resolveAutomationExecutionTiming } from "@/lib/automation/runtime-config";
import { automationErrorIsRetryable, describeAutomationError, writeAutomationLog } from "@/lib/automation/diagnostics";
import type { AutomatedAssessmentOutput, AutomationStage, ResearchFindingOutput } from "@/lib/automation/contracts";
import { ensureRequiredResearchQuestions, evaluateCostLimit, resolveActionableContactRoute, routeAssessment, sourceScoutCompletion, validateCommercialFitEvidence, validateResearchPass, validateSourceProposalEvidence } from "@/lib/automation/pipeline";
import { defaultLeadStrategy, evaluateSourceReputation, sourceSuppressionFingerprint, type LeadStrategyInput } from "@/lib/automation/strategy";
import { mapOpportunityDashboardRow, type DashboardRow } from "@/lib/data/opportunities";
import type { DiscoveryProfileCriteria, ValidatedDiscoveryResult } from "@/lib/discovery/contracts";
import { runDiscoveryAgent } from "@/lib/discovery/runtime";
import { evaluateDiscoveryHealth } from "@/lib/discovery/health";
import { normalizeIdentity, validateDiscoveryOutput } from "@/lib/discovery/validation";
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
    projectClues: Array.isArray(row.project_clues) ? row.project_clues.map(String) : fallback.projectClues,
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

function profileCriteria(strategy: LeadStrategyInput): DiscoveryProfileCriteria {
  return {
    lookbackDays: strategy.lookbackDays,
    minimumConfidence: 0.65,
    restrictedHosts: ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "x.com"],
    region: strategy.regions.join(", "),
    languages: strategy.languages,
    signalAreas: strategy.signalAreas,
    projectIntents: strategy.projectTypes,
  };
}

function usageOf(telemetry: { inputTokens: number; outputTokens: number; totalTokens: number; durationMs: number; model: string; promptVersion: string; webSearchCallCount?: number; consultedUrls?: string[]; searchQueries?: string[] }) {
  return {
    inputTokens: telemetry.inputTokens,
    outputTokens: telemetry.outputTokens,
    totalTokens: telemetry.totalTokens,
    durationMs: telemetry.durationMs,
    model: telemetry.model,
    promptVersion: telemetry.promptVersion,
    webSearchCallCount: telemetry.webSearchCallCount ?? 0,
    consultedUrls: telemetry.consultedUrls ?? [],
    searchQueries: telemetry.searchQueries ?? [],
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
    || !contactRoute.supported
  );
  const policy = scoringPolicyForStrategy(strategy, strategyVersion);
  const route = routeAssessment(validatedAssessment, phase, hasMaterialGaps, policy, contactRoute);
  const policyId = await ensureScorePolicy(admin, workflow.workspace_id, policy);
  const inserted = await admin.from("assessments").insert({
    workspace_id: workflow.workspace_id,
    opportunity_id: workflow.opportunity_id,
    assessment_type: phase,
    profile_version: `lead-strategy-v${strategyVersion}`,
    score_policy_id: policyId,
    dimension_results: route.dimensions as unknown as Json,
    commercial_fit: validatedAssessment.commercialFit,
    overall_score: route.score.score,
    overall_confidence: route.score.confidence,
    decision: route.score.decision,
    delivery_route: assessment.deliveryRoute,
    rejection_reason: route.score.hardExclusion ? { hardRule: route.score.hardExclusion } : null,
    evidence_snapshot: assessment.dimensions.flatMap((dimension) => dimension.evidenceRefs),
    execution_metadata: { automated: true, model: telemetry.model, promptVersion: telemetry.promptVersion, usage: usageOf(telemetry) },
    assessed_by: null,
  }).select("id").single();
  if (inserted.error) throw inserted.error;
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
  for (const result of results.filter((item) => item.accepted)) {
    if (!result.canonicalUrl || !result.fingerprint || !result.opportunityKey) continue;
    const candidate = result.candidate;
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
        resolution_metadata: { contact_hint: candidate.contactClue, why_now: candidate.whyNow, exactMatch: true },
      }).select("id").single();
      if (opportunity.error) throw opportunity.error;
      opportunityId = opportunity.data.id;
    }

    const existingSignal = await admin.from("signals").select("id").eq("source_id", workflow.source_id).eq("canonical_url", result.canonicalUrl).eq("content_fingerprint", result.fingerprint).maybeSingle();
    if (existingSignal.error) throw existingSignal.error;
    let signalId = existingSignal.data?.id;
    if (!signalId) {
      const signal = await admin.from("signals").insert({
        workspace_id: workflow.workspace_id,
        source_id: workflow.source_id,
        source_item_id: result.canonicalUrl,
        canonical_url: result.canonicalUrl,
        title: candidate.title,
        raw_text: candidate.evidenceExcerpt,
        publisher: candidate.publisher,
        published_at: candidate.publicationDate ? `${candidate.publicationDate}T00:00:00Z` : null,
        signal_type: signalType(candidate.signalType),
        organization_mentions: [candidate.organization],
        extracted_facts: { facts: candidate.facts, projectClues: candidate.projectClues },
        extracted_inferences: { inferences: candidate.inferences, whyNow: candidate.whyNow },
        content_fingerprint: result.fingerprint,
        processing_metadata: { provenance_status: "confirmed", automated: true },
      }).select("id").single();
      if (signal.error) throw signal.error;
      signalId = signal.data.id;
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
  return [...new Set(opportunityIds)];
}

async function processStage(admin: AdminClient, stage: ClaimedStage, workflow: WorkflowRow) {
  const { row: strategyRow, strategy } = await loadStrategy(admin, workflow);

  if (stage.stage === "source_scout") {
    const telemetry = await runSourceScoutAgent(strategy);
    enforceWorkflowCost(workflow, telemetry);
    let proposed = 0;
    let rejectedForEvidence = 0;
    let suppressedCount = 0;
    for (const proposal of telemetry.output.proposals) {
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
        proposed_config: { signalAreas: proposal.signalAreas, permittedMethod: proposal.policyChecks.permittedMethod },
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
      generatedCount: telemetry.output.proposals.length,
      rejectedForEvidence,
      suppressedCount,
    }, usageOf(telemetry), telemetry.estimatedCostEur, null, completion.terminalStatus);
    return { stage: stage.stage, outcome: completion.outcome, count: proposed };
  }

  if (stage.stage === "source_monitor") {
    if (!workflow.source_id) throw new Error("Source monitor workflow has no approved source.");
    const source = await admin.from("source_registry").select("name, base_url").eq("id", workflow.source_id).single();
    if (source.error) throw source.error;
    const telemetry = await runDiscoveryAgent({
      profile: profileCriteria(strategy),
      source: { name: source.data.name, baseUrl: source.data.base_url ?? "" },
      maxCandidates: Math.max(1, Math.min(5, Number(workflow.search_plan_snapshot.resultLimitOverride ?? strategy.resultLimit))),
    });
    enforceWorkflowCost(workflow, telemetry);
    await complete(admin, stage, {
      output: {
        ...telemetry.output,
        candidates: telemetry.output.candidates.slice(
          0,
          Math.max(1, Math.min(5, Number(workflow.search_plan_snapshot.resultLimitOverride ?? strategy.resultLimit))),
        ),
      },
      consultedUrls: telemetry.consultedUrls,
      sourceId: workflow.source_id,
    }, usageOf(telemetry), telemetry.estimatedCostEur, "normalize");
    return {
      stage: stage.stage,
      outcome: "continued",
      count: telemetry.output.candidates.slice(
        0,
        Math.max(1, Math.min(5, Number(workflow.search_plan_snapshot.resultLimitOverride ?? strategy.resultLimit))),
      ).length,
    };
  }

  if (stage.stage === "normalize") {
    const input = stage.input_snapshot as { output?: unknown; consultedUrls?: unknown };
    const output = input.output as Parameters<typeof validateDiscoveryOutput>[0]["output"];
    const consultedUrls = Array.isArray(input.consultedUrls) ? input.consultedUrls.map(String) : [];
    const results = validateDiscoveryOutput({ output, consultedUrls, profile: profileCriteria(strategy) });
    await complete(admin, stage, { results }, {}, 0, "resolve");
    return { stage: stage.stage, outcome: "continued", count: results.filter((result) => result.accepted).length };
  }

  if (stage.stage === "resolve") {
    const results = Array.isArray(stage.input_snapshot.results) ? stage.input_snapshot.results as unknown as ValidatedDiscoveryResult[] : [];
    const opportunityIds = await resolveCandidates(admin, workflow, results);
    await complete(admin, stage, { opportunityIds, acceptedCount: opportunityIds.length }, {}, 0, null, "succeeded");
    await updateSourceHealth(admin, workflow);
    return { stage: stage.stage, outcome: "succeeded", count: opportunityIds.length };
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
    const telemetry = await runAssessmentAgent(opportunity, findings);
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
    const questions = ensureRequiredResearchQuestions(opportunity, telemetry.output.questions);
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
    const telemetry = await runResearchAgent(opportunity, questions, opportunity.evidence);
    enforceWorkflowCost(workflow, telemetry);
    const validation = validateResearchPass(questions, telemetry.output.findings, telemetry.consultedUrls);
    for (const finding of validation.acceptedFindings) {
      const question = questionRows.data?.find(
        (item) => item.field.trim().toLowerCase() === finding.field.trim().toLowerCase(),
      );
      if (!question) continue;
      const inserted = await admin.from("research_findings").insert({
        workspace_id: workflow.workspace_id,
        opportunity_id: workflow.opportunity_id,
        question_id: question.id,
        field: finding.field,
        status: finding.status,
        value: finding.value as Json | null,
        explanation: finding.explanation,
        confidence: finding.confidence,
        source_refs: finding.sourceUrls,
        attempt_summary: {
          automated: true,
          pass: stage.pass,
          searchQueries: telemetry.searchQueries,
          consultedUrls: telemetry.consultedUrls,
          validationIssues: validation.issues,
        },
      });
      if (inserted.error) throw inserted.error;
      await admin.from("research_questions").update({ status: finding.status === "unknown" ? "closed_unknown" : "resolved" }).eq("id", question.id);
    }
    const shouldContinue = validation.unresolvedQuestions.length > 0 && stage.pass < 2;
    if (!shouldContinue && validation.unresolvedQuestions.length) {
      for (const question of validation.unresolvedQuestions) {
        const questionRow = questionRows.data?.find(
          (item) => item.field.trim().toLowerCase() === question.field.trim().toLowerCase(),
        );
        if (!questionRow) continue;
        const inserted = await admin.from("research_findings").insert({
          workspace_id: workflow.workspace_id,
          opportunity_id: workflow.opportunity_id,
          question_id: questionRow.id,
          field: question.field,
          status: "unknown",
          value: null,
          explanation: "The bounded automated research passes ended without a complete, citation-valid answer.",
          confidence: 0,
          source_refs: [],
          attempt_summary: {
            automated: true,
            pass: stage.pass,
            stopReason: "max_research_passes",
            validationIssues: validation.issues,
            consultedUrls: telemetry.consultedUrls,
          },
        });
        if (inserted.error) throw inserted.error;
        await admin.from("research_questions").update({ status: "closed_unknown" }).eq("id", questionRow.id);
      }
    }
    await complete(admin, stage, {
      findingCount: validation.acceptedFindings.length,
      unresolvedCount: validation.unresolvedQuestions.length,
      validationIssues: validation.issues,
      pass: stage.pass,
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
        p_review_record: { automatedQualification: true, risks: assessment.risks, contactRoute } as unknown as Json,
      });
      if (lead.error) throw lead.error;
    } else if (route.lifecycleStatus === "needs_review" && route.exceptionKind) {
      const exception = await admin.from("automation_exceptions").insert({
        workspace_id: workflow.workspace_id,
        workflow_run_id: workflow.id,
        opportunity_id: workflow.opportunity_id,
        exception_kind: route.exceptionKind,
        summary: `Qualification requires review: ${route.exceptionKind.replaceAll('_', ' ')}`,
        details: { score: route.score, deliveryRoute: assessment.deliveryRoute, contactRoute } as unknown as Json,
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
  if (!stage) return { claimed: false as const, dispatched: dispatched.data ?? 0 };
  writeAutomationLog("info", "stage.started", {
    workflowId: stage.workflow_run_id,
    stageRunId: stage.id,
    stage: stage.stage,
    attempt: stage.attempt,
    pass: stage.pass,
  });
  const workflowResult = await admin.from("automation_workflow_runs").select("*").eq("id", stage.workflow_run_id).single();
  if (workflowResult.error) throw workflowResult.error;
  const workflow = workflowResult.data as unknown as WorkflowRow;
  try {
    const result = await processStage(admin, stage, workflow);
    writeAutomationLog("info", "stage.completed", {
      workflowId: workflow.id,
      stageRunId: stage.id,
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
    const retryable = !costLimit && automationErrorIsRetryable(failure);
    const errorCode = costLimit ? "cost_limit" : failure.code;
    writeAutomationLog("error", "stage.failed", {
      workflowId: workflow.id,
      stageRunId: stage.id,
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
      p_error_code: costLimit ? "cost_limit" : retryable ? errorCode : "policy",
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
