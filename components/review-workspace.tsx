"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { ReviewBasketControl } from "@/components/review-basket-control";
import { InterfacePreferenceControls, useInterfacePreferences } from "@/components/interface-preferences";
import { useDemoWorkflow } from "@/components/use-demo-workflow";
import { useReviewBasket } from "@/components/use-review-basket";
import type { DashboardData, OpportunityView } from "@/lib/domain";
import { localeTag, type UiCopy } from "@/lib/i18n";

function leadHref(opportunityId: string, demo: DashboardData["demoMode"]) {
  const params = new URLSearchParams({ lead: opportunityId, tab: "review" });
  if (demo) params.set("demo", demo);
  return `/?${params.toString()}`;
}

function currentState(opportunity: OpportunityView, saved: boolean, copy: UiCopy) {
  if (opportunity.qualificationException?.kind === "qualification_policy_mismatch" && opportunity.qualificationException.status === "open") return { label: copy.reviewed.needsRequalification, tone: "attention" };
  if (opportunity.lead?.pendingResearch) return { label: copy.reviewed.researchRunning, tone: "research" };
  if (["approved", "accepted", "delivered"].includes(opportunity.lead?.status ?? "")) return { label: copy.reviewed.working, tone: "active" };
  if (["rejected", "archived"].includes(opportunity.lead?.status ?? "")) return { label: copy.reviewed.passed, tone: "passed" };
  if (opportunity.lead?.origin === "manual_promotion") return { label: copy.reviewed.manuallyPromoted, tone: "manual" };
  if (saved) return { label: copy.reviewed.saved, tone: "saved" };
  return { label: copy.reviewed.awaiting, tone: "waiting" };
}

function ReviewProjectCard({ opportunity, saved, demoMode }: { opportunity: OpportunityView; saved: boolean; demoMode?: DashboardData["demoMode"] }) {
  const { copy, locale } = useInterfacePreferences();
  const dateFormatter = new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric" });
  const state = currentState(opportunity, saved, copy);
  const lastEvent = opportunity.reviewHistory?.[0];
  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="review-project-card">
      <div className="review-project-heading">
        <div><span>{opportunity.organization}</span><h3>{opportunity.title}</h3></div>
        <strong className={`review-project-status ${state.tone}`}>{state.label}</strong>
      </div>
      <p>{opportunity.summary}</p>
      <dl>
        <div><dt>{copy.reviewed.fit}</dt><dd>{opportunity.score === null ? copy.common.unassessed : `${opportunity.score}/100`}</dd></div>
        <div><dt>{copy.reviewed.route}</dt><dd>{opportunity.lead?.route ?? opportunity.route}</dd></div>
        <div><dt>{copy.reviewed.location}</dt><dd>{opportunity.location}</dd></div>
        <div><dt>{copy.reviewed.lead}</dt><dd>{opportunity.lead ? `v${opportunity.lead.version} · ${opportunity.lead.origin === "manual_promotion" ? copy.decision.manual : copy.decision.automatic}` : copy.reviewed.notCreated}</dd></div>
      </dl>
      {lastEvent ? <p className="review-last-event"><strong>{lastEvent.decision.replaceAll("_", " ")}</strong> · {dateFormatter.format(new Date(lastEvent.createdAt))}{lastEvent.reasonCode ? ` · ${lastEvent.reasonCode.replaceAll("_", " ")}` : ""}</p> : <p className="review-last-event">{copy.reviewed.noDecision}</p>}
      <Link href={leadHref(opportunity.id, demoMode)}>{copy.reviewed.openRecord}</Link>
    </motion.article>
  );
}

export function ReviewWorkspace({ data }: { data: DashboardData }) {
  const { copy } = useInterfacePreferences();
  const interactiveDemo = data.mode === "demo" && data.demoMode === "empty";
  const { state: demoState } = useDemoWorkflow();
  const opportunities = interactiveDemo ? demoState.opportunities : data.opportunities;
  const basketScope = data.mode === "demo" ? `demo:${data.demoMode ?? "sample"}` : "supabase";
  const basket = useReviewBasket(basketScope, opportunities.map((opportunity) => opportunity.id));
  const tracked = opportunities.filter((opportunity) =>
    basket.ids.includes(opportunity.id) || Boolean(opportunity.lead) || Boolean(opportunity.reviewHistory?.length),
  );
  const researching = tracked.filter((item) => item.lead?.pendingResearch);
  const requalification = tracked.filter((item) => item.qualificationException?.kind === "qualification_policy_mismatch" && item.qualificationException.status === "open");
  const working = tracked.filter((item) => !requalification.includes(item) && !item.lead?.pendingResearch && ["approved", "accepted", "delivered"].includes(item.lead?.status ?? ""));
  const passed = tracked.filter((item) => !requalification.includes(item) && ["rejected", "archived"].includes(item.lead?.status ?? ""));
  const manual = tracked.filter((item) => !requalification.includes(item) && !working.includes(item) && !researching.includes(item) && !passed.includes(item) && item.lead?.origin === "manual_promotion");
  const waiting = tracked.filter((item) => !requalification.includes(item) && !working.includes(item) && !researching.includes(item) && !passed.includes(item) && !manual.includes(item));

  const sourcesHref = data.mode === "demo" ? "/sources?demo=empty" : "/sources";
  const leadsHref = data.demoMode ? `/?demo=${data.demoMode}` : "/";
  const sections = [
    { id: "requalification", label: copy.reviewed.needsRequalification, description: copy.reviewed.requalificationText, items: requalification },
    { id: "working", label: copy.reviewed.working, description: copy.reviewed.workingText, items: working },
    { id: "manual", label: copy.reviewed.manuallyPromoted, description: copy.reviewed.manualText, items: manual },
    { id: "research", label: copy.reviewed.researchRunning, description: copy.reviewed.researchText, items: researching },
    { id: "waiting", label: copy.reviewed.savedDecision, description: copy.reviewed.savedText, items: waiting },
    { id: "passed", label: copy.reviewed.passed, description: copy.reviewed.passedText, items: passed },
  ];

  return (
    <div className="review-workspace-shell">
      <header className="site-header">
        <Link className="brand" href={leadsHref} aria-label={copy.nav.homeLabel}><span>YY</span><strong>early_signal</strong></Link>
        <nav aria-label={copy.nav.primaryLabel}><Link href={leadsHref}>{copy.nav.leads}</Link><Link href={sourcesHref}>{copy.nav.sourceNetwork}</Link><Link href={data.demoMode ? `/reviewed?demo=${data.demoMode}` : "/reviewed"} aria-current="page">{copy.nav.pursuitWorkspace}</Link><ReviewBasketControl opportunities={opportunities} scope={basketScope} demoMode={data.demoMode} /></nav>
        <InterfacePreferenceControls />
        <a className="account-link" href="/login">YK</a>
      </header>
      <main>
        <section className="review-workspace-heading">
          <div><span className="section-label">{copy.reviewed.eyebrow}</span><h1>{copy.reviewed.title}</h1><p>{copy.reviewed.intro}</p></div>
          <div className="review-workspace-total"><strong>{working.length}</strong><span>{working.length === 1 ? "project" : "projects"} {copy.reviewed.inPursuit}</span></div>
        </section>
        {data.mode === "demo" ? <p className="review-workspace-notice" role="status">{copy.reviewed.demoNotice}</p> : null}
        {tracked.length ? sections.map((section) => (
          <section className="review-workspace-section" key={section.id} aria-labelledby={`review-${section.id}`}>
            <div className="review-workspace-section-heading"><div><h2 id={`review-${section.id}`}>{section.label}</h2><p>{section.description}</p></div><span>{section.items.length}</span></div>
            {section.items.length ? <div className="review-project-grid">{section.items.map((opportunity) => <ReviewProjectCard key={opportunity.id} opportunity={opportunity} saved={basket.ids.includes(opportunity.id)} demoMode={data.demoMode} />)}</div> : <div className="review-workspace-empty">{copy.reviewed.noProjects}</div>}
          </section>
        )) : (
          <section className="review-workspace-empty-state"><span className="section-label">{copy.reviewed.nothing}</span><h2>{copy.reviewed.emptyTitle}</h2><p>{copy.reviewed.emptyText}</p><Link className="primary-link" href={leadsHref}>{copy.reviewed.browse}</Link></section>
        )}
      </main>
    </div>
  );
}
