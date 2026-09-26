"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Json } from "@/lib/supabase/database.types";
import { describeAutomationError, writeAutomationLog } from "@/lib/automation/diagnostics";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function numberValue(formData: FormData, name: string, fallback: number): number {
  const parsed = Number(value(formData, name));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(formData: FormData, name: string): string[] {
  return value(formData, name).split(",").map((item) => item.trim()).filter(Boolean);
}

function selected(formData: FormData, name: string): string[] {
  return formData.getAll(name).map(String).map((item) => item.trim()).filter(Boolean);
}

function sourcesUrl(workspaceId: string, kind?: "success" | "error", message?: string): string {
  const params = new URLSearchParams({ workspace: workspaceId });
  if (kind && message) params.set(kind, message);
  return `/sources?${params.toString()}`;
}

export async function saveLeadStrategyAction(formData: FormData) {
  const workspaceId = value(formData, "workspaceId");
  let destination = sourcesUrl(workspaceId);
  try {
    const strategy = {
      workspaceId,
      name: value(formData, "name") || "Dutch agency opportunities",
      description: value(formData, "description"),
      signalAreas: selected(formData, "signalAreas"),
      sectors: list(formData, "sectors"),
      organizationTypes: list(formData, "organizationTypes"),
      regions: list(formData, "regions"),
      languages: list(formData, "languages"),
      projectTypes: list(formData, "projectTypes"),
      services: list(formData, "services"),
      impactThemes: list(formData, "impactThemes"),
      keywords: list(formData, "keywords"),
      exclusions: list(formData, "exclusions"),
      hardExcludedSectors: list(formData, "hardExcludedSectors"),
      sensitiveSectors: list(formData, "sensitiveSectors"),
      projectClues: list(formData, "projectClues"),
      capacityStatus: value(formData, "capacityStatus") || "unknown",
      capacityEffectiveUntil: value(formData, "capacityEffectiveUntil") || null,
      capacityNote: value(formData, "capacityNote") || null,
      minimumProjectBudgetEur: numberValue(formData, "minimumProjectBudgetEur", 30_000),
      preferredBudgetMinEur: numberValue(formData, "preferredBudgetMinEur", 50_000),
      preferredBudgetMaxEur: numberValue(formData, "preferredBudgetMaxEur", 100_000),
      largeProjectReviewEur: numberValue(formData, "largeProjectReviewEur", 250_000),
      lookbackDays: numberValue(formData, "lookbackDays", 90),
      resultLimit: numberValue(formData, "resultLimit", 5),
      runCostLimit: numberValue(formData, "runCostLimit", 0.5),
      dailyCostLimit: numberValue(formData, "dailyCostLimit", 2.5),
      timezone: value(formData, "timezone") || "Europe/Amsterdam",
      monitorHour: numberValue(formData, "monitorHour", 7),
    };
    if (!workspaceId || !strategy.signalAreas.length || !strategy.regions.length || !strategy.languages.length) {
      throw new Error("Workspace, signal areas, region, and languages are required.");
    }
    if (
      strategy.minimumProjectBudgetEur < 0
      || strategy.preferredBudgetMinEur < strategy.minimumProjectBudgetEur
      || strategy.preferredBudgetMaxEur < strategy.preferredBudgetMinEur
      || strategy.largeProjectReviewEur < strategy.preferredBudgetMaxEur
    ) {
      throw new Error("Budget limits must increase from minimum through preferred and large-project review thresholds.");
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_lead_strategy", { p_strategy: strategy as unknown as Json });
    if (error) throw error;
    writeAutomationLog("info", "lead_strategy.saved", {
      workspaceId,
      signalAreaCount: strategy.signalAreas.length,
      resultLimit: strategy.resultLimit,
      automationExpected: true,
    });
    revalidatePath("/sources");
    destination = sourcesUrl(workspaceId, "success", "Lead Strategy saved. Source Scout has been queued automatically.");
  } catch (error) {
    const failure = describeAutomationError(error);
    writeAutomationLog("error", "lead_strategy.save_failed", { workspaceId, errorCode: failure.code, message: failure.message });
    destination = sourcesUrl(workspaceId, "error", error instanceof Error ? error.message : "Could not save the Lead Strategy.");
  }
  redirect(destination);
}

export async function createWorkspaceAction(formData: FormData) {
  const name = value(formData, "name");
  let destination = "/sources";
  try {
    const supabase = await createClient();
    const created = await supabase.rpc("create_workspace_with_owner", { p_name: name });
    if (created.error) throw created.error;
    revalidatePath("/sources");
    destination = sourcesUrl(created.data, "success", "Workspace created. Define the first Lead Strategy to start Source Scout.");
  } catch (error) {
    destination = `/sources?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not create the workspace.")}`;
  }
  redirect(destination);
}

export async function reviewSourceCandidateAction(formData: FormData) {
  const workspaceId = value(formData, "workspaceId");
  const candidateId = value(formData, "candidateId");
  const decision = value(formData, "decision");
  let destination = sourcesUrl(workspaceId);
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("review_source_candidate", {
      p_candidate_id: candidateId,
      p_decision: decision,
      p_note: value(formData, "note") || undefined,
    });
    if (error) throw error;
    writeAutomationLog("info", "source_candidate.reviewed", { workspaceId, candidateId, decision });
    revalidatePath("/sources");
    destination = sourcesUrl(workspaceId, "success", decision === "approved"
      ? "Source approved. Its first monitoring cycle is queued automatically."
      : "Source rejected and suppressed unless materially new evidence appears.");
  } catch (error) {
    const failure = describeAutomationError(error);
    writeAutomationLog("error", "source_candidate.review_failed", { workspaceId, candidateId, errorCode: failure.code, message: failure.message });
    destination = sourcesUrl(workspaceId, "error", error instanceof Error ? error.message : "Could not review the source.");
  }
  redirect(destination);
}

export async function setLeadAutomationAction(formData: FormData) {
  const workspaceId = value(formData, "workspaceId");
  const enabled = value(formData, "enabled") === "true";
  let destination = sourcesUrl(workspaceId);
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_lead_automation_enabled", { p_workspace_id: workspaceId, p_enabled: enabled });
    if (error) throw error;
    revalidatePath("/sources");
    destination = sourcesUrl(workspaceId, "success", enabled ? "Automation resumed." : "Automation paused.");
  } catch (error) {
    destination = sourcesUrl(workspaceId, "error", error instanceof Error ? error.message : "Could not change automation state.");
  }
  redirect(destination);
}

export async function retryAutomationAction(formData: FormData) {
  const workspaceId = value(formData, "workspaceId");
  const workflowId = value(formData, "workflowId");
  let destination = sourcesUrl(workspaceId);
  try {
    const supabase = await createClient();
    const original = await supabase.from("automation_workflow_runs").select("id").eq("id", workflowId).eq("workspace_id", workspaceId).single();
    if (original.error) throw original.error;
    const retried = await supabase.rpc("retry_automation_workflow", { p_workflow_id: original.data.id });
    if (retried.error) throw retried.error;
    revalidatePath("/sources");
    destination = sourcesUrl(workspaceId, "success", "Failed workflow queued for a bounded retry.");
  } catch (error) {
    destination = sourcesUrl(workspaceId, "error", error instanceof Error ? error.message : "Could not retry the workflow.");
  }
  redirect(destination);
}

export async function queueSourceMonitorNowAction(formData: FormData) {
  const workspaceId = value(formData, "workspaceId");
  const sourceId = value(formData, "sourceId");
  let destination = sourcesUrl(workspaceId);
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("queue_source_monitor_now", { p_source_id: sourceId });
    if (error) throw error;
    // This confirms that the browser action reached Postgres. The worker emits
    // separate queue/stage events afterwards, making a missing hand-off easy to
    // distinguish from a valid zero-result monitor run.
    writeAutomationLog("info", "source_monitor.queued", { workspaceId, sourceId });
    revalidatePath("/sources");
    destination = sourcesUrl(workspaceId, "success", "A bounded live monitor cycle is queued. Process the live queue to continue.");
  } catch (error) {
    const failure = describeAutomationError(error);
    writeAutomationLog("error", "source_monitor.queue_failed", { workspaceId, sourceId, errorCode: failure.code, message: failure.message });
    destination = sourcesUrl(workspaceId, "error", error instanceof Error ? error.message : "Could not queue the source monitor.");
  }
  redirect(destination);
}

export async function reviewAutomationExceptionAction(formData: FormData) {
  const workspaceId = value(formData, "workspaceId");
  const exceptionId = value(formData, "exceptionId");
  const decision = value(formData, "decision");
  let destination = sourcesUrl(workspaceId);
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("review_automation_exception", {
      p_exception_id: exceptionId,
      p_decision: decision,
      p_note: value(formData, "note") || undefined,
    });
    if (error) throw error;
    revalidatePath("/sources");
    destination = sourcesUrl(workspaceId, "success", decision === "research"
      ? "A new bounded assessment and material-gap research cycle is queued."
      : "The exception decision was recorded.");
  } catch (error) {
    destination = sourcesUrl(workspaceId, "error", error instanceof Error ? error.message : "Could not resolve the exception.");
  }
  redirect(destination);
}
