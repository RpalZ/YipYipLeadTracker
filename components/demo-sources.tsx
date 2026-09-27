"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { InterfacePreferenceControls, useInterfacePreferences } from "@/components/interface-preferences";
import { ReviewBasketControl } from "@/components/review-basket-control";
import { LeadStrategyFields } from "@/components/source-actions";
import { useDemoWorkflow } from "@/components/use-demo-workflow";

export function DemoSources() {
  const { copy, locale } = useInterfacePreferences();
  const coverageCopy = locale === "nl"
    ? { gap: "Dekkingshiaat", novelty: "Nieuwe dekking", simulated: "Gesimuleerd" }
    : { gap: "Coverage gap", novelty: "New coverage", simulated: "Simulated" };
  const { state, hydrated, dispatch } = useDemoWorkflow();
  const automationStages = useMemo(() => [
    copy.demo.stageMonitor,
    copy.demo.stageNormalize,
    copy.demo.stageAssess,
    copy.demo.stageResearch,
    copy.demo.stageReassess,
    copy.demo.stageRoute,
  ], [copy]);
  const reduceMotion = useReducedMotion();
  const [automationStage, setAutomationStage] = useState(0);
  const [repeatRunning, setRepeatRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const scoutStarted = useRef(false);
  const automationStarted = useRef(false);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  useEffect(() => {
    if (state.phase !== "scouting" || scoutStarted.current) return;
    scoutStarted.current = true;
    const timer = window.setTimeout(
      () => dispatch({ type: "complete_source_scout" }),
      reduceMotion ? 120 : 1_150,
    );
    timers.current.push(timer);
  }, [dispatch, reduceMotion, state.phase]);

  useEffect(() => {
    if (state.phase !== "automating" || automationStarted.current) return;
    automationStarted.current = true;
    let cancelled = false;
    const run = async () => {
      for (let index = 0; index < automationStages.length; index += 1) {
        if (cancelled) return;
        setAutomationStage(index);
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, reduceMotion ? 100 : 650);
          timers.current.push(timer);
        });
      }
      if (!cancelled) dispatch({
        type: "complete_automation",
        cycleId: `demo-cycle-${Date.now()}`,
        completedAt: new Date().toISOString(),
        durationMs: reduceMotion ? 500 : 3_250,
      });
    };
    void run();
    return () => { cancelled = true; };
  }, [automationStages.length, dispatch, reduceMotion, state.phase]);

  const reset = () => {
    scoutStarted.current = false;
    automationStarted.current = false;
    setAutomationStage(0);
    setRepeatRunning(false);
    dispatch({ type: "reset" });
  };

  const saveStrategy = () => {
    scoutStarted.current = false;
    automationStarted.current = false;
    setAutomationStage(0);
    setRepeatRunning(false);
    dispatch({ type: "save_strategy" });
  };

  const reviewSource = (sourceId: string, decision: "approved" | "rejected") => {
    if (decision === "approved") {
      automationStarted.current = false;
      setAutomationStage(0);
    }
    dispatch({ type: "review_source", sourceId, decision });
  };

  const repeatCycle = () => {
    if (repeatRunning) return;
    setRepeatRunning(true);
    const timer = window.setTimeout(() => {
      dispatch({ type: "complete_repeat_cycle", cycleId: `demo-repeat-${Date.now()}`, completedAt: new Date().toISOString() });
      setRepeatRunning(false);
    }, reduceMotion ? 100 : 900);
    timers.current.push(timer);
  };

  const proposedSources = state.sourceCandidates.filter((source) => source.status === "proposed");
  const approvedSources = state.sourceCandidates.filter((source) => source.status === "approved");
  const qualifiedCount = state.opportunities.filter((item) => item.lifecycleStatus === "qualified").length;
  const attentionCount = state.opportunities.filter((item) => item.lifecycleStatus === "needs_review").length;
  const latestCycle = state.cycles[0] ?? null;
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : copy.common.notYet;
  const running = state.phase === "scouting" || state.phase === "automating";
  const runnerHeadline = state.phase === "scouting"
    ? copy.demo.finding
    : state.phase === "awaiting_approval"
      ? copy.demo.approveTitle
      : state.phase === "automating"
        ? automationStages[automationStage]
        : state.phase === "completed"
          ? copy.runner.clear
          : copy.runner.ready;
  const runnerDetail = state.phase === "scouting"
    ? copy.demo.checking
    : state.phase === "awaiting_approval"
      ? copy.demo.approvalText
      : state.phase === "automating"
        ? copy.demo.noButton
        : state.phase === "completed"
          ? copy.demo.completedText
          : copy.sources.noActivityText;
  const processedStages = state.phase === "automating"
    ? automationStage
    : state.phase === "completed" ? automationStages.length : 0;
  const queuedStages = state.phase === "scouting"
    ? 1
    : state.phase === "automating" ? Math.max(0, automationStages.length - automationStage - 1) : 0;

  return (
    <div className="sources-shell demo-sources-shell">
      <header className="site-header">
        <Link className="brand" href="/?demo=empty" aria-label={copy.nav.homeLabel}><span>YY</span><strong>early_signal</strong></Link>
        <nav aria-label={copy.nav.primaryLabel}>
          <Link href="/?demo=empty">{copy.nav.leads}</Link>
          <Link href="/sources?demo=empty" aria-current="page">{copy.nav.sourceNetwork}</Link>
          <Link href="/reviewed?demo=empty">{copy.nav.pursuitWorkspace}</Link>
          <ReviewBasketControl opportunities={state.opportunities} scope="demo:empty" demoMode="empty" />
        </nav>
        <InterfacePreferenceControls />
        <span className="demo-account" aria-label={copy.common.demo}>{copy.common.demo}</span>
      </header>

      <main>
        <section className="sources-heading demo-heading">
          <div>
            <span className="section-label">{copy.sources.eyebrow}</span>
            <h1>{copy.sources.title}</h1>
            <p>{copy.sources.intro}</p>
          </div>
          <button type="button" className="quiet-action" disabled={!hydrated} onClick={reset}>{copy.demo.reset}</button>
        </section>

        <div className="demo-simulation-note" role="note">
          <strong>{copy.common.demo}.</strong> {copy.demo.note}
        </div>

        <section className="automation-summary" aria-label={copy.demo.summary}>
          <div><span>{copy.sources.approved}</span><strong>{approvedSources.length}</strong><small>{copy.sources.weekday}</small></div>
          <div><span>{copy.sources.awaiting}</span><strong>{proposedSources.length}</strong><small>{copy.sources.proposed}</small></div>
          <div><span>{copy.sources.attention}</span><strong>{attentionCount}</strong><small>{copy.sources.notRoutine}</small></div>
          <div><span>{copy.sources.completed}</span><strong>{state.cycles.length}</strong><small>€0.00 {copy.sources.estimated}</small></div>
          <div><span>{copy.sources.lastSuccess}</span><strong className="summary-date">{formatDate(latestCycle?.completedAt ?? null)}</strong><small>{coverageCopy.simulated} · {copy.sources.workerReady}</small></div>
        </section>

        <motion.section className={`live-runner demo-live-runner ${running ? "is-running" : "complete"}`} aria-busy={running}>
          <div className="live-runner-content">
            <div className="live-runner-heading">
              <motion.span
                className="live-runner-signal"
                animate={running && !reduceMotion ? { opacity: [0.45, 1, 0.45], transform: ["scale(.86)", "scale(1)", "scale(.86)"] } : { opacity: 1, transform: "scale(1)" }}
                transition={running && !reduceMotion ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
              />
              <div>
                <span className="live-runner-eyebrow">{coverageCopy.simulated} · {running ? copy.runner.active : copy.runner.label}</span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.strong key={runnerHeadline} initial={reduceMotion ? false : { opacity: 0, transform: "translateY(4px)" }} animate={{ opacity: 1, transform: "translateY(0)" }} exit={reduceMotion ? undefined : { opacity: 0, transform: "translateY(-4px)" }} transition={{ duration: 0.18 }}>{runnerHeadline}</motion.strong>
                </AnimatePresence>
              </div>
            </div>
            <p role="status" aria-live="polite">{runnerDetail}</p>
            <div className="live-runner-meta" aria-label={copy.demo.progress}>
              <span>{copy.runner.processed} <strong>{processedStages}</strong></span>
              <span>{copy.runner.queued} <strong>{queuedStages}</strong></span>
              {state.phase === "automating" ? <span>{copy.demo.stage} <strong>{automationStage + 1}/{automationStages.length}</strong></span> : null}
            </div>
            <div className="live-runner-track" aria-hidden="true">
              <motion.span
                animate={running && !reduceMotion ? { transform: ["translateX(-110%)", "translateX(410%)"] } : { transform: running ? "translateX(0%)" : "translateX(-110%)" }}
                transition={running && !reduceMotion ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
              />
            </div>
          </div>
          <button type="button" className={state.phase === "completed" ? "secondary-action" : "primary-action"} disabled={state.phase !== "completed" || repeatRunning} onClick={repeatCycle}>
            {repeatRunning
              ? copy.demo.monitoring
              : state.phase === "completed"
                ? copy.demo.nextWeekday
                : running
                  ? copy.runner.agentWorking
                  : state.phase === "awaiting_approval" ? copy.demo.approve : copy.demo.save}
          </button>
        </motion.section>

        <form className="strategy-form" onSubmit={(event) => { event.preventDefault(); saveStrategy(); }}>
          <LeadStrategyFields
            workspaceId="demo-workspace"
            strategy={null}
            displayVersion={state.strategySaved ? 1 : null}
            displayAutomationEnabled={state.strategySaved ? true : null}
            defaultsOverride={{
              capacityStatus: "available",
              capacityEffectiveUntil: "2027-03-31",
              capacityNote: "One product squad available for the coming delivery window.",
            }}
          />
          <div className="strategy-submit">
            <motion.button whileTap={reduceMotion ? undefined : { transform: "scale(.985)" }} type="submit" className="primary-action" disabled={!hydrated || running}>
              {state.strategySaved ? copy.strategy.saveVersion : copy.strategy.saveStart}
            </motion.button>
            <span>{copy.strategy.approvalNote}</span>
          </div>
        </form>

        {state.strategySaved ? (
          <div className="automation-control-row">
            <div><strong>{copy.sources.weekdayAutomation}</strong><span>07:00 · Europe/Amsterdam · {copy.sources.nextRefresh} {copy.common.notYet}</span></div>
            <button type="button" className="secondary-action" disabled>{copy.strategy.pause}</button>
          </div>
        ) : null}

        {state.phase === "completed" ? (
          <motion.section className="demo-live-outcome" initial={reduceMotion ? false : { opacity: 0, transform: "translateY(6px)" }} animate={{ opacity: 1, transform: "translateY(0)" }}>
            <div><span className="section-label">{copy.demo.outcome}</span><h2>{qualifiedCount} {copy.demo.qualifiedLeads}</h2><p>{copy.demo.completedText}</p></div>
            <Link className="primary-link" href="/?demo=empty">{copy.demo.openGallery}</Link>
          </motion.section>
        ) : null}

        <section className="source-review-section">
          <div className="section-heading"><div><span className="section-label">{copy.sources.gate}</span><h2>{copy.sources.inbox}</h2></div><span>{proposedSources.length} {copy.sources.waiting}</span></div>
          {proposedSources.length ? (
            <div className="source-candidate-list">
              {proposedSources.map((source) => (
                <article className="source-candidate-card" key={source.id}>
                  <div className="candidate-heading">
                    <div><span>{source.sourceFamily} · {source.classification}</span><h3>{source.name}</h3><a href={source.url} target="_blank" rel="noreferrer">{new URL(source.url).hostname} ↗</a></div>
                    <strong>{source.reputationScore}<small>/100 {copy.sources.reputation}</small></strong>
                  </div>
                  <p>{source.rationale}</p>
                  <dl className="candidate-facts">
                    <div><dt>{coverageCopy.gap}</dt><dd>{source.coverageGap}</dd></div>
                    <div><dt>{copy.sources.access}</dt><dd>{source.publicAccess ? copy.sources.public : copy.sources.restricted}</dd></div>
                    <div><dt>{copy.sources.cadence}</dt><dd>{source.updateFrequency}</dd></div>
                    <div><dt>{copy.sources.scoutConfidence}</dt><dd>{Math.round(source.confidence * 100)}%</dd></div>
                    <div><dt>{copy.sources.monthlyCost}</dt><dd>€{source.estimatedMonthlyCost.toFixed(2)}</dd></div>
                  </dl>
                  <p className="candidate-novelty"><strong>{coverageCopy.novelty}</strong>{source.noveltyReason}</p>
                  <details className="candidate-evidence"><summary>{source.sampleEvidence.length} {copy.sources.sampleResults}</summary>{source.sampleEvidence.map((sample) => <a key={`${source.id}-${sample.title}`} href={sample.url} target="_blank" rel="noreferrer"><strong>{sample.title}</strong><span>{sample.relevance}</span></a>)}</details>
                  <div className="candidate-actions">
                    <label><span className="sr-only">{copy.strategy.reviewNote}</span><input placeholder={copy.strategy.reviewNote} /></label>
                    <button type="button" className="primary-action" onClick={() => reviewSource(source.id, "approved")}>{copy.strategy.approve}</button>
                    <button type="button" className="secondary-action" onClick={() => reviewSource(source.id, "rejected")}>{copy.strategy.reject}</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="sources-empty compact">
              <h3>{state.phase === "scouting" ? copy.demo.finding : state.strategySaved ? copy.sources.noneWaiting : copy.sources.scoutAfterSave}</h3>
              <p>{state.phase === "scouting" ? copy.demo.checking : copy.sources.routineText}</p>
            </div>
          )}
        </section>

        <section className="approved-sources-section">
          <div className="section-heading"><div><span className="section-label">{copy.sources.recurring}</span><h2>{copy.sources.approved}</h2></div><span>{approvedSources.length} {copy.sources.governedMonitors}</span></div>
          {approvedSources.length ? (
            <div className="approved-source-list">
              {approvedSources.map((source) => (
                <article key={source.id}>
                  <div><span className={`health-dot ${latestCycle ? "health-healthy" : ""}`} /><strong>{source.name}</strong><small>{source.sourceFamily}</small></div>
                  <dl>
                    <div><dt>{copy.sources.reputation}</dt><dd>{source.reputationScore}/100</dd></div>
                    <div><dt>{copy.sources.health}</dt><dd>{latestCycle ? "healthy" : "paused"}</dd></div>
                    <div><dt>{copy.sources.lastRun}</dt><dd>{formatDate(latestCycle?.completedAt ?? null)}</dd></div>
                    <div><dt>{copy.sources.nextRun}</dt><dd>07:00 · Europe/Amsterdam</dd></div>
                  </dl>
                  <button type="button" className="secondary-action" disabled>{copy.strategy.queueMonitor}</button>
                </article>
              ))}
            </div>
          ) : <div className="sources-empty compact"><h3>{copy.sources.noApproved}</h3><p>{copy.sources.noApprovedText}</p></div>}
        </section>

        <section className="automation-activity">
          <div className="section-heading"><div><span className="section-label">{copy.sources.auditable}</span><h2>{copy.sources.recent}</h2></div><span>{state.cycles.length} {copy.sources.cycles}</span></div>
          {state.activity.length ? (
            <div className="activity-list source-history-scroll" role="region" aria-label={copy.sources.recent} tabIndex={0}>
              {state.activity.map((item) => (
                <article key={item.id}>
                  <span className={`activity-status ${item.status === "attention" ? "waiting_approval" : "succeeded"}`} />
                  <div><strong>{item.label}</strong><span>{item.detail}</span></div>
                  <small>{coverageCopy.simulated} · €0.000</small>
                </article>
              ))}
            </div>
          ) : <div className="sources-empty compact"><h3>{copy.sources.noActivity}</h3><p>{copy.sources.noActivityText}</p></div>}
        </section>

        {attentionCount ? (
          <section className="automation-exceptions">
            <div className="section-heading"><div><span className="section-label">{copy.sources.humanAttention}</span><h2>{copy.sources.exceptions}</h2></div><span>{attentionCount} {copy.common.open.toLowerCase()}</span></div>
            <div className="source-history-scroll" role="region" aria-label={copy.sources.exceptions} tabIndex={0}>
              {state.opportunities.filter((item) => item.lifecycleStatus === "needs_review").map((item) => (
                <article key={item.id}><span>{item.attentionException?.kind.replaceAll("_", " ") ?? copy.common.needsAttention}</span><strong>{item.title}</strong><small>{item.attentionException?.summary}</small><Link href={`/?demo=empty&lead=${item.id}&tab=review`}>{copy.sources.resolve}</Link></article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
