"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { createWorkspaceAction, queueSourceMonitorNowAction, retryAutomationAction, reviewAutomationExceptionAction, reviewSourceCandidateAction, saveLeadStrategyAction, setLeadAutomationAction } from "@/app/sources/actions";
import { useInterfacePreferences } from "@/components/interface-preferences";
import { formatOperatorElapsed, formatOperatorRetryTime, getOperatorFailurePresentation, getOperatorStagePresentation, type OperatorAutomationStatus } from "@/lib/automation/operator-progress";
import { defaultLeadStrategy, type LeadStrategyInput } from "@/lib/automation/strategy";
import type { LeadStrategy } from "@/lib/domain";

function PendingButton({ children, pendingLabel, className = "primary-action", name, value }: { children: React.ReactNode; pendingLabel: string; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} name={name} value={value} disabled={pending}>{pending ? pendingLabel : children}</button>;
}

function join(values: string[]) {
  return values.join(", ");
}

export function WorkspaceOnboardingForm() {
  const { copy } = useInterfacePreferences();
  return (
    <form action={createWorkspaceAction} className="workspace-onboarding-form">
      <label><span>{copy.strategy.workspaceName}</span><input name="name" defaultValue="YipYip" minLength={1} maxLength={80} required /></label>
      <PendingButton pendingLabel={copy.strategy.creatingWorkspace}>{copy.strategy.createWorkspace}</PendingButton>
    </form>
  );
}

export function LeadStrategyFields({
  workspaceId,
  strategy,
  defaultsOverride,
  displayVersion,
  displayAutomationEnabled,
}: {
  workspaceId: string;
  strategy: LeadStrategy | null;
  defaultsOverride?: Partial<LeadStrategyInput>;
  displayVersion?: number | null;
  displayAutomationEnabled?: boolean | null;
}) {
  const { copy } = useInterfacePreferences();
  const defaults = { ...defaultLeadStrategy(workspaceId), ...defaultsOverride };
  const version = displayVersion === undefined ? strategy?.version ?? null : displayVersion;
  const automationEnabled = displayAutomationEnabled === undefined
    ? strategy?.automationEnabled ?? null
    : displayAutomationEnabled;
  const selectedAreas = new Set(strategy?.signalAreas ?? defaults.signalAreas);
  const signalAreas = [
    ["pitching", copy.strategy.pitches], ["newsletters", copy.strategy.newsletters], ["funding", copy.strategy.funding],
    ["strategy", copy.strategy.strategySignal], ["hiring", copy.strategy.hiring], ["consultations", copy.strategy.consultations],
    ["announcements", copy.strategy.announcements], ["regional_networks", copy.strategy.regionalNetworks],
  ] as const;
  return (
    <>
      <div className="strategy-form-heading">
        <div>
          <span className="section-label">{copy.strategy.label}</span>
          <h2>{version ? `${copy.strategy.version} ${version}` : copy.strategy.define}</h2>
          <p>{copy.strategy.intro}</p>
        </div>
        {automationEnabled === null ? null : <span className={`automation-state ${automationEnabled ? "active" : "paused"}`}>{automationEnabled ? copy.strategy.active : copy.strategy.paused}</span>}
      </div>

      <div className="strategy-core-grid">
        <label><span>{copy.strategy.name}</span><input name="name" defaultValue={strategy?.name ?? defaults.name} required /></label>
        <label className="wide"><span>{copy.strategy.outcome}</span><textarea name="description" defaultValue={strategy?.description ?? defaults.description} rows={2} required /></label>
        <fieldset className="wide signal-area-picker">
          <legend>{copy.strategy.signals}</legend>
          {signalAreas.map(([value, label]) => (
            <label key={value}><input type="checkbox" name="signalAreas" value={value} defaultChecked={selectedAreas.has(value)} /><span>{label}</span></label>
          ))}
        </fieldset>
        <label><span>{copy.strategy.markets}</span><input name="regions" defaultValue={join(strategy?.regions ?? defaults.regions)} required /></label>
        <label><span>{copy.strategy.languages}</span><input name="languages" defaultValue={join(strategy?.languages ?? defaults.languages)} required /></label>
        <label className="wide"><span>{copy.strategy.projectTypes}</span><input name="projectTypes" defaultValue={join(strategy?.projectTypes ?? defaults.projectTypes)} required /></label>
        <label className="wide"><span>{copy.strategy.services}</span><input name="services" defaultValue={join(strategy?.services ?? defaults.services)} /></label>
      </div>

      <details className="strategy-advanced">
        <summary>{copy.strategy.advanced}</summary>
        <div className="strategy-core-grid">
          <label><span>{copy.strategy.sectors}</span><input name="sectors" defaultValue={join(strategy?.sectors ?? defaults.sectors)} /></label>
          <label><span>{copy.strategy.organizationTypes}</span><input name="organizationTypes" defaultValue={join(strategy?.organizationTypes ?? defaults.organizationTypes)} /></label>
          <label><span>{copy.strategy.keywords}</span><input name="keywords" defaultValue={join(strategy?.keywords ?? defaults.keywords)} /></label>
          <label><span>{copy.strategy.projectClues}</span><input name="projectClues" defaultValue={join(defaults.projectClues)} /></label>
          <label className="wide"><span>{copy.strategy.exclusions}</span><input name="exclusions" defaultValue={join(strategy?.exclusions ?? defaults.exclusions)} /></label>
          <label className="wide"><span>{copy.strategy.hardExcluded}</span><input name="hardExcludedSectors" defaultValue={join(strategy?.hardExcludedSectors ?? defaults.hardExcludedSectors)} /></label>
          <label className="wide"><span>{copy.strategy.sensitive}</span><input name="sensitiveSectors" defaultValue={join(strategy?.sensitiveSectors ?? defaults.sensitiveSectors)} /></label>
          <label><span>{copy.strategy.capacity}</span><select name="capacityStatus" defaultValue={strategy?.capacityStatus ?? defaults.capacityStatus}><option value="available">{copy.strategy.available}</option><option value="limited">{copy.strategy.limited}</option><option value="unavailable">{copy.strategy.unavailable}</option><option value="unknown">{copy.strategy.unknown}</option></select></label>
          <label><span>{copy.strategy.capacityThrough}</span><input type="date" name="capacityEffectiveUntil" defaultValue={strategy?.capacityEffectiveUntil ?? ""} /></label>
          <label className="wide"><span>{copy.strategy.capacityNote}</span><input name="capacityNote" defaultValue={strategy?.capacityNote ?? ""} placeholder="For example: one product squad from November" /></label>
          <input type="hidden" name="impactThemes" value={join(defaults.impactThemes)} />
          <label><span>{copy.strategy.minimumBudget}</span><input type="number" name="minimumProjectBudgetEur" min="0" step="1000" defaultValue={strategy?.minimumProjectBudgetEur ?? defaults.minimumProjectBudgetEur} /></label>
          <label><span>{copy.strategy.preferredFrom}</span><input type="number" name="preferredBudgetMinEur" min="0" step="1000" defaultValue={strategy?.preferredBudgetMinEur ?? defaults.preferredBudgetMinEur} /></label>
          <label><span>{copy.strategy.preferredTo}</span><input type="number" name="preferredBudgetMaxEur" min="0" step="1000" defaultValue={strategy?.preferredBudgetMaxEur ?? defaults.preferredBudgetMaxEur} /></label>
          <label><span>{copy.strategy.largeReview}</span><input type="number" name="largeProjectReviewEur" min="0" step="1000" defaultValue={strategy?.largeProjectReviewEur ?? defaults.largeProjectReviewEur} /></label>
          <label><span>{copy.strategy.lookback}</span><input type="number" name="lookbackDays" min="1" max="365" defaultValue={strategy?.lookbackDays ?? defaults.lookbackDays} /></label>
          <label><span>{copy.strategy.results}</span><input type="number" name="resultLimit" min="1" max="25" defaultValue={strategy?.resultLimit ?? defaults.resultLimit} /></label>
          <label><span>{copy.strategy.runLimit}</span><input type="number" name="runCostLimit" min="0" max="25" step="0.05" defaultValue={strategy?.runCostLimit ?? defaults.runCostLimit} /></label>
          <label><span>{copy.strategy.dailyLimit}</span><input type="number" name="dailyCostLimit" min="0" max="250" step="0.25" defaultValue={strategy?.dailyCostLimit ?? defaults.dailyCostLimit} /></label>
          <input type="hidden" name="timezone" value={strategy?.timezone ?? defaults.timezone} />
          <input type="hidden" name="monitorHour" value={strategy?.monitorHour ?? defaults.monitorHour} />
        </div>
      </details>
    </>
  );
}

export function LeadStrategyForm({ workspaceId, strategy }: { workspaceId: string; strategy: LeadStrategy | null }) {
  const { copy } = useInterfacePreferences();
  return (
    <form action={saveLeadStrategyAction} className="strategy-form">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <LeadStrategyFields workspaceId={workspaceId} strategy={strategy} />

      <div className="strategy-submit">
        <PendingButton pendingLabel={copy.strategy.saving}>{strategy ? copy.strategy.saveVersion : copy.strategy.saveStart}</PendingButton>
        <span>{copy.strategy.approvalNote}</span>
      </div>
    </form>
  );
}

export function SourceCandidateReviewForm({ workspaceId, candidateId }: { workspaceId: string; candidateId: string }) {
  const { copy } = useInterfacePreferences();
  return (
    <form action={reviewSourceCandidateAction} className="candidate-actions">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <label><span className="sr-only">{copy.strategy.reviewNote}</span><input name="note" placeholder={copy.strategy.reviewNote} /></label>
      <PendingButton pendingLabel={copy.strategy.approving} className="primary-action" name="decision" value="approved"><span>{copy.strategy.approve}</span></PendingButton>
      <button type="submit" name="decision" value="rejected" className="secondary-action">{copy.strategy.reject}</button>
    </form>
  );
}

export function AutomationToggleForm({ workspaceId, enabled }: { workspaceId: string; enabled: boolean }) {
  const { copy } = useInterfacePreferences();
  return (
    <form action={setLeadAutomationAction}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <PendingButton pendingLabel={copy.strategy.updating} className="secondary-action">{enabled ? copy.strategy.pause : copy.strategy.resume}</PendingButton>
    </form>
  );
}

export function RetryAutomationForm({ workspaceId, workflowId }: { workspaceId: string; workflowId: string }) {
  const { copy } = useInterfacePreferences();
  return (
    <form action={retryAutomationAction}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="workflowId" value={workflowId} />
      <PendingButton pendingLabel={copy.strategy.queueing} className="secondary-action">{copy.strategy.retry}</PendingButton>
    </form>
  );
}

export function QueueSourceMonitorForm({ workspaceId, sourceId }: { workspaceId: string; sourceId: string }) {
  const { copy } = useInterfacePreferences();
  return (
    <form action={queueSourceMonitorNowAction}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <PendingButton pendingLabel={copy.strategy.queueing} className="secondary-action">{copy.strategy.queueMonitor}</PendingButton>
    </form>
  );
}

export function ExceptionReviewForm({ workspaceId, exceptionId }: { workspaceId: string; exceptionId: string }) {
  const { copy } = useInterfacePreferences();
  return (
    <form action={reviewAutomationExceptionAction} className="exception-actions">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <label><span className="sr-only">{copy.strategy.reviewNote}</span><input name="note" placeholder={copy.strategy.reviewNote} /></label>
      <PendingButton pendingLabel={copy.strategy.queueing} name="decision" value="research">{copy.strategy.researchInfo}</PendingButton>
      <button type="submit" className="secondary-action" name="decision" value="dismissed">{copy.strategy.dismiss}</button>
    </form>
  );
}

export function LiveAutomationRunner({ workspaceId, initialStatus, disabledReason }: { workspaceId: string; initialStatus: OperatorAutomationStatus | null; disabledReason?: string | null }) {
  const { copy } = useInterfacePreferences();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusCheckedAt, setStatusCheckedAt] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<"idle" | "complete" | "error">("idle");
  const [message, setMessage] = useState(disabledReason ?? copy.runner.checking);
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
  const failurePresentation = getOperatorFailurePresentation(status?.lastFailure ?? null);
  let headline = copy.runner.ready;
  let detail = message;
  if (busy) {
    headline = presentation.label;
    detail = stageIsRunning
      ? presentation.description
      : copy.runner.claiming;
  } else if (failurePresentation?.tone === "retry") {
    headline = failurePresentation.headline;
    detail = failurePresentation.detail;
  } else if (outcome === "error") {
    headline = copy.runner.attention;
  } else if (failurePresentation) {
    headline = failurePresentation.headline;
    detail = failurePresentation.detail;
  } else if (outcome === "complete") {
    headline = copy.runner.clear;
  } else if (staleLease) {
    headline = copy.runner.recover;
    detail = copy.runner.recoverText;
  } else if (status?.readyStages) {
    headline = `${status.readyStages} ${status.readyStages === 1 ? copy.runner.readyStage : copy.runner.readyStages}`;
    detail = copy.runner.readyText;
  }

  const run = async () => {
    setRunning(true);
    setOutcome("idle");
    setProcessed(0);
    setRunStartedAt(Date.now());
    setMessage(copy.runner.claiming);
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
    <motion.section className={`live-runner ${busy ? "is-running" : failurePresentation?.tone === "retry" ? "retrying" : (outcome === "error" || failurePresentation ? "error" : outcome)}`} layout={!reduceMotion} aria-busy={busy}>
      <div className="live-runner-content">
        <div className="live-runner-heading">
          <motion.span
            className="live-runner-signal"
            animate={busy && !reduceMotion ? { opacity: [0.45, 1, 0.45], transform: ["scale(.86)", "scale(1)", "scale(.86)"] } : { opacity: 1, transform: "scale(1)" }}
            transition={busy && !reduceMotion ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
          />
          <div>
            <span className="live-runner-eyebrow">{busy ? (stageIsRunning && presentation.usesWebSearch ? copy.runner.webSearch : copy.runner.active) : copy.runner.label}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.strong key={headline} initial={reduceMotion ? false : { opacity: 0, transform: "translateY(4px)" }} animate={{ opacity: 1, transform: "translateY(0)" }} exit={reduceMotion ? undefined : { opacity: 0, transform: "translateY(-4px)" }} transition={{ duration: 0.18 }}>{headline}</motion.strong>
            </AnimatePresence>
          </div>
        </div>
        <p role="status" aria-live="polite">{detail}</p>
        <div className="live-runner-meta" aria-label={copy.runner.label}>
          {busy ? <span aria-label={`${copy.runner.elapsed} ${formatOperatorElapsed(elapsedSeconds)}`}>{copy.runner.elapsed} <strong aria-hidden="true">{formatOperatorElapsed(elapsedSeconds)}</strong></span> : null}
          <span>{copy.runner.processed} <strong>{processed}</strong></span>
          <span>{copy.runner.queued} <strong>{status?.queuedStages ?? 0}</strong></span>
          {status?.current ? <span>{copy.runner.attempt} <strong>{status.current.attempt}</strong>{status.current.pass > 1 ? ` · pass ${status.current.pass}` : ""}</span> : null}
          {status?.lastFailure?.retryScheduled ? <span>{copy.runner.retry} <strong>{status.lastFailure.retryAt ? formatOperatorRetryTime(status.lastFailure.retryAt) : copy.runner.queued.toLowerCase()}</strong></span> : null}
        </div>
        <div className="live-runner-track" aria-hidden="true">
          <motion.span
            animate={busy && !reduceMotion ? { transform: ["translateX(-110%)", "translateX(410%)"] } : { transform: busy ? "translateX(0%)" : "translateX(-110%)" }}
            transition={busy && !reduceMotion ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          />
        </div>
      </div>
      <button type="button" className="primary-action" onClick={run} disabled={busy || Boolean(disabledReason)}>
        {busy ? copy.runner.agentWorking : failurePresentation?.tone === "retry" ? copy.runner.runRetry : copy.runner.process}
      </button>
    </motion.section>
  );
}
