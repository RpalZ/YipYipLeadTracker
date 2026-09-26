import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { InterfacePreferenceControls } from "@/components/interface-preferences";
import { AutomationToggleForm, ExceptionReviewForm, LeadStrategyForm, LiveAutomationRunner, QueueSourceMonitorForm, RetryAutomationForm, SourceCandidateReviewForm, WorkspaceOnboardingForm } from "@/components/source-actions";
import { DemoSources } from "@/components/demo-sources";
import { ReviewBasketControl } from "@/components/review-basket-control";
import { getSourcesPageData } from "@/lib/data/discovery";
import { getDashboardData } from "@/lib/data/opportunities";
import { localeTag, uiCopy } from "@/lib/i18n";
import { resolveUiLocale, UI_LOCALE_COOKIE } from "@/lib/interface-preferences";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const stageLabel = (value: string) => value.replaceAll("_", " ");
const rejectionSummary = (counts: Record<string, number>) => Object.entries(counts)
  .map(([reason, count]) => `${stageLabel(reason)} ${count}`)
  .join(" · ");

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const cookieStore = await cookies();
  const locale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  const copy = uiCopy[locale];
  const coverageCopy = locale === "nl"
    ? { gap: "Dekkingshiaat", novelty: "Nieuwe dekking", coverageRejected: "vulden geen nieuw dekkingshiaat" }
    : { gap: "Coverage gap", novelty: "New coverage", coverageRejected: "did not add new coverage" };
  const exceptionLabel = (value: string) => value === "capability_fit_uncertain"
    ? copy.resolution.technicalCapability
    : value === "delivery_capacity_uncertain"
      ? copy.resolution.deliveryCapacity
      : stageLabel(value);
  const formatter = new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const formatDate = (value: string | null) => value ? formatter.format(new Date(value)) : copy.common.notYet;
  const params = await searchParams;
  if (params.demo === "empty") return <DemoSources />;
  const workspaceId = typeof params.workspace === "string" ? params.workspace : undefined;
  const data = await getSourcesPageData(workspaceId);
  if (data.mode === "unauthenticated") redirect(`/login?error=${encodeURIComponent("Sign in to view the Source Network.")}`);
  if (!workspaceId && data.workspaces.length === 1) redirect(`/sources?workspace=${data.workspaces[0].id}`);
  const basketData = await getDashboardData();
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;
  const pendingCandidates = data.candidates.filter((candidate) => candidate.status === "proposed" || candidate.status === "in_review");
  const selectedWorkspace = data.selectedWorkspace;

  return (
    <div className="sources-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label={copy.nav.homeLabel}><span>YY</span><strong>early_signal</strong></Link>
        <nav aria-label={copy.nav.primaryLabel}><Link href="/">{copy.nav.leads}</Link><Link href="/sources" aria-current="page">{copy.nav.sourceNetwork}</Link><Link href="/reviewed">{copy.nav.pursuitWorkspace}</Link><ReviewBasketControl opportunities={basketData.opportunities} scope={basketData.mode === "demo" ? `demo:${basketData.demoMode ?? "sample"}` : "supabase"} demoMode={basketData.demoMode} /></nav>
        <InterfacePreferenceControls />
        <a className="account-link" href="/login" aria-label={copy.nav.account}>YK</a>
      </header>

      <main>
        <section className="sources-heading">
          <div><span className="section-label">{copy.sources.eyebrow}</span><h1>{copy.sources.title}</h1><p>{copy.sources.intro}</p></div>
          {data.workspaces.length ? (
            <form className="workspace-picker" method="get">
              <label htmlFor="workspace">{copy.sources.workspace}</label>
              <select id="workspace" name="workspace" defaultValue={selectedWorkspace?.id ?? ""} required>
                <option value="" disabled>{copy.sources.selectWorkspace}</option>
                {data.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.role}</option>)}
              </select>
              <button type="submit">{copy.sources.open}</button>
            </form>
          ) : null}
        </section>

        {success ? <p className="flash-message success" role="status">{success}</p> : null}
        {error ? <p className="flash-message error" role="alert">{error}</p> : null}

        {data.mode === "unconfigured" ? (
          <section className="sources-empty"><h2>{copy.sources.unconfigured}</h2><p>{copy.sources.unconfiguredText}</p><Link className="primary-link" href="/sources?demo=empty">{copy.sources.openDemo}</Link></section>
        ) : !selectedWorkspace ? (
          <section className="sources-empty"><h2>{data.workspaces.length ? copy.sources.selectWorkspaceTitle : copy.sources.createWorkspace}</h2><p>{data.workspaces.length ? copy.sources.isolated : copy.sources.createText}</p>{data.workspaces.length ? null : <WorkspaceOnboardingForm />}</section>
        ) : (
          <>
            <section className="automation-summary" aria-label="Automation summary">
              <div><span>{copy.sources.approved}</span><strong>{data.summary.activeSources}</strong><small>{copy.sources.weekday}</small></div>
              <div><span>{copy.sources.awaiting}</span><strong>{data.summary.pendingApprovals}</strong><small>{copy.sources.proposed}</small></div>
              <div><span>{copy.sources.attention}</span><strong>{data.summary.openExceptions}</strong><small>{copy.sources.notRoutine}</small></div>
              <div><span>{copy.sources.completed}</span><strong>{data.summary.successfulCycles}</strong><small>€{data.summary.totalEstimatedCost.toFixed(2)} {copy.sources.estimated}</small></div>
              <div><span>{copy.sources.lastSuccess}</span><strong className="summary-date">{formatDate(data.summary.lastSuccessAt)}</strong><small>{data.runtimeReady ? copy.sources.workerReady : copy.sources.workerPending}</small></div>
            </section>

            {!data.runtimeReady ? <p className="automation-config-note"><span />{copy.sources.runtimePending} {data.runtimeReason}</p> : null}

            {data.canOperate ? <LiveAutomationRunner workspaceId={selectedWorkspace.id} initialStatus={data.operatorStatus} disabledReason={data.runtimeReady ? null : data.runtimeReason} /> : null}

            {data.canOperate ? <LeadStrategyForm workspaceId={selectedWorkspace.id} strategy={data.strategy} /> : data.strategy ? (
              <section className="strategy-readonly"><span className="section-label">{copy.sources.strategy}</span><h2>{data.strategy.name}</h2><p>{data.strategy.description}</p><p>{copy.sources.strategyReadOnly}</p></section>
            ) : <section className="sources-empty"><h2>{copy.sources.noStrategy}</h2><p>{copy.sources.noStrategyText}</p></section>}

            {data.strategy ? (
              <div className="automation-control-row">
                <div><strong>{copy.sources.weekdayAutomation}</strong><span>{data.strategy.monitorHour.toString().padStart(2, "0")}:00 · {data.strategy.timezone} · {copy.sources.nextRefresh} {formatDate(data.strategy.nextScoutAt)}</span></div>
                {data.canOperate ? <AutomationToggleForm workspaceId={selectedWorkspace.id} enabled={data.strategy.automationEnabled} /> : null}
              </div>
            ) : null}

            <section className="source-review-section">
              <div className="section-heading"><div><span className="section-label">{copy.sources.gate}</span><h2>{copy.sources.inbox}</h2></div><span>{pendingCandidates.length} {copy.sources.waiting}</span></div>
              {pendingCandidates.length ? <div className="source-candidate-list">
                {pendingCandidates.map((candidate) => (
                  <article className="source-candidate-card" key={candidate.id}>
                    <div className="candidate-heading"><div><span>{candidate.sourceFamily} · {candidate.classification ?? copy.common.unknown}</span><h3>{candidate.name}</h3><a href={candidate.baseUrl} target="_blank" rel="noreferrer">{new URL(candidate.baseUrl).hostname} ↗</a></div><strong>{candidate.reputationScore === null ? "—" : Math.round(candidate.reputationScore * 100)}<small>/100 {copy.sources.reputation}</small></strong></div>
                    <p>{candidate.coverageRationale}</p>
                    <dl className="candidate-facts">
                      <div><dt>{coverageCopy.gap}</dt><dd>{candidate.coverageGap ? stageLabel(candidate.coverageGap) : copy.common.unknown}</dd></div>
                      <div><dt>{copy.sources.access}</dt><dd>{candidate.publicAccess ? copy.sources.public : copy.sources.restricted}</dd></div>
                      <div><dt>{copy.sources.cadence}</dt><dd>{candidate.updateFrequency ?? copy.common.unknown}</dd></div>
                      <div><dt>{copy.sources.scoutConfidence}</dt><dd>{Math.round(candidate.confidence * 100)}%</dd></div>
                      <div><dt>{copy.sources.monthlyCost}</dt><dd>€{candidate.estimatedMonthlyCost.toFixed(2)}</dd></div>
                    </dl>
                    {candidate.noveltyReason ? <p className="candidate-novelty"><strong>{coverageCopy.novelty}</strong>{candidate.noveltyReason}</p> : null}
                    {candidate.sampleEvidence.length ? <details className="candidate-evidence"><summary>{candidate.sampleEvidence.length} {candidate.sampleEvidence.length === 1 ? copy.sources.sampleResult : copy.sources.sampleResults}</summary>{candidate.sampleEvidence.map((sample) => <a key={sample.url} href={sample.url} target="_blank" rel="noreferrer"><strong>{sample.title}</strong><span>{sample.relevance}</span></a>)}</details> : null}
                    {data.canOperate ? <SourceCandidateReviewForm workspaceId={selectedWorkspace.id} candidateId={candidate.id} /> : null}
                  </article>
                ))}
              </div> : <div className="sources-empty compact">
                <h3>{data.strategy ? (data.latestScoutResult?.proposalCount === 0 ? copy.sources.noReviewable : copy.sources.noneWaiting) : copy.sources.scoutAfterSave}</h3>
                <p>{data.latestScoutResult?.proposalCount === 0
                  ? data.latestScoutResult.generatedCount === null
                    ? "The previous scout completed without a proposal that passed the evidence checks. Nothing requires approval; run a new scout after applying the latest worker fix."
                    : `${data.latestScoutResult.generatedCount} generated proposal${data.latestScoutResult.generatedCount === 1 ? "" : "s"}; ${data.latestScoutResult.rejectedForEvidence ?? 0} failed citation or evidence validation, ${data.latestScoutResult.rejectedForCoverage ?? 0} ${coverageCopy.coverageRejected}, and ${data.latestScoutResult.suppressedCount ?? 0} matched a prior rejection. Nothing requires approval.`
                  : copy.sources.routineText}</p>
              </div>}
            </section>

            <section className="approved-sources-section">
              <div className="section-heading"><div><span className="section-label">{copy.sources.recurring}</span><h2>{copy.sources.approved}</h2></div><span>{data.sources.length} {copy.sources.governedMonitors}</span></div>
              {data.sources.length ? <div className="approved-source-list">{data.sources.map((source) => (
                <article key={source.id}><div><span className={`health-dot health-${source.health}`} /><strong>{source.name}</strong><small>{source.sourceFamily}</small></div><dl><div><dt>{copy.sources.reputation}</dt><dd>{source.reputationScore === null ? copy.sources.notScored : `${Math.round(source.reputationScore * 100)}/100`}</dd></div><div><dt>{copy.sources.health}</dt><dd>{source.health}</dd></div><div><dt>{copy.sources.lastRun}</dt><dd>{formatDate(source.lastRunAt)}</dd></div><div><dt>{copy.sources.nextRun}</dt><dd>{formatDate(source.nextRunAt)}</dd></div></dl>{data.canOperate ? <QueueSourceMonitorForm workspaceId={selectedWorkspace.id} sourceId={source.id} /> : null}</article>
              ))}</div> : <div className="sources-empty compact"><h3>{copy.sources.noApproved}</h3><p>{copy.sources.noApprovedText}</p></div>}
            </section>

            <section className="automation-activity">
              <div className="section-heading"><div><span className="section-label">{copy.sources.auditable}</span><h2>{copy.sources.recent}</h2></div><span>{data.cycles.length} {copy.sources.cycles}</span></div>
              {data.cycles.length ? <div className="activity-list">{data.cycles.map((cycle) => (
                <article key={cycle.id}>
                  <span className={`activity-status ${cycle.status}`} />
                  <div>
                    <strong>{cycle.sourceName ?? stageLabel(cycle.kind)}</strong>
                    <span>{stageLabel(cycle.currentStage)} · {stageLabel(cycle.status)}</span>
                    {cycle.discoveryDiagnostics ? <div className="activity-diagnostics">
                      <span>{cycle.discoveryDiagnostics.generatedCandidates} {copy.sources.generated} · {cycle.discoveryDiagnostics.acceptedCandidates} {copy.sources.accepted} · {cycle.discoveryDiagnostics.rejectedCandidates} {copy.sources.rejected} · {cycle.discoveryDiagnostics.opportunitiesCreatedOrMatched} {copy.sources.opportunities}</span>
                      <span>{cycle.discoveryDiagnostics.searchCalls} {copy.sources.searches} · {cycle.discoveryDiagnostics.consultedUrls} {copy.sources.consulted}{cycle.discoveryDiagnostics.programmeSignals ? ` · ${cycle.discoveryDiagnostics.programmeSignals} ${copy.sources.programmeSignals}` : ""}</span>
                      {cycle.discoveryDiagnostics.zeroResultReason ? <p><strong>{copy.sources.zeroExplanation}</strong> {cycle.discoveryDiagnostics.zeroResultReason}</p> : null}
                      {Object.keys(cycle.discoveryDiagnostics.rejectionCounts).length ? <p><strong>{copy.sources.validation}</strong> {rejectionSummary(cycle.discoveryDiagnostics.rejectionCounts)}</p> : null}
                    </div> : null}
                  </div>
                  <small>{formatDate(cycle.createdAt)} · €{cycle.estimatedCost.toFixed(3)}</small>
                  {cycle.failureReason ? <p>{cycle.failureReason}</p> : null}
                  {cycle.status === "failed" && data.canOperate ? <RetryAutomationForm workspaceId={selectedWorkspace.id} workflowId={cycle.id} /> : null}
                </article>
              ))}</div> : <div className="sources-empty compact"><h3>{copy.sources.noActivity}</h3><p>{copy.sources.noActivityText}</p></div>}
            </section>

            {data.exceptions.length ? <section className="automation-exceptions"><div className="section-heading"><div><span className="section-label">{copy.sources.humanAttention}</span><h2>{copy.sources.exceptions}</h2></div><span>{data.summary.openExceptions} {copy.common.open.toLowerCase()}</span></div>{data.exceptions.map((item) => <article key={item.id}><span>{exceptionLabel(item.kind)}</span><strong>{item.summary}</strong><small>{formatDate(item.createdAt)} · {item.status}</small>{item.opportunityId ? <Link href={`/?lead=${item.opportunityId}&tab=review`}>{copy.sources.resolve}</Link> : null}{item.status === "open" && selectedWorkspace.role !== "viewer" ? <ExceptionReviewForm workspaceId={selectedWorkspace.id} exceptionId={item.id} /> : null}</article>)}</section> : null}
          </>
        )}
      </main>
    </div>
  );
}
