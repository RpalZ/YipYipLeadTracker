import { randomUUID } from "node:crypto";

import { processOneAutomationStage } from "@/lib/automation/worker";
import { describeAutomationError, writeAutomationLog } from "@/lib/automation/diagnostics";
import { automationWorkerReadiness } from "@/lib/automation/runtime-config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Accommodates the bounded 150-second default agent deadline plus persistence
// and cleanup. Deployment platforms may enforce this build-time declaration.
export const maxDuration = 300;

const workspaceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sameOrigin(request: Request): boolean {
  const supplied = request.headers.get("origin");
  if (!supplied) return false;
  return supplied === new URL(request.url).origin;
}

async function authorizeWorkspace(workspaceId: string) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: Response.json({ ok: false, error: "Authentication required." }, { status: 401 }) };
  const membership = await supabase.from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (membership.error) return { error: Response.json({ ok: false, error: "Workspace authorization could not be verified." }, { status: 500 }) };
  if (!membership.data || !["owner", "operator"].includes(membership.data.role)) {
    return { error: Response.json({ ok: false, error: "Owner or operator role required." }, { status: 403 }) };
  }
  return { supabase, user: authData.user };
}

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId") ?? "";
  if (!workspaceIdPattern.test(workspaceId)) {
    return Response.json({ ok: false, error: "A valid workspace is required." }, { status: 400 });
  }
  const authorization = await authorizeWorkspace(workspaceId);
  if ("error" in authorization) return authorization.error;
  const now = new Date().toISOString();
  const { supabase } = authorization;
  const [runningResult, readyResult, nextQueuedResult, queuedCountResult, readyCountResult, failedResult, succeededResult] = await Promise.all([
    supabase.from("automation_stage_runs")
      .select("id,workflow_run_id,stage,status,attempt,pass,started_at,available_at,leased_until")
      .eq("workspace_id", workspaceId).eq("status", "running")
      .order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("automation_stage_runs")
      .select("id,workflow_run_id,stage,status,attempt,pass,started_at,available_at,leased_until")
      .eq("workspace_id", workspaceId).eq("status", "queued").lte("available_at", now)
      .order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("automation_stage_runs")
      .select("id,workflow_run_id,stage,status,attempt,pass,started_at,available_at,leased_until")
      .eq("workspace_id", workspaceId).eq("status", "queued")
      .order("available_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("automation_stage_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "queued"),
    supabase.from("automation_stage_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId).eq("status", "queued").lte("available_at", now),
    supabase.from("automation_stage_runs")
      .select("workflow_run_id,stage,attempt,error_code,failure_reason,finished_at")
      .eq("workspace_id", workspaceId).eq("status", "failed")
      .not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("automation_stage_runs")
      .select("finished_at")
      .eq("workspace_id", workspaceId).eq("status", "succeeded")
      .not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const queryError = runningResult.error ?? readyResult.error ?? nextQueuedResult.error
    ?? queuedCountResult.error ?? readyCountResult.error ?? failedResult.error ?? succeededResult.error;
  if (queryError) return Response.json({ ok: false, error: "Live automation status could not be loaded." }, { status: 500 });
  const current = runningResult.data ?? readyResult.data ?? nextQueuedResult.data ?? null;
  const failedAt = failedResult.data?.finished_at ?? null;
  const succeededAt = succeededResult.data?.finished_at ?? null;
  const failureIsCurrent = Boolean(failedAt) && (
    !succeededAt
    || Date.parse(failedAt!) > Date.parse(succeededAt)
    || current?.workflow_run_id === failedResult.data?.workflow_run_id
  );
  const retry = failureIsCurrent && current?.workflow_run_id === failedResult.data?.workflow_run_id
    && current?.status === "queued" ? current : null;
  return Response.json({
    ok: true,
    current: current ? {
      id: current.id,
      stage: current.stage,
      status: current.status,
      attempt: current.attempt,
      pass: current.pass,
      startedAt: current.started_at,
      availableAt: current.available_at,
      leasedUntil: current.leased_until,
    } : null,
    queuedStages: queuedCountResult.count ?? 0,
    readyStages: readyCountResult.count ?? 0,
    lastFailure: failureIsCurrent && failedResult.data?.failure_reason && failedAt ? {
      workflowId: failedResult.data.workflow_run_id,
      stage: failedResult.data.stage,
      attempt: failedResult.data.attempt,
      errorCode: failedResult.data.error_code,
      reason: failedResult.data.failure_reason,
      failedAt,
      retryScheduled: Boolean(retry),
      retryAt: retry?.available_at ?? null,
    } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  const runtimeConfig = automationWorkerReadiness();
  if (!runtimeConfig.ready) return Response.json({ ok: false, error: runtimeConfig.reason }, { status: 503 });

  let workspaceId = "";
  try {
    const body = await request.json() as { workspaceId?: unknown };
    workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  } catch {
    return Response.json({ ok: false, error: "A workspace is required." }, { status: 400 });
  }
  if (!workspaceIdPattern.test(workspaceId)) {
    return Response.json({ ok: false, error: "A valid workspace is required." }, { status: 400 });
  }
  const authorization = await authorizeWorkspace(workspaceId);
  if ("error" in authorization) return authorization.error;
  const { user } = authorization;

  try {
    const result = await processOneAutomationStage({
      workerId: `operator-${user.id}-${randomUUID()}`,
      workspaceId,
      dispatchDue: false,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const failure = describeAutomationError(error);
    writeAutomationLog("error", "operator_request.failed", {
      workspaceId,
      errorCode: failure.code,
      errorName: failure.name,
      message: failure.message,
    });
    return Response.json({ ok: false, error: failure.message }, { status: 500 });
  }
}
