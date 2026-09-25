"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { createWorkspaceAction, queueSourceMonitorNowAction, retryAutomationAction, reviewAutomationExceptionAction, reviewSourceCandidateAction, saveLeadStrategyAction, setLeadAutomationAction } from "@/app/sources/actions";
import { formatOperatorElapsed, formatOperatorRetryTime, getOperatorStagePresentation, type OperatorAutomationStatus } from "@/lib/automation/operator-progress";
import { defaultLeadStrategy } from "@/lib/automation/strategy";
import type { LeadStrategy } from "@/lib/domain";

function PendingButton({ children, pendingLabel, className = "primary-action", name, value }: { children: React.ReactNode; pendingLabel: string; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} name={name} value={value} disabled={pending}>{pending ? pendingLabel : children}</button>;
}

const signalAreas = [
  ["pitching", "Pitches"],
  ["newsletters", "Newsletters"],
  ["funding", "Funding"],
  ["strategy", "Strategy"],
  ["hiring", "Hiring"],
  ["consultations", "Consultations"],
  ["announcements", "Announcements"],
  ["regional_networks", "Regional networks"],
] as const;

function join(values: string[]) {
  return values.join(", ");
}

export function WorkspaceOnboardingForm() {
  return (
    <form action={createWorkspaceAction} className="workspace-onboarding-form">
      <label><span>Workspace name</span><input name="name" defaultValue="YipYip" minLength={1} maxLength={80} required /></label>
      <PendingButton pendingLabel="Creating workspace…">Create workspace</PendingButton>
    </form>
  );
}

export function LeadStrategyForm({ workspaceId, strategy }: { workspaceId: string; strategy: LeadStrategy | null }) {
  const defaults = defaultLeadStrategy(workspaceId);
  const selectedAreas = new Set(strategy?.signalAreas ?? defaults.signalAreas);
  return (
    <form action={saveLeadStrategyAction} className="strategy-form">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="strategy-form-heading">
        <div>
          <span className="section-label">LEAD STRATEGY</span>
          <h2>{strategy ? `Version ${strategy.version}` : "Define what is worth finding"}</h2>
          <p>This is the only business-facing setup. Search instructions and source monitors are generated internally.</p>
        </div>
        {strategy ? <span className={`automation-state ${strategy.automationEnabled ? "active" : "paused"}`}>{strategy.automationEnabled ? "Automation active" : "Paused"}</span> : null}
      </div>

      <div className="strategy-core-grid">
        <label><span>Name</span><input name="name" defaultValue={strategy?.name ?? defaults.name} required /></label>
        <label className="wide"><span>Outcome</span><textarea name="description" defaultValue={strategy?.description ?? defaults.description} rows={2} required /></label>
        <fieldset className="wide signal-area-picker">
          <legend>Signals to monitor</legend>
          {signalAreas.map(([value, label]) => (
            <label key={value}><input type="checkbox" name="signalAreas" value={value} defaultChecked={selectedAreas.has(value)} /><span>{label}</span></label>
          ))}
        </fieldset>
        <label><span>Markets</span><input name="regions" defaultValue={join(strategy?.regions ?? defaults.regions)} required /></label>
        <label><span>Languages</span><input name="languages" defaultValue={join(strategy?.languages ?? defaults.languages)} required /></label>
        <label className="wide"><span>Project types</span><input name="projectTypes" defaultValue={join(strategy?.projectTypes ?? defaults.projectTypes)} required /></label>
        <label className="wide"><span>YipYip services</span><input name="services" defaultValue={join(strategy?.services ?? defaults.services)} /></label>
      </div>

      <details className="strategy-advanced">
        <summary>Refine sectors, evidence, exclusions, and operating limits</summary>
        <div className="strategy-core-grid">
          <label><span>Sectors</span><input name="sectors" defaultValue={join(strategy?.sectors ?? defaults.sectors)} /></label>
          <label><span>Organization types</span><input name="organizationTypes" defaultValue={join(strategy?.organizationTypes ?? defaults.organizationTypes)} /></label>
          <label><span>Keywords</span><input name="keywords" defaultValue={join(strategy?.keywords ?? defaults.keywords)} /></label>
          <label><span>Project clues</span><input name="projectClues" defaultValue={join(defaults.projectClues)} /></label>
          <label className="wide"><span>Exclusions</span><input name="exclusions" defaultValue={join(strategy?.exclusions ?? defaults.exclusions)} /></label>
          <input type="hidden" name="impactThemes" value={join(defaults.impactThemes)} />
          <label><span>Minimum project budget (€)</span><input type="number" name="minimumProjectBudgetEur" min="0" step="1000" defaultValue={strategy?.minimumProjectBudgetEur ?? defaults.minimumProjectBudgetEur} /></label>
          <label><span>Preferred budget from (€)</span><input type="number" name="preferredBudgetMinEur" min="0" step="1000" defaultValue={strategy?.preferredBudgetMinEur ?? defaults.preferredBudgetMinEur} /></label>
          <label><span>Preferred budget to (€)</span><input type="number" name="preferredBudgetMaxEur" min="0" step="1000" defaultValue={strategy?.preferredBudgetMaxEur ?? defaults.preferredBudgetMaxEur} /></label>
          <label><span>Large-project review from (€)</span><input type="number" name="largeProjectReviewEur" min="0" step="1000" defaultValue={strategy?.largeProjectReviewEur ?? defaults.largeProjectReviewEur} /></label>
          <label><span>Lookback days</span><input type="number" name="lookbackDays" min="1" max="365" defaultValue={strategy?.lookbackDays ?? defaults.lookbackDays} /></label>
          <label><span>Results per source</span><input type="number" name="resultLimit" min="1" max="25" defaultValue={strategy?.resultLimit ?? defaults.resultLimit} /></label>
          <label><span>Per-run cost limit (€)</span><input type="number" name="runCostLimit" min="0" max="25" step="0.05" defaultValue={strategy?.runCostLimit ?? defaults.runCostLimit} /></label>
          <label><span>Daily cost limit (€)</span><input type="number" name="dailyCostLimit" min="0" max="250" step="0.25" defaultValue={strategy?.dailyCostLimit ?? defaults.dailyCostLimit} /></label>
          <input type="hidden" name="timezone" value={strategy?.timezone ?? defaults.timezone} />
          <input type="hidden" name="monitorHour" value={strategy?.monitorHour ?? defaults.monitorHour} />
        </div>
      </details>

      <div className="strategy-submit">
        <PendingButton pendingLabel="Saving and queueing Source Scout…">{strategy ? "Save new strategy version" : "Save strategy and start Source Scout"}</PendingButton>
        <span>Source proposals still require individual operator approval.</span>
      </div>
    </form>
  );
}

export function SourceCandidateReviewForm({ workspaceId, candidateId }: { workspaceId: string; candidateId: string }) {
  return (
    <form action={reviewSourceCandidateAction} className="candidate-actions">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <label><span className="sr-only">Optional source review note</span><input name="note" placeholder="Optional review note" /></label>
      <PendingButton pendingLabel="Approving…" className="primary-action" name="decision" value="approved"><span>Approve source</span></PendingButton>
      <button type="submit" name="decision" value="rejected" className="secondary-action">Reject</button>
    </form>
  );
}

export function AutomationToggleForm({ workspaceId, enabled }: { workspaceId: string; enabled: boolean }) {
  return (
    <form action={setLeadAutomationAction}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <PendingButton pendingLabel="Updating…" className="secondary-action">{enabled ? "Pause automation" : "Resume automation"}</PendingButton>
    </form>
  );
}

export function RetryAutomationForm({ workspaceId, workflowId }: { workspaceId: string; workflowId: string }) {
  return (
    <form action={retryAutomationAction}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="workflowId" value={workflowId} />
      <PendingButton pendingLabel="Queueing…" className="secondary-action">Retry now</PendingButton>
    </form>
  );
}

export function QueueSourceMonitorForm({ workspaceId, sourceId }: { workspaceId: string; sourceId: string }) {
  return (
    <form action={queueSourceMonitorNowAction}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <PendingButton pendingLabel="Queueing…" className="secondary-action">Queue live monitor</PendingButton>
    </form>
  );
}

export function ExceptionReviewForm({ workspaceId, exceptionId }: { workspaceId: string; exceptionId: string }) {
  return (
    <form action={reviewAutomationExceptionAction} className="exception-actions">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <label><span className="sr-only">Exception review note</span><input name="note" placeholder="Optional review note" /></label>
      <PendingButton pendingLabel="Queueing research…" name="decision" value="research">Research missing info</PendingButton>
      <button type="submit" className="secondary-action" name="decision" value="dismissed">Dismiss</button>
    </form>
  );
}

export function LiveAutomationRunner({ workspaceId, initialStatus, disabledReason }: { workspaceId: string; initialStatus: OperatorAutomationStatus | null; disabledReason?: string | null }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusCheckedAt, setStatusCheckedAt] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<"idle" | "complete" | "error">("idle");
  const [message, setMessage] = useState(disabledReason ?? "Checking this workspace for runnable automation…");
  const [status, setStatus] = useState<OperatorAutomationStatus | null>(initialStatus);

  const refreshStatus = useCallback(async () => {
    const response = await fetch(`/api/automation/run?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
    const result = await response.json() as Partial<OperatorAutomationStatus> & { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) throw new Error(result.error ?? "Live automation status could not be loaded.");
    setStatus({
      current: result.current ?? null,
      queuedStages: result.queuedStages ?? 0,
      readyStages: result.readyStages ?? 0,
      lastFailure: result.lastFailure ?? null,
    });
    setStatusCheckedAt(Date.now());
  }, [workspaceId]);

  const leaseExpiresAt = status?.current?.leasedUntil ? Date.parse(status.current.leasedUntil) : Number.NaN;
  const activeInDatabase = status?.current?.status === "running" && Number.isFinite(leaseExpiresAt) && leaseExpiresAt > statusCheckedAt;
  const busy = running || activeInDatabase;

  useEffect(() => {
    if (!busy) return;
    const poll = window.setInterval(() => void refreshStatus().catch(() => undefined), 1_250);
    return () => window.clearInterval(poll);
  }, [busy, refreshStatus]);

  const currentStartedAt = status?.current?.startedAt;
  useEffect(() => {
    if (!busy) return;
    const databaseStart = currentStartedAt ? Date.parse(currentStartedAt) : Number.NaN;
    const start = Number.isFinite(databaseStart) ? databaseStart : (runStartedAt ?? Date.now());
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1_000)));
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [busy, currentStartedAt, runStartedAt]);

  const stageIsRunning = activeInDatabase;
  const staleLease = status?.current?.status === "running" && !activeInDatabase;
  const currentStage = status?.current?.stage;
  const presentation = useMemo(() => getOperatorStagePresentation(stageIsRunning ? currentStage : null), [currentStage, stageIsRunning]);
  let headline = "Live worker ready";
  let detail = message;
  if (busy) {
    headline = presentation.label;
    detail = stageIsRunning
      ? presentation.description
      : "YipYip is claiming the next durable stage. The current action will appear here as soon as it starts.";
  } else if (outcome === "error") {
    headline = "Live run needs attention";
  } else if (status?.lastFailure) {
    headline = status.lastFailure.retryScheduled ? "Attempt failed — retry queued" : "Automation needs attention";
    detail = status.lastFailure.retryScheduled
      ? `${status.lastFailure.reason} Retry is runnable after ${status.lastFailure.retryAt ? formatOperatorRetryTime(status.lastFailure.retryAt) : "the backoff window"}; in local mode, press Process live queue again then.`
      : status.lastFailure.reason;
  } else if (outcome === "complete") {
    headline = "Live queue is clear";
  } else if (staleLease) {
    headline = "A previous stage is ready to recover";
    detail = "Its worker lease expired before completion. Start the worker to preserve that failure and retry safely.";
  } else if (status?.readyStages) {
    headline = `${status.readyStages} stage${status.readyStages === 1 ? "" : "s"} ready to process`;
    detail = "Start the worker to process the queued work now. The page will show each stage as it runs.";
  }

  const run = async () => {
    setRunning(true);
    setOutcome("idle");
    setProcessed(0);
    setRunStartedAt(Date.now());
    setMessage("Claiming the next durable stage…");
    let completed = 0;
    try {
      for (; completed < 40;) {
        const response = await fetch("/api/automation/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        });
        const result = await response.json() as { ok?: boolean; claimed?: boolean; stage?: string; outcome?: string; failureReason?: string; error?: string };
        if (!response.ok || !result.ok) throw new Error(result.error ?? "The live worker request failed.");
        if (!result.claimed) {
          setMessage(completed
            ? `Queue clear after ${completed} stage${completed === 1 ? "" : "s"}. Results are up to date.`
            : "No runnable stage is queued. Save a strategy, approve a source, or queue a monitor first.");
          setOutcome("complete");
          break;
        }
        completed += 1;
        setProcessed(completed);
        if (result.outcome === "retry_scheduled" || result.outcome === "failed") {
          setMessage(result.failureReason ?? `${getOperatorStagePresentation(result.stage).label} failed.`);
          setOutcome("error");
          await refreshStatus();
          router.refresh();
          break;
        }
        if (result.outcome === "no_reviewable_proposals") {
          setMessage("Source Scout completed, but no reviewable source passed citation, access, and policy validation. Nothing is waiting for approval.");
          setOutcome("complete");
          await refreshStatus();
          router.refresh();
          break;
        }
        setMessage(`${getOperatorStagePresentation(result.stage).label} ${String(result.outcome ?? "completed").replaceAll("_", " ")}. Checking the next stage…`);
        await refreshStatus();
        router.refresh();
      }
      if (completed >= 40) {
        setMessage("Stopped at the 40-stage operator safety limit. You can continue the remaining queue.");
        setOutcome("complete");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The live worker request failed.");
      setOutcome("error");
      router.refresh();
    } finally {
      setRunning(false);
      setRunStartedAt(null);
      await refreshStatus().catch(() => undefined);
    }
  };

  return (
    <motion.section className={`live-runner ${busy ? "is-running" : (outcome === "error" || status?.lastFailure ? "error" : outcome)}`} layout={!reduceMotion} aria-busy={busy}>
      <div className="live-runner-content">
        <div className="live-runner-heading">
          <motion.span
            className="live-runner-signal"
            animate={busy && !reduceMotion ? { opacity: [0.45, 1, 0.45], transform: ["scale(.86)", "scale(1)", "scale(.86)"] } : { opacity: 1, transform: "scale(1)" }}
            transition={busy && !reduceMotion ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
          />
          <div>
            <span className="live-runner-eyebrow">{busy ? (stageIsRunning && presentation.usesWebSearch ? "WEB SEARCH ACTIVE" : "AUTOMATION ACTIVE") : "LIVE AUTOMATION"}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.strong key={headline} initial={reduceMotion ? false : { opacity: 0, transform: "translateY(4px)" }} animate={{ opacity: 1, transform: "translateY(0)" }} exit={reduceMotion ? undefined : { opacity: 0, transform: "translateY(-4px)" }} transition={{ duration: 0.18 }}>{headline}</motion.strong>
            </AnimatePresence>
          </div>
        </div>
        <p role="status" aria-live="polite">{detail}</p>
        <div className="live-runner-meta" aria-label="Live automation status">
          {busy ? <span aria-label={`Elapsed time ${formatOperatorElapsed(elapsedSeconds)}`}>Elapsed <strong aria-hidden="true">{formatOperatorElapsed(elapsedSeconds)}</strong></span> : null}
          <span>Completed <strong>{processed}</strong></span>
          <span>Queued <strong>{status?.queuedStages ?? 0}</strong></span>
          {status?.current ? <span>Attempt <strong>{status.current.attempt}</strong>{status.current.pass > 1 ? ` · pass ${status.current.pass}` : ""}</span> : null}
          {status?.lastFailure?.retryScheduled ? <span>Retry <strong>{status.lastFailure.retryAt ? formatOperatorRetryTime(status.lastFailure.retryAt) : "queued"}</strong></span> : null}
        </div>
        <div className="live-runner-track" aria-hidden="true">
          <motion.span
            animate={busy && !reduceMotion ? { transform: ["translateX(-110%)", "translateX(410%)"] } : { transform: busy ? "translateX(0%)" : "translateX(-110%)" }}
            transition={busy && !reduceMotion ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          />
        </div>
      </div>
      <button type="button" className="primary-action" onClick={run} disabled={busy || Boolean(disabledReason)}>
        {busy ? "Agent working…" : "Process live queue"}
      </button>
    </motion.section>
  );
}
