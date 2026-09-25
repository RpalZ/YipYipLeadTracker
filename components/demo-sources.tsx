"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useDemoWorkflow } from "@/components/use-demo-workflow";

const automationStages = [
  "Monitoring the approved source for new signals",
  "Validating citations and resolving exact entities",
  "Running the first evidence-backed assessment",
  "Researching only decision-relevant gaps",
  "Reassessing and routing finished opportunities",
];

const workflowLabels = ["Strategy", "Source approval", "Automation", "Qualified leads"];

export function DemoSources() {
  const { state, hydrated, dispatch } = useDemoWorkflow();
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
  }, [dispatch, reduceMotion, state.phase]);

  const reset = () => {
    scoutStarted.current = false;
    automationStarted.current = false;
    setAutomationStage(0);
    setRepeatRunning(false);
    dispatch({ type: "reset" });
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

  const activeStep = state.phase === "empty" || state.phase === "scouting"
    ? 0
    : state.phase === "awaiting_approval"
      ? 1
      : state.phase === "automating"
        ? 2
        : 3;
  const approvedCount = state.sourceCandidates.filter((source) => source.status === "approved").length;
  const proposedCount = state.sourceCandidates.filter((source) => source.status === "proposed").length;
  const qualifiedCount = state.opportunities.filter((item) => item.lifecycleStatus === "qualified").length;
  const attentionCount = state.opportunities.filter((item) => item.lifecycleStatus === "needs_review").length;

  return (
    <div className="sources-shell demo-sources-shell">
      <header className="site-header">
        <Link className="brand" href="/?demo=empty" aria-label="YipYip lead gallery home"><span>YY</span><strong>early_signal</strong></Link>
        <nav aria-label="Primary navigation">
          <Link href="/?demo=empty">Leads</Link>
          <Link href="/sources?demo=empty" aria-current="page">Source Network</Link>
          <Link href="/reviewed?demo=empty">Reviewed</Link>
        </nav>
        <span className="demo-account" aria-label="Interactive demo workspace">Demo</span>
      </header>

      <main>
        <section className="sources-heading demo-heading">
          <div>
            <span className="section-label">AUTONOMOUS WORKFLOW DEMO</span>
            <h1>Configure once. Review finished leads.</h1>
            <p>Edit the Lead Strategy and approve a reputable source once. Discovery, assessment, focused research, and qualification then continue automatically.</p>
          </div>
          <button type="button" className="quiet-action" disabled={!hydrated} onClick={reset}>Reset demo</button>
        </section>

        <div className="demo-simulation-note" role="note">
          This is a deterministic browser simulation. It sends no data to Supabase, OpenAI, or the example publishers.
        </div>

        <ol className="workflow-steps" aria-label="Demo workflow progress">
          {workflowLabels.map((label, index) => (
            <li key={label} className={index < activeStep ? "complete" : index === activeStep ? "active" : ""}>
              <span>{index < activeStep ? "✓" : index + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait" initial={false}>
          {!hydrated ? (
            <motion.section key="loading" className="demo-workflow-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="section-label">LOADING SESSION</span>
              <h2>Preparing the demo workspace…</h2>
            </motion.section>
          ) : state.phase === "empty" ? (
            <motion.section key="strategy" className="demo-workflow-card strategy-demo-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
              <div className="demo-card-copy">
                <span className="section-label">LEAD STRATEGY</span>
                <h2>Define what a worthwhile lead looks like</h2>
                <p>Dutch agency-pitch defaults are prefilled, but the strategy belongs to the workspace and remains editable.</p>
              </div>
              <div className="strategy-demo-fields">
                <label>Geography<input defaultValue="Netherlands" /></label>
                <label>Languages<input defaultValue="Dutch, English" /></label>
                <label>Services<input defaultValue="Strategy, service design, digital products" /></label>
                <label>Budget fit<input defaultValue="€30k minimum · €50k–€100k preferred" /></label>
                <label className="wide">Project types<textarea defaultValue="Websites, platforms, apps, redesigns, campaigns, agency reviews" /></label>
                <label className="wide">Exclusions<textarea defaultValue="Awarded projects, closed pitches, unrelated vacancies, restricted sources" /></label>
              </div>
              <motion.button whileTap={{ scale: 0.985 }} type="button" className="primary-action" onClick={() => dispatch({ type: "save_strategy" })}>
                Save and activate strategy
              </motion.button>
            </motion.section>
          ) : state.phase === "scouting" ? (
            <motion.section key="scouting" className="demo-workflow-card demo-live-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
              <span className="live-indicator" />
              <div><span className="section-label">SOURCE SCOUT</span><h2>Finding reputable sources…</h2><p>Checking relevance, public access, freshness, ownership, and policy concerns.</p></div>
            </motion.section>
          ) : state.phase === "awaiting_approval" ? (
            <motion.section key="approval" className="source-approval-section" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="section-heading">
                <div><span className="section-label">ONE-TIME HUMAN GATE</span><h2>Approve sources you trust</h2></div>
                <span>{proposedCount} awaiting review</span>
              </div>
              <p>Approval creates a weekday monitor immediately. The agents—not the user—handle each opportunity after this point.</p>
              <div className="candidate-grid">
                {state.sourceCandidates.map((source) => (
                  <article key={source.id} className={`source-candidate-card candidate-${source.status}`}>
                    <div className="candidate-heading"><span className="source-family">{source.sourceFamily}</span><strong>{source.reputationScore}<small>/100 reputation</small></strong></div>
                    <h3>{source.name}</h3>
                    <p>{source.rationale}</p>
                    <dl><div><dt>Class</dt><dd>{source.classification}</dd></div><div><dt>Scout confidence</dt><dd>{Math.round(source.confidence * 100)}%</dd></div></dl>
                    <ul>{source.sampleResults.map((sample) => <li key={sample}>{sample}</li>)}</ul>
                    {source.status === "proposed" ? (
                      <div className="candidate-actions">
                        <button type="button" className="primary-action" onClick={() => dispatch({ type: "review_source", sourceId: source.id, decision: "approved" })}>Approve source</button>
                        <button type="button" className="quiet-action" onClick={() => dispatch({ type: "review_source", sourceId: source.id, decision: "rejected" })}>Reject</button>
                      </div>
                    ) : <span className="neutral-pill">{source.status}</span>}
                  </article>
                ))}
              </div>
            </motion.section>
          ) : state.phase === "automating" ? (
            <motion.section key="automation" className="demo-workflow-card automation-progress-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-live="polite">
              <div className="progress-heading"><span className="live-indicator" /><strong>Autonomous workflow in progress</strong><span>Stage {automationStage + 1} of {automationStages.length}</span></div>
              <div className="progress-track" aria-hidden="true"><motion.i animate={{ width: `${((automationStage + 1) / automationStages.length) * 100}%` }} /></div>
              <h2>{automationStages[automationStage]}</h2>
              <p>No assessment button is required. Each bounded stage persists its result before the next one starts.</p>
            </motion.section>
          ) : (
            <motion.div key="completed" className="completed-demo-grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <section className="demo-results">
                <div className="section-heading">
                  <div><span className="section-label">AUTOMATIC OUTCOME</span><h2>{qualifiedCount} qualified leads</h2></div>
                  <Link className="primary-link" href="/?demo=empty">Open lead gallery →</Link>
                </div>
                <p>The engine completed assessment and research automatically. Only the ambiguous result needs human attention.</p>
                <div className="demo-result-list">
                  {state.opportunities.map((opportunity) => (
                    <Link key={opportunity.id} href={`/?demo=empty&lead=${opportunity.id}`}>
                      <span>{opportunity.organization}</span>
                      <strong>{opportunity.title}</strong>
                      <small>{opportunity.score}/100 · {opportunity.lifecycleStatus === "qualified" ? "Qualified" : "Needs attention"}</small>
                    </Link>
                  ))}
                </div>
              </section>
              <aside className="automation-outcome-card">
                <span className="section-label">AUTOMATION SUMMARY</span>
                <dl><div><dt>Active sources</dt><dd>{approvedCount}</dd></div><div><dt>Qualified</dt><dd>{qualifiedCount}</dd></div><div><dt>Needs attention</dt><dd>{attentionCount}</dd></div><div><dt>Simulated cost</dt><dd>€0.00</dd></div></dl>
                <button type="button" className="secondary-action" disabled={repeatRunning} onClick={repeatCycle}>{repeatRunning ? "Monitoring…" : "Simulate next weekday"}</button>
                <small>Repeat monitoring demonstrates exact-match deduplication.</small>
              </aside>
              <section className="automation-activity-timeline">
                <div className="section-heading"><div><span className="section-label">ACTIVITY</span><h2>What the system did</h2></div><span>{state.cycles.length} cycle{state.cycles.length === 1 ? "" : "s"}</span></div>
                <ol>{state.activity.map((item) => <li key={item.id} className={item.status}><span aria-hidden="true" /><div><strong>{item.label}</strong><p>{item.detail}</p></div></li>)}</ol>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
