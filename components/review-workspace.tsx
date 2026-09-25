"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { useDemoWorkflow } from "@/components/use-demo-workflow";
import { useReviewBasket } from "@/components/use-review-basket";
import type { DashboardData, OpportunityView } from "@/lib/domain";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function leadHref(opportunityId: string, demo: DashboardData["demoMode"]) {
  const params = new URLSearchParams({ lead: opportunityId, tab: "review" });
  if (demo) params.set("demo", demo);
  return `/?${params.toString()}`;
}

function currentState(opportunity: OpportunityView, saved: boolean) {
  if (opportunity.lead?.pendingResearch) return { label: "Research running", tone: "research" };
  if (["approved", "accepted", "delivered"].includes(opportunity.lead?.status ?? "")) return { label: "Working on", tone: "active" };
  if (["rejected", "archived"].includes(opportunity.lead?.status ?? "")) return { label: "Passed", tone: "passed" };
  if (saved) return { label: "Saved for review", tone: "saved" };
  return { label: "Awaiting decision", tone: "waiting" };
}

function ReviewProjectCard({ opportunity, saved, demoMode }: { opportunity: OpportunityView; saved: boolean; demoMode?: DashboardData["demoMode"] }) {
  const state = currentState(opportunity, saved);
  const lastEvent = opportunity.reviewHistory?.[0];
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="review-project-card">
      <div className="review-project-heading">
        <div><span>{opportunity.organization}</span><h3>{opportunity.title}</h3></div>
        <strong className={`review-project-status ${state.tone}`}>{state.label}</strong>
      </div>
      <p>{opportunity.summary}</p>
      <dl>
        <div><dt>Fit</dt><dd>{opportunity.score === null ? "Unassessed" : `${opportunity.score}/100`}</dd></div>
        <div><dt>Route</dt><dd>{opportunity.lead?.route ?? opportunity.route}</dd></div>
        <div><dt>Location</dt><dd>{opportunity.location}</dd></div>
        <div><dt>Lead</dt><dd>{opportunity.lead ? `v${opportunity.lead.version}` : "Not created"}</dd></div>
      </dl>
      {lastEvent ? <p className="review-last-event"><strong>{lastEvent.decision.replaceAll("_", " ")}</strong> · {dateFormatter.format(new Date(lastEvent.createdAt))}{lastEvent.reasonCode ? ` · ${lastEvent.reasonCode.replaceAll("_", " ")}` : ""}</p> : <p className="review-last-event">No human decision recorded yet.</p>}
      <Link href={leadHref(opportunity.id, demoMode)}>Open review record →</Link>
    </motion.article>
  );
}

export function ReviewWorkspace({ data }: { data: DashboardData }) {
  const interactiveDemo = data.mode === "demo" && data.demoMode === "empty";
  const { state: demoState } = useDemoWorkflow();
  const opportunities = interactiveDemo ? demoState.opportunities : data.opportunities;
  const basket = useReviewBasket(data.mode === "demo" ? `demo:${data.demoMode ?? "sample"}` : "supabase");
  const tracked = opportunities.filter((opportunity) =>
    basket.ids.includes(opportunity.id) || Boolean(opportunity.lead) || Boolean(opportunity.reviewHistory?.length),
  );
  const researching = tracked.filter((item) => item.lead?.pendingResearch);
  const working = tracked.filter((item) => !item.lead?.pendingResearch && ["approved", "accepted", "delivered"].includes(item.lead?.status ?? ""));
  const passed = tracked.filter((item) => ["rejected", "archived"].includes(item.lead?.status ?? ""));
  const waiting = tracked.filter((item) => !working.includes(item) && !researching.includes(item) && !passed.includes(item));

  const sourcesHref = data.mode === "demo" ? "/sources?demo=empty" : "/sources";
  const leadsHref = data.demoMode ? `/?demo=${data.demoMode}` : "/";
  const sections = [
    { id: "working", label: "Working on", description: "Projects approved for YipYip pursuit.", items: working },
    { id: "research", label: "Research running", description: "Exception research is queued or in progress.", items: researching },
    { id: "waiting", label: "Saved and awaiting decision", description: "Shortlisted projects that still need a human pursuit decision.", items: waiting },
    { id: "passed", label: "Passed", description: "Projects retained in history but no longer being pursued.", items: passed },
  ];

  return (
    <div className="review-workspace-shell">
      <header className="site-header">
        <Link className="brand" href={leadsHref} aria-label="YipYip project board home"><span>YY</span><strong>early_signal</strong></Link>
        <nav aria-label="Primary navigation"><Link href={leadsHref}>Leads</Link><Link href={sourcesHref}>Source Network</Link><Link href={data.demoMode ? `/reviewed?demo=${data.demoMode}` : "/reviewed"} aria-current="page">Reviewed</Link></nav>
        <a className="account-link" href="/login">YK</a>
      </header>
      <main>
        <section className="review-workspace-heading">
          <div><span className="section-label">PURSUIT PIPELINE</span><h1>Reviewed projects</h1><p>One place to track what is saved, under research, actively pursued, or passed.</p></div>
          <div className="review-workspace-total"><strong>{working.length}</strong><span>project{working.length === 1 ? "" : "s"} in pursuit</span></div>
        </section>
        {data.mode === "demo" ? <p className="review-workspace-notice" role="status">Demo decisions and saved projects stay in this browser session only.</p> : null}
        {tracked.length ? sections.map((section) => (
          <section className="review-workspace-section" key={section.id} aria-labelledby={`review-${section.id}`}>
            <div className="review-workspace-section-heading"><div><h2 id={`review-${section.id}`}>{section.label}</h2><p>{section.description}</p></div><span>{section.items.length}</span></div>
            {section.items.length ? <div className="review-project-grid">{section.items.map((opportunity) => <ReviewProjectCard key={opportunity.id} opportunity={opportunity} saved={basket.ids.includes(opportunity.id)} demoMode={data.demoMode} />)}</div> : <div className="review-workspace-empty">No projects in this stage.</div>}
          </section>
        )) : (
          <section className="review-workspace-empty-state"><span className="section-label">NOTHING TRACKED YET</span><h2>Save a qualified lead to begin.</h2><p>Add promising leads to the review basket. They will appear here and remain available while you move them into pursuit or pass.</p><Link className="primary-link" href={leadsHref}>Browse leads →</Link></section>
        )}
      </main>
    </div>
  );
}
