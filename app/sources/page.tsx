import Link from "next/link";
import { redirect } from "next/navigation";

import { AutomationToggleForm, ExceptionReviewForm, LeadStrategyForm, LiveAutomationRunner, QueueSourceMonitorForm, RetryAutomationForm, SourceCandidateReviewForm, WorkspaceOnboardingForm } from "@/components/source-actions";
import { DemoSources } from "@/components/demo-sources";
import { getSourcesPageData } from "@/lib/data/discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const formatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const formatDate = (value: string | null) => value ? formatter.format(new Date(value)) : "Not yet";
const stageLabel = (value: string) => value.replaceAll("_", " ");

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.demo === "empty") return <DemoSources />;
  const workspaceId = typeof params.workspace === "string" ? params.workspace : undefined;
  const data = await getSourcesPageData(workspaceId);
  if (data.mode === "unauthenticated") redirect(`/login?error=${encodeURIComponent("Sign in to view the Source Network.")}`);
  if (!workspaceId && data.workspaces.length === 1) redirect(`/sources?workspace=${data.workspaces[0].id}`);
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;
  const pendingCandidates = data.candidates.filter((candidate) => candidate.status === "proposed" || candidate.status === "in_review");
  const selectedWorkspace = data.selectedWorkspace;

  return (
    <div className="sources-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="YipYip project board home"><span>YY</span><strong>early_signal</strong></Link>
        <nav aria-label="Primary navigation"><Link href="/">Leads</Link><Link href="/sources" aria-current="page">Source Network</Link><Link href="/reviewed">Reviewed</Link></nav>
        <a className="account-link" href="/login">YK</a>
      </header>

      <main>
        <section className="sources-heading">
          <div><span className="section-label">AUTONOMOUS LEAD ENGINE</span><h1>Source Network</h1><p>Set commercial intent once. YipYip scouts reputable sources, monitors approved coverage, assesses every candidate, and surfaces finished leads or true exceptions.</p></div>
          {data.workspaces.length ? (
            <form className="workspace-picker" method="get">
              <label htmlFor="workspace">Workspace</label>
              <select id="workspace" name="workspace" defaultValue={selectedWorkspace?.id ?? ""} required>
                <option value="" disabled>Select workspace</option>
                {data.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.role}</option>)}
              </select>
              <button type="submit">Open</button>
            </form>
          ) : null}
        </section>

        {success ? <p className="flash-message success" role="status">{success}</p> : null}
        {error ? <p className="flash-message error" role="alert">{error}</p> : null}

        {data.mode === "unconfigured" ? (
          <section className="sources-empty"><h2>Supabase is not configured</h2><p>Connect the local or hosted project to use persistent automation. The public demo remains available without credentials.</p><Link className="primary-link" href="/sources?demo=empty">Open automation demo →</Link></section>
        ) : !selectedWorkspace ? (
          <section className="sources-empty"><h2>{data.workspaces.length ? "Select a workspace" : "Create your workspace"}</h2><p>{data.workspaces.length ? "Strategies, sources, automation runs, and exceptions are isolated by workspace." : "This creates the private tenant where your Lead Strategy, approved sources, and automation history live."}</p>{data.workspaces.length ? null : <WorkspaceOnboardingForm />}</section>
        ) : (
          <>
            <section className="automation-summary" aria-label="Automation summary">
              <div><span>Approved sources</span><strong>{data.summary.activeSources}</strong><small>weekday monitoring</small></div>
              <div><span>Awaiting approval</span><strong>{data.summary.pendingApprovals}</strong><small>AI-proposed sources</small></div>
              <div><span>Needs attention</span><strong>{data.summary.openExceptions}</strong><small>not routine assessment</small></div>
              <div><span>Completed cycles</span><strong>{data.summary.successfulCycles}</strong><small>€{data.summary.totalEstimatedCost.toFixed(2)} estimated</small></div>
              <div><span>Last success</span><strong className="summary-date">{formatDate(data.summary.lastSuccessAt)}</strong><small>{data.runtimeReady ? "worker configured" : "worker configuration pending"}</small></div>
            </section>

            {!data.runtimeReady ? <p className="automation-config-note"><span />The workflow is configured but will not execute live until the server worker and secrets are enabled. {data.runtimeReason}</p> : null}

            {data.canOperate ? <LiveAutomationRunner workspaceId={selectedWorkspace.id} initialStatus={data.operatorStatus} disabledReason={data.runtimeReady ? null : data.runtimeReason} /> : null}

            {data.canOperate ? <LeadStrategyForm workspaceId={selectedWorkspace.id} strategy={data.strategy} /> : data.strategy ? (
              <section className="strategy-readonly"><span className="section-label">LEAD STRATEGY</span><h2>{data.strategy.name}</h2><p>{data.strategy.description}</p><p>Only owners and operators can publish a new strategy version.</p></section>
            ) : <section className="sources-empty"><h2>No Lead Strategy yet</h2><p>An owner or operator must define the workspace strategy before Source Scout can begin.</p></section>}

            {data.strategy ? (
              <div className="automation-control-row">
                <div><strong>Weekday automation</strong><span>{data.strategy.monitorHour.toString().padStart(2, "0")}:00 · {data.strategy.timezone} · next source refresh {formatDate(data.strategy.nextScoutAt)}</span></div>
                {data.canOperate ? <AutomationToggleForm workspaceId={selectedWorkspace.id} enabled={data.strategy.automationEnabled} /> : null}
              </div>
            ) : null}

            <section className="source-review-section">
              <div className="section-heading"><div><span className="section-label">ONE-TIME HUMAN GATE</span><h2>Source approval inbox</h2></div><span>{pendingCandidates.length} waiting</span></div>
              {pendingCandidates.length ? <div className="source-candidate-list">
                {pendingCandidates.map((candidate) => (
                  <article className="source-candidate-card" key={candidate.id}>
                    <div className="candidate-heading"><div><span>{candidate.sourceFamily} · {candidate.classification ?? "unclassified"}</span><h3>{candidate.name}</h3><a href={candidate.baseUrl} target="_blank" rel="noreferrer">{new URL(candidate.baseUrl).hostname} ↗</a></div><strong>{candidate.reputationScore === null ? "—" : Math.round(candidate.reputationScore * 100)}<small>/100 reputation</small></strong></div>
                    <p>{candidate.coverageRationale}</p>
                    <dl className="candidate-facts">
                      <div><dt>Access</dt><dd>{candidate.publicAccess ? "Public" : "Restricted"}</dd></div>
                      <div><dt>Observed cadence</dt><dd>{candidate.updateFrequency ?? "Unknown"}</dd></div>
                      <div><dt>Scout confidence</dt><dd>{Math.round(candidate.confidence * 100)}%</dd></div>
                      <div><dt>Estimated monthly cost</dt><dd>€{candidate.estimatedMonthlyCost.toFixed(2)}</dd></div>
                    </dl>
                    {candidate.sampleEvidence.length ? <details className="candidate-evidence"><summary>{candidate.sampleEvidence.length} sample result{candidate.sampleEvidence.length === 1 ? "" : "s"}</summary>{candidate.sampleEvidence.map((sample) => <a key={sample.url} href={sample.url} target="_blank" rel="noreferrer"><strong>{sample.title}</strong><span>{sample.relevance}</span></a>)}</details> : null}
                    {data.canOperate ? <SourceCandidateReviewForm workspaceId={selectedWorkspace.id} candidateId={candidate.id} /> : null}
                  </article>
                ))}
              </div> : <div className="sources-empty compact">
                <h3>{data.strategy ? (data.latestScoutResult?.proposalCount === 0 ? "Latest scout found no reviewable sources" : "No sources waiting for approval") : "Source Scout starts after the strategy is saved"}</h3>
                <p>{data.latestScoutResult?.proposalCount === 0
                  ? data.latestScoutResult.generatedCount === null
                    ? "The previous scout completed without a proposal that passed the evidence checks. Nothing requires approval; run a new scout after applying the latest worker fix."
                    : `${data.latestScoutResult.generatedCount} generated proposal${data.latestScoutResult.generatedCount === 1 ? "" : "s"}; ${data.latestScoutResult.rejectedForEvidence ?? 0} failed citation or evidence validation and ${data.latestScoutResult.suppressedCount ?? 0} matched a prior rejection. Nothing requires approval.`
                  : "Routine monitoring and assessment require no approval clicks. Only new technical sources enter this inbox."}</p>
              </div>}
            </section>

            <section className="approved-sources-section">
              <div className="section-heading"><div><span className="section-label">RECURRING COVERAGE</span><h2>Approved sources</h2></div><span>{data.sources.length} governed monitors</span></div>
              {data.sources.length ? <div className="approved-source-list">{data.sources.map((source) => (
                <article key={source.id}><div><span className={`health-dot health-${source.health}`} /><strong>{source.name}</strong><small>{source.sourceFamily}</small></div><dl><div><dt>Reputation</dt><dd>{source.reputationScore === null ? "Not scored" : `${Math.round(source.reputationScore * 100)}/100`}</dd></div><div><dt>Health</dt><dd>{source.health}</dd></div><div><dt>Last run</dt><dd>{formatDate(source.lastRunAt)}</dd></div><div><dt>Next run</dt><dd>{formatDate(source.nextRunAt)}</dd></div></dl>{data.canOperate ? <QueueSourceMonitorForm workspaceId={selectedWorkspace.id} sourceId={source.id} /> : null}</article>
              ))}</div> : <div className="sources-empty compact"><h3>No approved sources yet</h3><p>Approve a Source Scout proposal once; recurring monitoring starts automatically.</p></div>}
            </section>

            <section className="automation-activity">
              <div className="section-heading"><div><span className="section-label">AUDITABLE AUTOMATION</span><h2>Recent activity</h2></div><span>{data.cycles.length} cycles</span></div>
              {data.cycles.length ? <div className="activity-list">{data.cycles.map((cycle) => (
                <article key={cycle.id}><span className={`activity-status ${cycle.status}`} /> <div><strong>{stageLabel(cycle.kind)}</strong><span>{stageLabel(cycle.currentStage)} · {stageLabel(cycle.status)}</span></div><small>{formatDate(cycle.createdAt)} · €{cycle.estimatedCost.toFixed(3)}</small>{cycle.failureReason ? <p>{cycle.failureReason}</p> : null}{cycle.status === "failed" && data.canOperate ? <RetryAutomationForm workspaceId={selectedWorkspace.id} workflowId={cycle.id} /> : null}</article>
              ))}</div> : <div className="sources-empty compact"><h3>No automation activity yet</h3><p>Saving a Lead Strategy creates the first Source Scout cycle automatically.</p></div>}
            </section>

            {data.exceptions.length ? <section className="automation-exceptions"><div className="section-heading"><div><span className="section-label">HUMAN ATTENTION</span><h2>Exceptions</h2></div><span>{data.summary.openExceptions} open</span></div>{data.exceptions.map((item) => <article key={item.id}><span>{stageLabel(item.kind)}</span><strong>{item.summary}</strong><small>{formatDate(item.createdAt)} · {item.status}</small>{item.opportunityId ? <Link href={`/?lead=${item.opportunityId}`}>Review opportunity →</Link> : null}{item.status === "open" && selectedWorkspace.role !== "viewer" ? <ExceptionReviewForm workspaceId={selectedWorkspace.id} exceptionId={item.id} /> : null}</article>)}</section> : null}
          </>
        )}
      </main>
    </div>
  );
}
