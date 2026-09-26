import "server-only";

import { summarizeDiscoveryActivity } from "@/lib/automation/activity-diagnostics";
import { automationWorkerReadiness } from "@/lib/automation/runtime-config";
import { writeAutomationLog } from "@/lib/automation/diagnostics";
import type { OperatorAutomationStatus } from "@/lib/automation/operator-progress";
import type { ApprovedSource, AutomationCycle, AutomationException, LeadStrategy, SourceCandidate } from "@/lib/domain";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface WorkspaceChoice {
  id: string;
  name: string;
  role: "owner" | "operator" | "reviewer" | "viewer";
}

export interface SourceNetworkPageData {
  mode: "unconfigured" | "unauthenticated" | "ready";
  workspaces: WorkspaceChoice[];
  selectedWorkspace: WorkspaceChoice | null;
  strategy: LeadStrategy | null;
  candidates: SourceCandidate[];
  sources: ApprovedSource[];
  cycles: AutomationCycle[];
  exceptions: AutomationException[];
  canOperate: boolean;
  runtimeReady: boolean;
  runtimeReason: string | null;
  operatorStatus: OperatorAutomationStatus | null;
  latestScoutResult: {
    proposalCount: number;
    generatedCount: number | null;
    rejectedForEvidence: number | null;
    rejectedForCoverage: number | null;
    suppressedCount: number | null;
    uncoveredAreas: string[];
    completedAt: string;
  } | null;
  summary: {
    activeSources: number;
    pendingApprovals: number;
    openExceptions: number;
    successfulCycles: number;
    totalEstimatedCost: number;
    lastSuccessAt: string | null;
  };
}

const emptyData: SourceNetworkPageData = {
  mode: "unconfigured",
  workspaces: [],
  selectedWorkspace: null,
  strategy: null,
  candidates: [],
  sources: [],
  cycles: [],
  exceptions: [],
  canOperate: false,
  runtimeReady: false,
  runtimeReason: "Supabase is not configured.",
  operatorStatus: null,
  latestScoutResult: null,
  summary: { activeSources: 0, pendingApprovals: 0, openExceptions: 0, successfulCycles: 0, totalEstimatedCost: 0, lastSuccessAt: null },
};

function daysFromInterval(value: string): number {
  return Number(value.match(/\d+/)?.[0] ?? 90);
}

function mapSampleEvidence(value: unknown): SourceCandidate["sampleEvidence"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.title !== "string" || typeof row.url !== "string") return [];
    return [{ title: row.title, url: row.url, relevance: typeof row.relevance === "string" ? row.relevance : "Representative public result" }];
  });
}

function sourceClassification(value: string | null): SourceCandidate["classification"] {
  return value === "primary" || value === "secondary" || value === "aggregator" ? value : null;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function exceptionStatus(value: string): AutomationException["status"] {
  return value === "resolved" || value === "dismissed" ? value : "open";
}

export async function getSourcesPageData(requestedWorkspaceId?: string): Promise<SourceNetworkPageData> {
  if (!hasSupabaseEnv()) return emptyData;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ...emptyData, mode: "unauthenticated", runtimeReason: "Sign in to view the Source Network." };

  const memberships = await supabase.from("workspace_members")
    .select("workspace_id, role, workspaces!inner(id, name)").eq("user_id", authData.user.id);
  if (memberships.error) throw memberships.error;
  const workspaces: WorkspaceChoice[] = (memberships.data ?? []).map((membership) => {
    const workspace = membership.workspaces as { id: string; name: string };
    return { id: workspace.id, name: workspace.name, role: membership.role };
  });
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === requestedWorkspaceId) ?? null;
  const runtime = automationWorkerReadiness();
  if (!selectedWorkspace) {
    return { ...emptyData, mode: "ready", workspaces, runtimeReady: runtime.ready, runtimeReason: runtime.ready ? null : runtime.reason };
  }

  const profileResult = await supabase.from("discovery_coverage_profiles").select("*")
    .eq("workspace_id", selectedWorkspace.id).eq("profile_key", "lead-strategy").eq("status", "active").maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const profile = profileResult.data;
  const strategy: LeadStrategy | null = profile ? {
    id: profile.id,
    workspaceId: profile.workspace_id,
    name: profile.name,
    description: profile.description ?? "",
    version: profile.version,
    active: profile.status === "active",
    automationEnabled: profile.automation_enabled,
    signalAreas: profile.signal_areas,
    sectors: profile.sectors,
    organizationTypes: profile.organization_types,
    regions: profile.regions,
    languages: profile.languages,
    projectTypes: profile.project_types,
    services: profile.technical_themes,
    keywords: profile.keywords,
    exclusions: profile.negative_terms,
    hardExcludedSectors: profile.hard_excluded_sectors,
    sensitiveSectors: profile.sensitive_sectors,
    capacityStatus: ["available", "limited", "unavailable", "unknown"].includes(profile.capacity_status)
      ? profile.capacity_status as LeadStrategy["capacityStatus"]
      : "unknown",
    capacityEffectiveUntil: profile.capacity_effective_until,
    capacityNote: profile.capacity_note,
    minimumProjectBudgetEur: Number(profile.minimum_project_budget_eur),
    preferredBudgetMinEur: Number(profile.preferred_budget_min_eur),
    preferredBudgetMaxEur: Number(profile.preferred_budget_max_eur),
    largeProjectReviewEur: Number(profile.large_project_review_eur),
    lookbackDays: daysFromInterval(profile.lookback),
    resultLimit: profile.result_limit,
    runCostLimit: Number(profile.cost_limit),
    dailyCostLimit: Number(profile.daily_cost_limit),
    timezone: profile.timezone,
    monitorHour: profile.monitor_hour,
    lastScoutedAt: profile.last_scouted_at,
    nextScoutAt: profile.next_scout_at,
  } : null;

  const [candidateResult, sourceResult, cycleResult, exceptionResult, stageResult] = await Promise.all([
    strategy
      ? supabase.from("discovery_source_candidates").select("*").eq("workspace_id", selectedWorkspace.id).eq("coverage_profile_id", strategy.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("source_registry").select("id,name,source_family,base_url,health,schedule_enabled,next_run_at,last_run_at,reputation")
      .eq("workspace_id", selectedWorkspace.id).not("approved_at", "is", null).order("approved_at", { ascending: false }),
    supabase.from("automation_workflow_runs").select("id,kind,source_id,status,current_stage,estimated_cost,stop_reason,failure_reason,created_at,finished_at")
      .eq("workspace_id", selectedWorkspace.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("automation_exceptions").select("id,exception_kind,summary,status,opportunity_id,source_id,created_at")
      .eq("workspace_id", selectedWorkspace.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("automation_stage_runs").select("id,workflow_run_id,stage,status,attempt,pass,error_code,failure_reason,output_snapshot,usage,started_at,available_at,leased_until,finished_at,created_at")
      .eq("workspace_id", selectedWorkspace.id).in("status", ["queued", "running", "failed", "succeeded"])
      .order("created_at", { ascending: false }).limit(200),
  ]);
  if (candidateResult.error) throw candidateResult.error;
  if (sourceResult.error) throw sourceResult.error;
  if (cycleResult.error) throw cycleResult.error;
  if (exceptionResult.error) throw exceptionResult.error;
  if (stageResult.error) throw stageResult.error;

  const candidates: SourceCandidate[] = (candidateResult.data ?? []).map((candidate) => {
    const proposedConfig = jsonRecord(candidate.proposed_config);
    const executionMetadata = jsonRecord(candidate.execution_metadata);
    return {
      id: candidate.id,
      name: candidate.name,
      sourceFamily: candidate.source_family,
      baseUrl: candidate.base_url,
      classification: sourceClassification(candidate.source_classification),
      coverageRationale: candidate.coverage_rationale,
      coverageGap: typeof proposedConfig.primaryCoverageGap === "string" ? proposedConfig.primaryCoverageGap : null,
      noveltyReason: typeof executionMetadata.noveltyReason === "string" ? executionMetadata.noveltyReason : null,
      confidence: Number(candidate.confidence),
      reputationScore: candidate.reputation_score === null ? null : Number(candidate.reputation_score),
      publicAccess: candidate.public_access,
      updateFrequency: candidate.observed_update_frequency,
      sampleEvidence: mapSampleEvidence(candidate.sample_evidence),
      policyChecks: jsonRecord(candidate.policy_checks),
      estimatedMonthlyCost: Number(candidate.estimated_monthly_cost),
      status: candidate.status,
    };
  });
  const sources: ApprovedSource[] = (sourceResult.data ?? []).map((source) => {
    const reputation = source.reputation && typeof source.reputation === "object" && !Array.isArray(source.reputation)
      ? source.reputation as Record<string, unknown> : {};
    return {
      id: source.id,
      name: source.name,
      sourceFamily: source.source_family,
      baseUrl: source.base_url,
      health: source.health,
      scheduleEnabled: source.schedule_enabled,
      nextRunAt: source.next_run_at,
      lastRunAt: source.last_run_at,
      reputationScore: typeof reputation.score === "number" ? reputation.score : null,
    };
  });
  const stageRows = stageResult.data ?? [];
  const stagesByWorkflow = new Map<string, typeof stageRows>();
  for (const stage of stageRows) {
    const workflowStages = stagesByWorkflow.get(stage.workflow_run_id) ?? [];
    workflowStages.push(stage);
    stagesByWorkflow.set(stage.workflow_run_id, workflowStages);
  }
  const cycles: AutomationCycle[] = (cycleResult.data ?? []).map((cycle) => {
    const workflowStages = stagesByWorkflow.get(cycle.id) ?? [];
    const diagnostics = cycle.kind === "source_monitor"
      ? summarizeDiscoveryActivity(workflowStages)
      : null;
    return {
      id: cycle.id,
      kind: cycle.kind,
      sourceName: sources.find((source) => source.id === cycle.source_id)?.name ?? null,
      status: cycle.status,
      currentStage: cycle.current_stage,
      estimatedCost: Number(cycle.estimated_cost),
      stopReason: cycle.stop_reason,
      failureReason: cycle.failure_reason,
      createdAt: cycle.created_at,
      finishedAt: cycle.finished_at,
      discoveryDiagnostics: diagnostics,
    };
  });
  const exceptions: AutomationException[] = (exceptionResult.data ?? []).map((item) => ({
    id: item.id,
    kind: item.exception_kind,
    summary: item.summary,
    status: exceptionStatus(item.status),
    opportunityId: item.opportunity_id,
    sourceId: item.source_id,
    createdAt: item.created_at,
  }));
  const allStages = stageRows;
  const latestScoutStage = allStages.find((stage) => stage.stage === "source_scout" && stage.status === "succeeded" && stage.finished_at) ?? null;
  const latestScoutOutput = latestScoutStage?.output_snapshot && typeof latestScoutStage.output_snapshot === "object" && !Array.isArray(latestScoutStage.output_snapshot)
    ? latestScoutStage.output_snapshot as Record<string, unknown>
    : null;
  const numericScoutValue = (key: string) => typeof latestScoutOutput?.[key] === "number" ? latestScoutOutput[key] as number : null;
  const latestScoutResult = latestScoutStage && latestScoutOutput ? {
    proposalCount: numericScoutValue("proposalCount") ?? 0,
    generatedCount: numericScoutValue("generatedCount"),
    rejectedForEvidence: numericScoutValue("rejectedForEvidence"),
    rejectedForCoverage: numericScoutValue("rejectedForCoverage"),
    suppressedCount: numericScoutValue("suppressedCount"),
    uncoveredAreas: Array.isArray(latestScoutOutput.uncoveredAreas)
      ? latestScoutOutput.uncoveredAreas.filter((value): value is string => typeof value === "string")
      : [],
    completedAt: latestScoutStage.finished_at!,
  } : null;
  const activeStages = allStages.filter((stage) => stage.status === "queued" || stage.status === "running");
  const queuedStages = activeStages.filter((stage) => stage.status === "queued");
  const readyStages = queuedStages.filter((stage) => Date.parse(stage.available_at) <= Date.now());
  const runningStages = activeStages.filter((stage) => stage.status === "running")
    .sort((left, right) => Date.parse(right.started_at ?? right.created_at) - Date.parse(left.started_at ?? left.created_at));
  const currentStage = runningStages[0] ?? readyStages[0] ?? null;
  const nextQueuedStage = [...queuedStages]
    .sort((left, right) => Date.parse(left.available_at) - Date.parse(right.available_at))[0] ?? null;
  const visibleCurrentStage = currentStage ?? nextQueuedStage;
  const latestFailed = allStages.filter((stage) => stage.status === "failed" && stage.finished_at)
    .sort((left, right) => Date.parse(right.finished_at!) - Date.parse(left.finished_at!))[0] ?? null;
  const latestSucceeded = allStages.filter((stage) => stage.status === "succeeded" && stage.finished_at)
    .sort((left, right) => Date.parse(right.finished_at!) - Date.parse(left.finished_at!))[0] ?? null;
  const failureIsCurrent = Boolean(latestFailed?.finished_at) && (
    !latestSucceeded?.finished_at
    || Date.parse(latestFailed!.finished_at!) > Date.parse(latestSucceeded.finished_at)
    || visibleCurrentStage?.workflow_run_id === latestFailed?.workflow_run_id
  );
  const retryStage = failureIsCurrent && visibleCurrentStage?.status === "queued"
    && visibleCurrentStage.workflow_run_id === latestFailed?.workflow_run_id ? visibleCurrentStage : null;
  const operatorStatus: OperatorAutomationStatus = {
    current: visibleCurrentStage ? {
      id: visibleCurrentStage.id,
      stage: visibleCurrentStage.stage,
      status: visibleCurrentStage.status as "queued" | "running",
      attempt: visibleCurrentStage.attempt,
      pass: visibleCurrentStage.pass,
      startedAt: visibleCurrentStage.started_at,
      availableAt: visibleCurrentStage.available_at,
      leasedUntil: visibleCurrentStage.leased_until,
    } : null,
    queuedStages: queuedStages.length,
    readyStages: readyStages.length,
    lastFailure: failureIsCurrent && latestFailed?.failure_reason && latestFailed.finished_at ? {
      workflowId: latestFailed.workflow_run_id,
      stage: latestFailed.stage,
      attempt: latestFailed.attempt,
      errorCode: latestFailed.error_code,
      reason: latestFailed.failure_reason,
      failedAt: latestFailed.finished_at,
      retryScheduled: Boolean(retryStage),
      retryAt: retryStage?.available_at ?? null,
    } : null,
  };
  const successful = cycles.filter((cycle) => cycle.status === "succeeded");
  writeAutomationLog("info", "source_network.snapshot", {
    workspaceId: selectedWorkspace.id,
    role: selectedWorkspace.role,
    strategyVersion: strategy?.version ?? null,
    approvedSourceCount: sources.length,
    workflowCount: cycles.length,
    stageCount: allStages.length,
    pendingApprovalCount: candidates.filter((candidate) => candidate.status === "proposed" || candidate.status === "in_review").length,
    openExceptionCount: exceptions.filter((item) => item.status === "open").length,
  });
  return {
    mode: "ready",
    workspaces,
    selectedWorkspace,
    strategy,
    candidates,
    sources,
    cycles,
    exceptions,
    canOperate: selectedWorkspace.role === "owner" || selectedWorkspace.role === "operator",
    runtimeReady: runtime.ready,
    runtimeReason: runtime.ready ? null : runtime.reason,
    operatorStatus,
    latestScoutResult,
    summary: {
      activeSources: sources.filter((source) => source.scheduleEnabled).length,
      pendingApprovals: candidates.filter((candidate) => candidate.status === "proposed" || candidate.status === "in_review").length,
      openExceptions: exceptions.filter((item) => item.status === "open").length,
      successfulCycles: successful.length,
      totalEstimatedCost: cycles.reduce((total, cycle) => total + cycle.estimatedCost, 0),
      lastSuccessAt: successful[0]?.finishedAt ?? null,
    },
  };
}
