"use client";

import {
  forwardRef,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { reviewLeadAction } from "@/app/actions/lead-review";
import { promoteOpportunityAction } from "@/app/actions/promote-opportunity";
import { resolveOpportunityAttentionAction } from "@/app/actions/resolve-opportunity-attention";
import { ReviewBasketControl } from "@/components/review-basket-control";
import { InterfacePreferenceControls, useInterfacePreferences } from "@/components/interface-preferences";
import { SideDrawer } from "@/components/side-drawer";
import { useDemoWorkflow } from "@/components/use-demo-workflow";
import { useReviewBasket } from "@/components/use-review-basket";
import type { DashboardData, LifecycleStatus, OpportunityView } from "@/lib/domain";
import { localeTag, type UiCopy } from "@/lib/i18n";
import {
  initialLeadReviewActionState,
  successfulReviewResultKey,
} from "@/lib/lead-review-action-state";
import {
  initialPursuitPromotionActionState,
  successfulPromotionResultKey,
} from "@/lib/pursuit-promotion-action-state";
import {
  initialOpportunityAttentionActionState,
  successfulAttentionResultKey,
  type OpportunityAttentionAction,
} from "@/lib/opportunity-attention-action-state";
import { buildLeadHref, resolveLeadId } from "@/lib/lead-navigation";

type FilterKey = "pursuit" | "monitoring" | "needs_review" | "all";
type LeadTab = "overview" | "evaluation" | "sources" | "outreach" | "review";

function filterLabels(copy: UiCopy): Record<FilterKey, string> {
  return { pursuit: copy.dashboard.pursuit, monitoring: copy.dashboard.monitoring, needs_review: copy.dashboard.needsAttention, all: copy.dashboard.allOpportunities };
}

function displayStatus(opportunity: OpportunityView, copy: UiCopy): string {
  return opportunity.lead?.origin === "manual_promotion"
    ? copy.status.manuallyPromoted
    : statusLabels(copy)[opportunity.lifecycleStatus];
}

function displayStatusClass(opportunity: OpportunityView): string {
  return opportunity.lead?.origin === "manual_promotion"
    ? "manual_promotion"
    : opportunity.lifecycleStatus;
}

function statusLabels(copy: UiCopy): Record<LifecycleStatus, string> {
  return { discovered: copy.status.discovered, assessing: copy.status.assessing, needs_research: copy.status.needsResearch, ready_for_final_assessment: copy.status.finalAssessment, monitoring: copy.status.monitoring, needs_review: copy.status.needsAttention, qualified: copy.status.qualified, rejected: copy.status.rejected, delivered: copy.status.delivered };
}

function tabLabels(copy: UiCopy): Record<LeadTab, string> {
  return { overview: copy.drawer.overview, evaluation: copy.drawer.evaluation, sources: copy.drawer.sources, outreach: copy.drawer.outreach, review: copy.drawer.decision };
}

function qualificationExceptionLabel(kind: string, copy: UiCopy): string {
  if (kind === "capability_fit_uncertain") return copy.resolution.technicalCapability;
  if (kind === "delivery_capacity_uncertain") return copy.resolution.deliveryCapacity;
  return kind.replaceAll("_", " ");
}

function Icon({
  name,
}: {
  name: "search" | "pin" | "person" | "source" | "basket" | "arrow" | "close";
}) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    person: <><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.7-4 2.9-6 6.5-6s5.8 2 6.5 6" /></>,
    source: <><path d="M6 4h10l2 2v14H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
    basket: <><path d="m5 9 2 11h10l2-11H5Z" /><path d="m9 9 3-5 3 5" /></>,
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function FitScore({ score }: { score: number | null }) {
  const { copy } = useInterfacePreferences();
  if (score === null) return <span className="fit-score unassessed"><strong>—</strong><small>{copy.common.unassessed}</small></span>;
  const tone = score >= 80 ? "strong" : score >= 70 ? "promising" : "explore";
  return <span className={`fit-score ${tone}`}><strong>{score}</strong><small>/100 {copy.card.fit}</small></span>;
}

interface ProjectCardProps {
  opportunity: OpportunityView;
  active: boolean;
  saved: boolean;
  onSelect: (trigger: HTMLButtonElement) => void;
  onToggleSaved: () => void;
}

const ProjectCard = forwardRef<HTMLElement, ProjectCardProps>(function ProjectCard({
  opportunity,
  active,
  saved,
  onSelect,
  onToggleSaved,
}, ref) {
  const { copy } = useInterfacePreferences();
  const outlinedSourceCount = opportunity.evidence.length || opportunity.signalCount;
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.article
      ref={ref}
      layout
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.985 }}
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
      className={`project-card ${active ? "active" : ""}`}
    >
      <button
        type="button"
        className="project-card-main"
        onClick={(event) => onSelect(event.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={active}
      >
        <span className="project-card-topline">
          <span>{opportunity.organization}</span>
          <span className={`status status-${displayStatusClass(opportunity)}`}>
            {displayStatus(opportunity, copy)}
          </span>
        </span>
        <strong className="project-title">{opportunity.title}</strong>
        <span className="project-description">{opportunity.summary}</span>
        <span className="project-facts">
          <span><small>{copy.card.why}</small><strong>{opportunity.technicalDifficultyInferred ? copy.card.estimated : ""}{opportunity.technicalDifficulty} {copy.card.build} · {opportunity.score === null ? copy.common.unassessed : `${opportunity.score}/100 ${copy.card.fit}`}</strong></span>
          <span><small>{copy.card.budget}</small><strong>{opportunity.budgetLabel}</strong></span>
          <span><small>{copy.card.where}</small><strong>{opportunity.location}</strong><em>{opportunity.workMode}</em></span>
          <span><small>{copy.card.who}</small><strong>{opportunity.contactLabel}</strong><em>{opportunity.contactStatus === "confirmed" ? copy.common.confirmed : opportunity.contactStatus === "inferred" ? copy.common.inferred : copy.common.researchPending}</em></span>
        </span>
        <span className="source-preview">
          <Icon name="source" />
          {outlinedSourceCount} {outlinedSourceCount === 1 ? copy.card.outlinedSource : copy.card.outlinedSources}
          <span>{opportunity.primarySignalType}</span>
        </span>
      </button>
      <button
        type="button"
        className={`save-project ${saved ? "saved" : ""}`}
        onClick={onToggleSaved}
        aria-label={`${saved ? copy.card.removeShortlist : copy.card.addShortlist}: ${opportunity.title}`}
        aria-pressed={saved}
      >
        <Icon name="basket" />
      </button>
    </motion.article>
  );
});

function LeadDrawer({
  opportunity,
  saved,
  initialTab = "overview",
  interactiveDemo,
  onToggleSaved,
  onDemoReview,
  onDemoResolve,
  onDemoPromote,
  onReviewed,
  onResolved,
  onPromoted,
  onClose,
}: {
  opportunity: OpportunityView;
  saved: boolean;
  initialTab?: LeadTab;
  interactiveDemo: boolean;
  onToggleSaved: () => void;
  onDemoReview: (review: { decision: "pursue" | "pass" | "request_research" | "route_changed"; reasonCode?: string; notes?: string; route?: OpportunityView["route"] }) => void;
  onDemoResolve: (resolution: { action: OpportunityAttentionAction; reasonCode: string; notes?: string }) => void;
  onDemoPromote: (promotion: { reasonCode: string; notes?: string; route: OpportunityView["route"]; language: "nl" | "en" }) => void;
  onReviewed: (leadId: string, action: string) => void;
  onResolved: (opportunityId: string, action: OpportunityAttentionAction) => void;
  onPromoted: () => void;
  onClose: () => void;
}) {
  const { copy, locale } = useInterfacePreferences();
  const [activeTab, setActiveTab] = useState<LeadTab>(initialTab);
  const labels = tabLabels(copy);
  const tabs = Object.keys(labels) as LeadTab[];
  const outlinedSourceCount = opportunity.evidence.length || opportunity.signalCount;
  const formatDate = (value: string) => new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const eur = new Intl.NumberFormat(localeTag(locale), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const capabilityEvidence = opportunity.qualificationChecks?.capabilityEvidence ?? null;
  const capacityEvidence = opportunity.qualificationChecks?.capacityEvidence ?? null;
  const capabilitySources = capabilityEvidence
    ? opportunity.evidence.filter((item) => capabilityEvidence.evidenceRefs.includes(item.id) || capabilityEvidence.evidenceRefs.includes(item.url))
    : [];

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, tab: LeadTab) => {
    const currentIndex = tabs.indexOf(tab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab);
    document.getElementById(`lead-tab-${nextTab}`)?.focus();
  };

  return (
    <SideDrawer className="lead-drawer" labelledBy="lead-drawer-title" onRequestClose={onClose}>
      <header className="drawer-header lead-drawer-header">
        <div>
          <span className="organization-name">{opportunity.organization}</span>
          <span className={`status status-${displayStatusClass(opportunity)}`}>{displayStatus(opportunity, copy)}</span>
          <h2 id="lead-drawer-title">{opportunity.title}</h2>
          <p>{opportunity.summary}</p>
        </div>
        <div className="drawer-header-actions">
          <FitScore score={opportunity.score} />
          <button type="button" className="drawer-close" onClick={onClose} aria-label={copy.drawer.close}>
            <Icon name="close" />
          </button>
        </div>
      </header>

      <div className="drawer-action-row">
        <button type="button" className={saved ? "saved" : ""} onClick={onToggleSaved}>
          <Icon name="basket" />
          {saved ? copy.drawer.saved : copy.drawer.add}
        </button>
        <span>{opportunity.lastAssessedAt ? `${copy.drawer.assessed} ${formatDate(opportunity.lastAssessedAt)}` : `${copy.drawer.discovered} ${formatDate(opportunity.firstSeenAt)} · ${copy.common.unassessed}`}</span>
      </div>

      <div className="drawer-tabs" role="tablist" aria-label={copy.drawer.tabsLabel}>
        {tabs.map((tab) => (
          <button
            key={tab}
            id={`lead-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`lead-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleTabKey(event, tab)}
          >
            {tab === "review"
              ? opportunity.lead
                ? copy.drawer.decision
                : opportunity.qualificationResearchPending && !opportunity.attentionException
                  ? copy.drawer.progress
                  : copy.drawer.resolve
              : labels[tab]}{tab === "sources" ? ` (${outlinedSourceCount})` : ""}
          </button>
        ))}
      </div>

      <div className="drawer-content">
        <section
          id="lead-panel-overview"
          role="tabpanel"
          aria-labelledby="lead-tab-overview"
          hidden={activeTab !== "overview"}
        >
          <div className="lead-essentials" aria-label={copy.drawer.essentials}>
            <div><small>{copy.drawer.whyWork}</small><strong>{opportunity.technicalDifficultyInferred ? copy.card.estimated : ""}{opportunity.technicalDifficulty} {copy.drawer.technicalDifficulty}</strong><span>{opportunity.score === null ? copy.drawer.fitNotAssessed : `${opportunity.score}/100 ${copy.card.fit}`} · {opportunity.confidence === null ? copy.drawer.confidenceNotAssessed : `${Math.round(opportunity.confidence * 100)}% ${copy.drawer.evidenceConfidence}`}</span></div>
            <div><small>{copy.card.budget}</small><strong>{opportunity.budgetLabel}</strong><span>{opportunity.route} {copy.drawer.deliveryRoute}</span></div>
            <div><small>{copy.card.where}</small><strong><Icon name="pin" />{opportunity.location}</strong><span>{opportunity.workMode}</span></div>
            <div><small>{copy.drawer.contact}</small><strong><Icon name="person" />{opportunity.contactLabel}</strong><span>{opportunity.contactStatus === "confirmed" ? copy.drawer.contactConfirmed : opportunity.contactStatus === "inferred" ? copy.drawer.contactInferred : copy.drawer.contactResearch}</span>{opportunity.contactEvidenceUrls?.[0] ? <a className="contact-evidence-link" href={opportunity.contactEvidenceUrls[0]} target="_blank" rel="noreferrer">{copy.drawer.supportingSource}</a> : null}</div>
          </div>

          <div className="drawer-section">
            <span className="section-label">{copy.drawer.whyNow}</span>
            <h3>{copy.drawer.engagementWindow}</h3>
            <p>{opportunity.whyNow}</p>
            <div className="next-step"><small>{copy.drawer.suggestedApproach}</small><p>{opportunity.suggestedNextAction}</p></div>
          </div>

          <div className="drawer-section open-questions">
            <span className="section-label">{copy.drawer.beforeCommit}</span>
            <h3>{copy.drawer.openQuestions}</h3>
            {opportunity.missingFields.length ? (
              <ul>{opportunity.missingFields.map((field) => <li key={field}>{field}</li>)}</ul>
            ) : <p>{copy.drawer.noGaps}</p>}
          </div>
        </section>

        <section
          id="lead-panel-evaluation"
          role="tabpanel"
          aria-labelledby="lead-tab-evaluation"
          hidden={activeTab !== "evaluation"}
        >
          <div className="evaluation-summary">
            <div><small>{copy.drawer.overallFit}</small><strong>{opportunity.score === null ? copy.common.unassessed : `${opportunity.score}/100`}</strong><span>{opportunity.score === null ? copy.drawer.noAssessment : copy.drawer.weightedAssessment}</span></div>
            <div><small>{copy.drawer.evidenceConfidenceLabel}</small><strong>{opportunity.confidence === null ? copy.common.unassessed : `${Math.round(opportunity.confidence * 100)}%`}</strong><span>{copy.drawer.confidenceNote}</span></div>
            <div><small>{copy.drawer.technicalDifficultyLabel}</small><strong>{opportunity.technicalDifficultyInferred ? `${copy.card.estimated}· ` : ""}{opportunity.technicalDifficulty}</strong><span>{opportunity.technicalDifficultyInferred ? copy.drawer.inferredScope : copy.drawer.estimatedScope}</span></div>
          </div>
          {opportunity.commercialFit ? (
            <div className="drawer-section commercial-fit-summary">
              <span className="section-label">{copy.drawer.commercialSnapshot}</span>
              <h3>{copy.drawer.evidenceUsed}</h3>
              <dl>
                <div><dt>{copy.drawer.evidenceStatus}</dt><dd>{opportunity.commercialFit.budgetEvidenceStatus.replaceAll("_", " ")}</dd></div>
                <div><dt>{copy.drawer.addressableScope}</dt><dd>{opportunity.commercialFit.addressableScopeValueEur === null ? copy.common.unknown : eur.format(opportunity.commercialFit.addressableScopeValueEur)}</dd></div>
                <div><dt>{copy.drawer.totalValue}</dt><dd>{opportunity.commercialFit.totalProjectValueEur === null ? copy.common.unknown : eur.format(opportunity.commercialFit.totalProjectValueEur)}</dd></div>
                <div><dt>{copy.drawer.scopeBoundary}</dt><dd>{opportunity.commercialFit.addressableScopeStatus}</dd></div>
                <div><dt>{copy.drawer.scopeBasis}</dt><dd>{opportunity.commercialFit.scopeBasis.replaceAll("_", " ")}</dd></div>
              </dl>
              <p>{opportunity.commercialFit.explanation}</p>
            </div>
          ) : null}
          {opportunity.qualificationChecks ? (
            <div className="drawer-section capability-capacity-summary">
              <div className="qualification-evidence-grid">
                <article>
                  <span className="section-label">{copy.drawer.technicalCapability}</span>
                  <h3>{copy.drawer.capabilityAssessment}</h3>
                  {capabilityEvidence ? (
                    <>
                      <p className={`qualification-evidence-status ${capabilityEvidence.status}`}>
                        <strong>{capabilityEvidence.status.replaceAll("_", " ")}</strong>
                        <span>{Math.round(capabilityEvidence.confidence * 100)}% {copy.drawer.evidenceConfidence}</span>
                      </p>
                      <div className="capability-lists">
                        <div>
                          <h4>{copy.drawer.matchedCapabilities}</h4>
                          {capabilityEvidence.matchedServices.length
                            ? <ul>{capabilityEvidence.matchedServices.map((service) => <li key={service}>{service}</li>)}</ul>
                            : <p>{copy.drawer.noMatchedCapabilities}</p>}
                        </div>
                        <div>
                          <h4>{copy.drawer.unresolvedRequirements}</h4>
                          {capabilityEvidence.unmatchedRequirements.length
                            ? <ul>{capabilityEvidence.unmatchedRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
                            : <p>{copy.drawer.noUnresolvedRequirements}</p>}
                        </div>
                      </div>
                      {capabilityEvidence.explanation ? <p>{capabilityEvidence.explanation}</p> : null}
                      {capabilitySources.length ? <div className="capability-evidence-links">{capabilitySources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.publisher || source.title} ↗</a>)}</div> : null}
                    </>
                  ) : <p>{copy.drawer.historicalCapability}</p>}
                </article>
                <article>
                  <span className="section-label">{copy.drawer.deliveryCapacity}</span>
                  <h3>{copy.drawer.capacityAssessment}</h3>
                  {capacityEvidence ? (
                    <dl>
                      <div><dt>{copy.drawer.evidenceStatus}</dt><dd>{capacityEvidence.status}</dd></div>
                      <div><dt>{copy.drawer.capacityValidThrough}</dt><dd>{capacityEvidence.effectiveUntil ? formatDate(capacityEvidence.effectiveUntil) : copy.drawer.noCapacityExpiry}</dd></div>
                      <div><dt>{copy.drawer.capacityState}</dt><dd>{capacityEvidence.expired ? copy.drawer.capacityExpired : copy.drawer.capacityCurrent}</dd></div>
                      <div><dt>{copy.drawer.evidenceConfidenceLabel}</dt><dd>{Math.round(capacityEvidence.confidence * 100)}%</dd></div>
                    </dl>
                  ) : <p>{copy.drawer.historicalCapacity}</p>}
                </article>
              </div>
            </div>
          ) : null}
          {opportunity.qualificationChecks ? (
            <div className="drawer-section qualification-checks-summary">
              <span className="section-label">{copy.drawer.deterministicGates}</span>
              <h3>{opportunity.qualificationChecks.allPassed ? copy.drawer.allGatesPassed : copy.drawer.blockingGate}</h3>
              <div>{Object.entries(opportunity.qualificationChecks.checks).map(([name, status]) => <span key={name} className={`qualification-check ${status}`}><strong>{name.replaceAll("_", " ")}</strong><small>{status}</small></span>)}</div>
              {opportunity.qualificationChecks.hardRejection ? <p>{opportunity.qualificationChecks.hardRejection}</p> : null}
            </div>
          ) : null}
          <div className="drawer-section">
            <span className="section-label">{copy.drawer.fitDifficulty}</span>
            <h3>{copy.drawer.dimensions}</h3>
            <div className="fit-breakdown">
              {opportunity.dimensions.map((dimension) => (
                <div key={dimension.name}>
                  <span><strong>{dimension.name}</strong><b>{dimension.score.toFixed(1)}</b></span>
                  <div aria-hidden="true"><i style={{ width: `${dimension.score * 10}%` }} /></div>
                  <small>{dimension.explanation}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="lead-panel-outreach"
          role="tabpanel"
          aria-labelledby="lead-tab-outreach"
          hidden={activeTab !== "outreach"}
        >
          <OutreachPanel opportunity={opportunity} />
        </section>

        <section
          id="lead-panel-sources"
          role="tabpanel"
          aria-labelledby="lead-tab-sources"
          hidden={activeTab !== "sources"}
        >
          <div className="drawer-section sources-section">
            <span className="section-label">{copy.drawer.sourceProvenance}</span>
            <h3>{copy.drawer.supportsLead}</h3>
            <p className="section-intro">{copy.drawer.provenanceIntro}</p>
            {opportunity.researchCoverage ? (
              <div className="research-coverage" aria-label={copy.drawer.deepResearch}>
                <div><strong>{opportunity.researchCoverage.consultedSourceCount}</strong><span>{copy.drawer.urlsConsulted}</span></div>
                <div><strong>{opportunity.researchCoverage.citedSourceCount}</strong><span>{copy.drawer.sourcesCited}</span></div>
                <div><strong>{opportunity.researchCoverage.passCount}</strong><span>{copy.drawer.focusedPasses}</span></div>
                <p>{copy.drawer.breadthNote}</p>
              </div>
            ) : null}
            <div className="outlined-sources">
              {opportunity.evidence.length ? opportunity.evidence.map((item, index) => (
                <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                  <span className="source-number">SRC_{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{item.title}</strong><small>{item.publisher} · {item.type === "Research finding" ? copy.drawer.researched : copy.drawer.published} {formatDate(item.publishedAt)}</small></span>
                  <span className={`evidence-status evidence-${item.status}`}>{item.status.replaceAll("_", " ")}</span>
                  {item.excerpt ? <em>{item.excerpt}</em> : null}
                </a>
              )) : <div className="no-source-detail">{opportunity.signalCount} {copy.drawer.sourceAwaiting}</div>}
            </div>
          </div>
        </section>

        <section
          id="lead-panel-review"
          role="tabpanel"
          aria-labelledby="lead-tab-review"
          hidden={activeTab !== "review"}
        >
          <LeadReviewPanel
            opportunity={opportunity}
            interactiveDemo={interactiveDemo}
            onDemoReview={onDemoReview}
            onDemoResolve={onDemoResolve}
            onDemoPromote={onDemoPromote}
            onReviewed={onReviewed}
            onResolved={onResolved}
            onPromoted={onPromoted}
          />
        </section>
      </div>
    </SideDrawer>
  );
}

function OutreachPanel({ opportunity }: { opportunity: OpportunityView }) {
  const { copy } = useInterfacePreferences();
  const [announcement, setAnnouncement] = useState("");
  const clipboardFallbackRef = useRef<HTMLTextAreaElement>(null);
  const draft = opportunity.lead?.outreachDraft ?? null;

  const copyText = async (label: string, value: string) => {
    try {
      try {
        if (typeof navigator.clipboard?.writeText !== "function") throw new Error("Clipboard API unavailable.");
        await navigator.clipboard.writeText(value);
      } catch {
        const textarea = clipboardFallbackRef.current;
        if (!textarea) throw new Error("Clipboard fallback unavailable.");
        textarea.value = value;
        textarea.focus({ preventScroll: true });
        textarea.select();
        if (!document.execCommand("copy")) throw new Error("Browser copy command was unavailable.");
      }
      setAnnouncement(`${label} ${copy.outreach.copied}`);
    } catch {
      setAnnouncement(copy.outreach.copyFailed);
    }
  };

  if (!draft) {
    return (
      <div className="drawer-section outreach-section">
        <span className="section-label">{copy.outreach.label}</span>
        <h3>{copy.outreach.unavailable}</h3>
        <p>{copy.outreach.unavailableText}</p>
      </div>
    );
  }

  const referencedEvidence = opportunity.evidence.filter((item) =>
    draft.evidenceRefs.includes(item.id) || draft.evidenceRefs.includes(item.url));
  return (
    <div className="drawer-section outreach-section">
      <span className="section-label">{copy.outreach.label}</span>
      {opportunity.lead?.origin === "manual_promotion" ? (
        <p className="manual-promotion-notice"><strong>{copy.outreach.manualTitle}</strong> {copy.outreach.manualText}</p>
      ) : null}
      <div className="outreach-heading"><div><h3>{copy.outreach.suggested}</h3><p>{draft.language.toUpperCase()} · {copy.outreach.channel}: {draft.recommendedChannel.replaceAll("_", " ")}</p></div><span>{copy.outreach.draftOnly}</span></div>
      <article className="outreach-draft-card">
        <div><small>{copy.outreach.emailSubject}</small><strong>{draft.emailSubject}</strong></div>
        <p>{draft.emailBody}</p>
        <button type="button" onClick={() => copyText("Email", `Subject: ${draft.emailSubject}\n\n${draft.emailBody}`)}>{copy.outreach.copyEmail}</button>
      </article>
      <article className="outreach-draft-card">
        <div><small>{copy.outreach.callOpening}</small></div>
        <p>{draft.callOpening}</p>
        <button type="button" onClick={() => copyText("Call", draft.callOpening)}>{copy.outreach.copyCall}</button>
      </article>
      {draft.discoveryQuestions.length ? <div className="outreach-questions"><h4>{copy.outreach.questions}</h4><ol>{draft.discoveryQuestions.map((question) => <li key={question}>{question}</li>)}</ol></div> : null}
      {draft.caveats.length ? <div className="outreach-caveats"><h4>{copy.outreach.caveats}</h4><ul>{draft.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></div> : null}
      <div className="outreach-evidence"><h4>{copy.outreach.evidence}</h4>{referencedEvidence.length ? referencedEvidence.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a>) : <p>{copy.outreach.missingEvidence}</p>}</div>
      <textarea ref={clipboardFallbackRef} className="clipboard-fallback" aria-hidden="true" tabIndex={-1} readOnly />
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}

function reviewReasons(copy: UiCopy) {
  return [
    ["poor_fit", copy.reasons.poorFit], ["budget", copy.reasons.budget], ["timing", copy.reasons.timing],
    ["no_access", copy.reasons.noAccess], ["scope", copy.reasons.scope], ["contact", copy.reasons.contact],
    ["delivery_route", copy.reasons.deliveryRoute], ["partner_fit", copy.reasons.partnerFit], ["capacity", copy.reasons.capacity],
    ["conflicting_evidence", copy.reasons.conflictingEvidence], ["stale", copy.reasons.stale], ["duplicate", copy.reasons.duplicate],
    ["smoke_test", copy.reasons.smokeTest], ["other", copy.reasons.other],
  ] as const;
}

function promotionReasons(copy: UiCopy) {
  return [
    ["seasonal_capacity", copy.reasons.seasonalCapacity], ["strategic_interest", copy.reasons.strategicInterest],
    ["existing_relationship", copy.reasons.existingRelationship], ["portfolio_fit", copy.reasons.portfolioFit],
    ["partner_opportunity", copy.reasons.partnerOpportunity], ["other", copy.reasons.other],
  ] as const;
}

function createClientIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const values = new Uint32Array(4);
    globalThis.crypto.getRandomValues(values);
    return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("-");
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function PursuitPromotionPanel({
  opportunity,
  interactiveDemo,
  onDemoPromote,
  onPromoted,
}: {
  opportunity: OpportunityView;
  interactiveDemo: boolean;
  onDemoPromote: (promotion: { reasonCode: string; notes?: string; route: OpportunityView["route"]; language: "nl" | "en" }) => void;
  onPromoted: () => void;
}) {
  const { copy } = useInterfacePreferences();
  const [state, formAction, pending] = useActionState(promoteOpportunityAction, initialPursuitPromotionActionState);
  const [demoMessage, setDemoMessage] = useState("");
  const [idempotencyKey] = useState(createClientIdempotencyKey);
  const handledResultRef = useRef<string | null>(null);
  const capability = interactiveDemo ? "decide" : opportunity.reviewCapability ?? "read_only";
  const completedStatus = ["monitoring", "needs_review", "rejected"].includes(opportunity.lifecycleStatus);
  const sectorRejected = opportunity.qualificationChecks?.checks.sector === "rejected";
  const actionabilityRejected = opportunity.qualificationChecks?.checks.actionability === "rejected";
  const hasNonOverridableChecks = Boolean(
    opportunity.qualificationChecks?.checks.sector
    && opportunity.qualificationChecks?.checks.actionability,
  );
  const hasFinalAssessment = interactiveDemo
    ? opportunity.latestAssessmentType === "final"
    : Boolean(opportunity.latestAssessmentId && opportunity.latestAssessmentType === "final");
  const eligible = capability === "decide"
    && completedStatus
    && hasFinalAssessment
    && hasNonOverridableChecks
    && opportunity.evidence.length > 0
    && !sectorRejected
    && !actionabilityRejected;

  useEffect(() => {
    const resultKey = successfulPromotionResultKey(state);
    if (!resultKey || handledResultRef.current === resultKey) return;
    handledResultRef.current = resultKey;
    onPromoted();
  }, [onPromoted, state]);

  const submitDemo = (event: FormEvent<HTMLFormElement>) => {
    if (!interactiveDemo) return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reasonCode = String(form.get("reasonCode") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const route = String(form.get("route") ?? "direct") as OpportunityView["route"];
    const language = String(form.get("language") ?? "nl") as "nl" | "en";
    if (!reasonCode) {
      setDemoMessage("Choose why this Opportunity should enter the pursuit pipeline.");
      return;
    }
    if (reasonCode === "other" && !notes) {
      setDemoMessage("Add a short note when using the Other reason.");
      return;
    }
    onDemoPromote({ reasonCode, notes: notes || undefined, route, language });
    setDemoMessage("Simulated manual Lead created in this browser session. A separate pursuit decision is still required.");
  };

  let blockedReason: string | null = null;
  if (capability !== "decide") blockedReason = "Only workspace owners and reviewers can make this commercial override.";
  else if (sectorRejected) blockedReason = "Hard-excluded sectors cannot be promoted.";
  else if (actionabilityRejected) blockedReason = "This Opportunity is expired without a supported active follow-on.";
  else if (!hasNonOverridableChecks) blockedReason = "Reassess this Opportunity first so sector and current actionability are explicitly evaluated.";
  else if (!hasFinalAssessment) blockedReason = "A completed final Assessment is required before manual promotion.";
  else if (!opportunity.evidence.length) blockedReason = "At least one citation-valid Signal is required.";
  else if (!completedStatus) blockedReason = "Wait for the active qualification workflow to finish.";

  return (
    <div className="drawer-section promotion-section">
      <span className="section-label">{copy.promotion.label}</span>
      <h3>{copy.promotion.title}</h3>
      <p>{copy.promotion.intro}</p>
      {opportunity.qualificationChecks && !opportunity.qualificationChecks.allPassed ? (
        <div className="promotion-gaps" aria-label={copy.promotion.gatesLabel}>
          {Object.entries(opportunity.qualificationChecks.checks)
            .filter(([, status]) => status !== "passed")
            .map(([name, status]) => <span key={name}><strong>{name.replaceAll("_", " ")}</strong><small>{status}</small></span>)}
        </div>
      ) : null}
      {blockedReason ? <p className="promotion-blocked" role="status">{blockedReason}</p> : null}
      <form action={interactiveDemo ? undefined : formAction} onSubmit={submitDemo} className="lead-review-form promotion-form">
        <input type="hidden" name="opportunityId" value={opportunity.id} />
        <input type="hidden" name="expectedAssessmentId" value={opportunity.latestAssessmentId ?? ""} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <label><span>{copy.promotion.reason}</span><select name="reasonCode" defaultValue="" required><option value="">{copy.promotion.chooseReason}</option>{promotionReasons(copy).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>{copy.promotion.route}</span><select name="route" defaultValue={opportunity.route === "unsuitable" ? "direct" : opportunity.route}><option value="direct">{copy.common.direct}</option><option value="partner">{copy.common.partner}</option><option value="nurture">{copy.common.nurture}</option><option value="monitor">{copy.common.monitor}</option></select></label>
        <label><span>{copy.promotion.language}</span><select name="language" defaultValue="nl"><option value="nl">{copy.common.dutch}</option><option value="en">{copy.common.english}</option></select></label>
        <label className="wide"><span>{copy.promotion.judgment}</span><textarea name="notes" maxLength={1000} rows={4} placeholder={copy.promotion.notePlaceholder} /></label>
        <div className="lead-review-actions"><button type="submit" disabled={pending || !eligible}>{pending ? copy.promotion.creating : copy.promotion.create}</button></div>
        <p className={`review-action-message ${(state.ok || demoMessage.includes("saved")) ? "success" : ""}`} role="status" aria-live="polite">
          {pending ? copy.promotion.progress : demoMessage || state.message}
        </p>
      </form>
    </div>
  );
}

function OpportunityResolutionPanel({
  opportunity,
  interactiveDemo,
  onDemoResolve,
  onResolved,
  children,
}: {
  opportunity: OpportunityView;
  interactiveDemo: boolean;
  onDemoResolve: (resolution: { action: OpportunityAttentionAction; reasonCode: string; notes?: string }) => void;
  onResolved: (opportunityId: string, action: OpportunityAttentionAction) => void;
  children: ReactNode;
}) {
  const { copy, locale } = useInterfacePreferences();
  const formatDate = (value: string) => new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const [state, formAction, pending] = useActionState(
    resolveOpportunityAttentionAction,
    initialOpportunityAttentionActionState,
  );
  const [demoMessage, setDemoMessage] = useState("");
  const [idempotencyKey] = useState(createClientIdempotencyKey);
  const idempotencyInputRef = useRef<HTMLInputElement>(null);
  const handledResultRef = useRef<string | null>(null);
  const exception = opportunity.attentionException;
  const automaticResearchActive = opportunity.qualificationResearchPending && !exception;
  const capability = interactiveDemo ? "decide" : opportunity.reviewCapability ?? "read_only";
  const canPass = capability === "decide";
  const canResearch = capability === "decide" || capability === "research_only";
  const unresolvedChecks = Object.entries(opportunity.qualificationChecks?.checks ?? {})
    .filter(([, status]) => status !== "passed");

  useEffect(() => {
    const resultKey = successfulAttentionResultKey(state);
    if (!resultKey || !state.action || handledResultRef.current === resultKey) return;
    handledResultRef.current = resultKey;
    if (idempotencyInputRef.current) idempotencyInputRef.current.value = createClientIdempotencyKey();
    onResolved(opportunity.id, state.action);
  }, [onResolved, opportunity.id, state]);

  const submitDemo = (event: FormEvent<HTMLFormElement>) => {
    if (!interactiveDemo) return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action = String(submitter?.getAttribute("value") ?? "") as OpportunityAttentionAction;
    const reasonCode = String(form.get("reasonCode") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    if (action !== "request_research" && action !== "pass") {
      setDemoMessage("Choose research or pass before submitting.");
      return;
    }
    if (!reasonCode) {
      setDemoMessage("Choose a reason before submitting this action.");
      return;
    }
    if (reasonCode === "other" && !notes) {
      setDemoMessage("Add a short note when using the Other reason.");
      return;
    }
    onDemoResolve({ action, reasonCode, notes: notes || undefined });
    setDemoMessage(action === "request_research"
      ? "Simulated research request queued in this browser session."
      : "Simulated pass saved in this browser session.");
    onResolved(opportunity.id, action);
  };

  return (
    <>
      <div className="drawer-section opportunity-resolution-section">
        <span className="section-label">{automaticResearchActive ? copy.resolution.automaticLabel : copy.resolution.label}</span>
        <h3>{automaticResearchActive ? copy.resolution.automaticTitle : copy.resolution.title}</h3>
        <p>{automaticResearchActive ? copy.resolution.automaticIntro : copy.resolution.intro}</p>

        {exception ? (
          <div className="attention-exception-summary">
            <span>{qualificationExceptionLabel(exception.kind, copy)}</span>
            <strong>{exception.summary}</strong>
            <small>{copy.resolution.opened} {formatDate(exception.createdAt)}</small>
          </div>
        ) : (
          <p className={opportunity.qualificationResearchPending ? "resolution-progress" : "promotion-blocked"} role="status">
            {opportunity.qualificationResearchPending
              ? copy.resolution.researchRunning
              : opportunity.lifecycleStatus === "rejected"
                ? copy.resolution.passed
                : copy.resolution.noException}
          </p>
        )}

        {unresolvedChecks.length ? (
          <div className="promotion-gaps" aria-label={copy.resolution.gatesLabel}>
            {unresolvedChecks.map(([name, status]) => (
              <span key={name}><strong>{name.replaceAll("_", " ")}</strong><small>{status}</small></span>
            ))}
          </div>
        ) : null}

        {interactiveDemo ? <p className="review-demo-label">{copy.decision.simulated}</p> : null}
        {capability === "read_only" && exception ? <p className="review-readonly">{copy.resolution.readOnly}</p> : null}

        {exception ? (
          <form action={interactiveDemo ? undefined : formAction} onSubmit={submitDemo} className="lead-review-form opportunity-resolution-form">
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <input type="hidden" name="exceptionId" value={exception.id} />
            <input ref={idempotencyInputRef} type="hidden" name="idempotencyKey" defaultValue={idempotencyKey} />
            <label><span>{copy.resolution.reason}</span><select name="reasonCode" defaultValue="" required><option value="">{copy.resolution.chooseReason}</option>{reviewReasons(copy).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="wide"><span>{copy.resolution.note}</span><textarea name="notes" rows={3} placeholder={copy.decision.notePlaceholder} /></label>
            <div className="lead-review-actions">
              <button type="submit" name="action" value="request_research" disabled={pending || !canResearch || opportunity.qualificationResearchPending}>{copy.resolution.research}</button>
              <button type="submit" name="action" value="pass" disabled={pending || !canPass}>{copy.resolution.pass}</button>
            </div>
            <p className={`review-action-message ${(state.ok || demoMessage.startsWith("Simulated")) ? "success" : ""}`} role="status" aria-live="polite">
              {pending
                ? copy.resolution.saving
                : opportunity.qualificationResearchPending
                  ? copy.resolution.alreadyRunning
                  : demoMessage || state.message}
            </p>
          </form>
        ) : null}
      </div>
      {!opportunity.qualificationResearchPending ? (
        <>
          <div className="resolution-alternative" aria-label={copy.promotion.title}>
            <span>{copy.resolution.alternative}</span>
          </div>
          {children}
        </>
      ) : null}
    </>
  );
}

function LeadReviewPanel({
  opportunity,
  interactiveDemo,
  onDemoReview,
  onDemoResolve,
  onDemoPromote,
  onReviewed,
  onResolved,
  onPromoted,
}: {
  opportunity: OpportunityView;
  interactiveDemo: boolean;
  onDemoReview: (review: { decision: "pursue" | "pass" | "request_research" | "route_changed"; reasonCode?: string; notes?: string; route?: OpportunityView["route"] }) => void;
  onDemoResolve: (resolution: { action: OpportunityAttentionAction; reasonCode: string; notes?: string }) => void;
  onDemoPromote: (promotion: { reasonCode: string; notes?: string; route: OpportunityView["route"]; language: "nl" | "en" }) => void;
  onReviewed: (leadId: string, action: string) => void;
  onResolved: (opportunityId: string, action: OpportunityAttentionAction) => void;
  onPromoted: () => void;
}) {
  const { copy, locale } = useInterfacePreferences();
  const formatDate = (value: string) => new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const [state, formAction, pending] = useActionState(reviewLeadAction, initialLeadReviewActionState);
  const [demoMessage, setDemoMessage] = useState("");
  const [idempotencyKey] = useState(createClientIdempotencyKey);
  const idempotencyInputRef = useRef<HTMLInputElement>(null);
  const handledResultRef = useRef<string | null>(null);

  useEffect(() => {
    const resultKey = successfulReviewResultKey(state);
    if (!resultKey || !state.action || handledResultRef.current === resultKey) return;
    handledResultRef.current = resultKey;
    if (idempotencyInputRef.current) idempotencyInputRef.current.value = createClientIdempotencyKey();
    onReviewed(opportunity.id, state.action);
  }, [onReviewed, opportunity.id, state]);

  if (!opportunity.lead) {
    return (
      <OpportunityResolutionPanel
        opportunity={opportunity}
        interactiveDemo={interactiveDemo}
        onDemoResolve={onDemoResolve}
        onResolved={onResolved}
      >
        <PursuitPromotionPanel opportunity={opportunity} interactiveDemo={interactiveDemo} onDemoPromote={onDemoPromote} onPromoted={onPromoted} />
      </OpportunityResolutionPanel>
    );
  }

  const capability = interactiveDemo ? "decide" : opportunity.reviewCapability ?? "read_only";
  const canDecide = capability === "decide";
  const canResearch = capability === "decide" || capability === "research_only";
  const submitDemo = (event: FormEvent<HTMLFormElement>) => {
    if (!interactiveDemo) return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const decision = String(submitter?.getAttribute("value") ?? form.get("action") ?? "") as "pursue" | "pass" | "request_research" | "route_changed";
    const reasonCode = String(form.get("reasonCode") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const route = String(form.get("route") ?? "") as OpportunityView["route"];
    if (!["pursue", "pass", "request_research", "route_changed"].includes(decision)) {
      setDemoMessage("Choose a pursuit decision and try again.");
      return;
    }
    if (["pass", "request_research", "route_changed"].includes(decision) && !reasonCode) {
      setDemoMessage("Choose a reason before submitting this action.");
      return;
    }
    if (reasonCode === "other" && !notes) {
      setDemoMessage("Add a short note when using the Other reason.");
      return;
    }
    onDemoReview({ decision, reasonCode: reasonCode || undefined, notes: notes || undefined, route });
    setDemoMessage("Simulated pursuit decision saved in this browser session.");
    onReviewed(opportunity.id, decision);
  };

  return (
    <div className="drawer-section lead-review-section">
      <span className="section-label">{copy.decision.label}</span>
      <h3>{copy.decision.title}</h3>
      <div className="review-state-summary">
        <div><small>{copy.decision.status}</small><strong>{opportunity.lead.status.replaceAll("_", " ")}</strong></div>
        <div><small>{copy.decision.version}</small><strong>Lead v{opportunity.lead.version}</strong></div>
        <div><small>{copy.decision.origin}</small><strong>{opportunity.lead.origin === "manual_promotion" ? copy.decision.manual : copy.decision.automatic}</strong></div>
        <div><small>{copy.decision.route}</small><strong>{opportunity.lead.route}</strong></div>
        <div><small>{copy.decision.research}</small><strong>{opportunity.lead.pendingResearch ? copy.decision.running : copy.decision.noCycle}</strong></div>
      </div>

      {opportunity.lead.origin === "manual_promotion" ? <p className="manual-promotion-notice"><strong>{copy.decision.humanOverride}</strong> Automatic qualification remains {opportunity.lifecycleStatus.replaceAll("_", " ")}; unresolved evidence is not treated as confirmed.</p> : null}

      {interactiveDemo ? <p className="review-demo-label">{copy.decision.simulated}</p> : null}
      {capability === "read_only" ? <p className="review-readonly">{copy.decision.readOnly}</p> : null}

      <form action={interactiveDemo ? undefined : formAction} onSubmit={submitDemo} className="lead-review-form">
        <input type="hidden" name="leadId" value={opportunity.lead.id} />
        <input type="hidden" name="expectedVersion" value={opportunity.lead.version} />
        <input ref={idempotencyInputRef} type="hidden" name="idempotencyKey" defaultValue={idempotencyKey} />
        <label><span>{copy.decision.reason}</span><select name="reasonCode" defaultValue=""><option value="">{copy.decision.reasonPlaceholder}</option>{reviewReasons(copy).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>{copy.decision.deliveryRoute}</span><select name="route" defaultValue={opportunity.lead.route}><option value="direct">{copy.common.direct}</option><option value="partner">{copy.common.partner}</option><option value="nurture">{copy.common.nurture}</option><option value="monitor">{copy.common.monitor}</option></select></label>
        <label className="wide"><span>{copy.decision.note}</span><textarea name="notes" rows={3} placeholder={copy.decision.notePlaceholder} /></label>
        <div className="lead-review-actions">
          <button type="submit" name="action" value="pursue" disabled={pending || !canDecide}>{copy.decision.pursue}</button>
          <button type="submit" name="action" value="pass" disabled={pending || !canDecide}>{copy.decision.pass}</button>
          <button type="submit" name="action" value="request_research" disabled={pending || !canResearch || opportunity.lead.pendingResearch}>{copy.decision.researchGap}</button>
          <button type="submit" name="action" value="route_changed" disabled={pending || !canDecide}>{copy.decision.saveRoute}</button>
        </div>
        <p className={`review-action-message ${(state.ok || demoMessage.startsWith("Simulated")) ? "success" : ""}`} role="status" aria-live="polite">
          {pending ? copy.decision.saving : demoMessage || state.message}
        </p>
      </form>

      <div className="review-history">
        <h3>{copy.decision.history}</h3>
        {opportunity.reviewHistory?.length ? (
          <ol>{opportunity.reviewHistory.map((event) => (
            <li key={event.id}>
              <strong>{event.decision.replaceAll("_", " ")}</strong>
              <span>{formatDate(event.createdAt)}{event.reasonCode ? ` · ${event.reasonCode.replaceAll("_", " ")}` : ""}</span>
              {event.notes ? <p>{event.notes}</p> : null}
            </li>
          ))}</ol>
        ) : <p>{copy.decision.noHistory}</p>}
      </div>
    </div>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const { copy } = useInterfacePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<FilterKey>("pursuit");
  const [query, setQuery] = useState("");
  const [basketOpen, setBasketOpen] = useState(false);
  const { state: demoState, hydrated: demoHydrated, dispatch: dispatchDemo } = useDemoWorkflow();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const previousPanelOpenRef = useRef(false);
  const resetHandledRef = useRef(false);
  const interactiveDemo = data.mode === "demo" && data.demoMode === "empty";
  const opportunities = interactiveDemo ? demoState.opportunities : data.opportunities;
  const {
    ids: basketIds,
    toggle: toggleBasketItem,
    remove: removeBasketItem,
  } = useReviewBasket(
    data.mode === "demo" ? `demo:${data.demoMode ?? "sample"}` : "supabase",
    opportunities.map((item) => item.id),
  );

  const leadIds = useMemo(() => opportunities.map((item) => item.id), [opportunities]);
  const requestedLeadId = searchParams.get("lead");
  const leadId = resolveLeadId(requestedLeadId, leadIds);
  const selectedLead = opportunities.find((item) => item.id === leadId);
  const currentSearch = searchParams.toString();

  useEffect(() => {
    if (requestedLeadId && !leadId && (!interactiveDemo || demoHydrated)) {
      router.replace(buildLeadHref(pathname, currentSearch, null), { scroll: false });
    }
  }, [currentSearch, demoHydrated, interactiveDemo, leadId, pathname, requestedLeadId, router]);

  useEffect(() => {
    if (searchParams.get("reset") !== "1") {
      resetHandledRef.current = false;
      return;
    }
    if (!interactiveDemo || !demoHydrated || resetHandledRef.current) return;
    resetHandledRef.current = true;
    dispatchDemo({ type: "reset" });
    const next = new URLSearchParams(currentSearch);
    next.delete("reset");
    next.delete("lead");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [currentSearch, demoHydrated, dispatchDemo, interactiveDemo, pathname, router, searchParams]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return opportunities.filter((opportunity) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "pursuit" && (opportunity.lifecycleStatus === "qualified" || opportunity.lead?.origin === "manual_promotion")) ||
        (filter === "needs_review" && opportunity.lead?.origin !== "manual_promotion" && opportunity.lifecycleStatus === "needs_review") ||
        (filter === "monitoring" && opportunity.lead?.origin !== "manual_promotion" && ["discovered", "assessing", "needs_research", "ready_for_final_assessment", "monitoring"].includes(opportunity.lifecycleStatus));
      const matchesQuery =
        !normalizedQuery ||
        [
          opportunity.title,
          opportunity.organization,
          opportunity.location,
          opportunity.contactLabel,
          opportunity.primarySignalType,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesFilter && matchesQuery;
    });
  }, [opportunities, filter, query]);

  const panelOpen = Boolean(selectedLead) || basketOpen;

  useEffect(() => {
    document.documentElement.classList.toggle("drawer-open", panelOpen);

    if (previousPanelOpenRef.current && !panelOpen) {
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    }

    previousPanelOpenRef.current = panelOpen;
    return () => document.documentElement.classList.remove("drawer-open");
  }, [panelOpen]);

  const toggleBasket = (id: string) => {
    toggleBasketItem(id);
  };

  const openLead = useCallback((id: string, trigger?: HTMLElement | null) => {
    if (trigger) returnFocusRef.current = trigger;
    setBasketOpen(false);
    router.push(buildLeadHref(pathname, currentSearch, id), { scroll: false });
  }, [currentSearch, pathname, router]);

  const closeLead = useCallback(() => {
    router.replace(buildLeadHref(pathname, currentSearch, null), { scroll: false });
  }, [currentSearch, pathname, router]);

  const completeReviewedLead = useCallback((id: string, action: string) => {
    if (action === "route_changed") return;
    removeBasketItem(id);
  }, [removeBasketItem]);

  const completeResolvedOpportunity = useCallback((id: string, action: OpportunityAttentionAction) => {
    if (action === "pass") removeBasketItem(id);
    if (!interactiveDemo) router.refresh();
  }, [interactiveDemo, removeBasketItem, router]);

  const boardCount = useMemo(() => {
    if (filter === "pursuit") {
      return {
        value: opportunities.filter((item) => item.lead && ["draft", "in_review"].includes(item.lead.status)).length,
        label: copy.dashboard.awaitingDecision,
      };
    }
    if (filter === "needs_review") {
      return {
        value: opportunities.filter((item) => item.lead?.origin !== "manual_promotion" && item.lifecycleStatus === "needs_review").length,
        label: copy.dashboard.needResolution,
      };
    }
    if (filter === "monitoring") {
      return {
        value: opportunities.filter((item) => item.lead?.origin !== "manual_promotion" && ["discovered", "assessing", "needs_research", "ready_for_final_assessment", "monitoring"].includes(item.lifecycleStatus)).length,
        label: copy.dashboard.beingMonitored,
      };
    }
    return { value: opportunities.length, label: copy.dashboard.totalOpportunities };
  }, [copy, filter, opportunities]);

  return (
    <div className="job-board-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label={copy.nav.homeLabel}>
          <span>YY</span><strong>early_signal</strong>
        </a>
        <nav aria-label={copy.nav.primaryLabel}>
          <a href="#projects" aria-current="page">{copy.nav.leads}</a>
          <Link href={data.mode === "demo" ? "/sources?demo=empty" : "/sources"}>{copy.nav.sourceNetwork}</Link>
          <Link href={interactiveDemo ? "/reviewed?demo=empty" : data.mode === "demo" ? "/reviewed?demo=sample" : "/reviewed"}>{copy.nav.pursuitWorkspace}</Link>
          <ReviewBasketControl
            opportunities={opportunities}
            scope={data.mode === "demo" ? `demo:${data.demoMode ?? "sample"}` : "supabase"}
            demoMode={data.demoMode}
            onBeforeOpen={(trigger) => {
              returnFocusRef.current = trigger;
              if (leadId) router.replace(buildLeadHref(pathname, currentSearch, null), { scroll: false });
            }}
            onOpenChange={setBasketOpen}
            onSelect={(id, trigger) => openLead(id, trigger)}
            managePageLock={false}
          />
        </nav>
        <InterfacePreferenceControls />
        <a className="account-link" href="/login" aria-label={copy.nav.account}>YK</a>
      </header>

      <main id="top">
        <section className="board-heading">
          <div>
            <span className="section-label">{copy.dashboard.eyebrow}</span>
            <h1>{copy.dashboard.title}</h1>
          </div>
          <div className="board-count"><strong>{boardCount.value}</strong><span>{boardCount.label}</span></div>
        </section>

        <div className="toolbar" id="projects">
          <label className="search-field">
            <Icon name="search" />
            <span className="sr-only">{copy.dashboard.searchLabel}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.dashboard.searchPlaceholder}
            />
          </label>
          <div className="filter-row" aria-label={copy.dashboard.filterLabel}>
            {(Object.keys(filterLabels(copy)) as FilterKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={filter === key ? "active" : ""}
                aria-pressed={filter === key}
              >
                {filterLabels(copy)[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="gallery-meta">
          <span>{filtered.length} {filtered.length === 1 ? copy.dashboard.opportunity : copy.sources.opportunities}</span>
          <span>{copy.dashboard.newestFirst}</span>
          {interactiveDemo ? (
            <span className="notice demo-notice" role="status"><i />{copy.dashboard.interactiveDemo}</span>
          ) : data.mode === "demo" ? <span className="notice" role="status"><i />{copy.dashboard.sampleDemo}</span> : data.notice ? <span className="notice" role="status"><i />{data.notice}</span> : null}
          {interactiveDemo && demoState.strategySaved ? (
            <button type="button" className="demo-reset" onClick={() => dispatchDemo({ type: "reset" })}>{copy.common.reset}</button>
          ) : null}
        </div>

        <section className="project-gallery" aria-label={copy.dashboard.availableOpportunities}>
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.length ? filtered.map((opportunity) => (
              <ProjectCard
                key={opportunity.id}
                opportunity={opportunity}
                active={!basketOpen && leadId === opportunity.id}
                saved={basketIds.includes(opportunity.id)}
                onSelect={(trigger) => openLead(opportunity.id, trigger)}
                onToggleSaved={() => toggleBasket(opportunity.id)}
              />
            )) : (
              <motion.div
                key="empty-results"
                layout
                className="empty-results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="empty-kicker">{interactiveDemo ? copy.dashboard.ready : copy.dashboard.noResults}</span>
                <strong>{opportunities.length === 0 ? copy.dashboard.noOpportunities : copy.dashboard.noLeads}</strong>
                <span>
                  {opportunities.length === 0
                    ? copy.dashboard.emptyActivity
                    : copy.dashboard.tryFilter}
                </span>
                {opportunities.length === 0 ? (
                  <div className="empty-actions">
                    <Link className="primary-link" href={interactiveDemo ? "/sources?demo=empty" : "/sources"}>{copy.dashboard.inspectActivity}</Link>
                    {interactiveDemo ? <Link href="/?demo=sample">{copy.dashboard.sampleProjects}</Link> : null}
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {!basketOpen && selectedLead ? (
        <LeadDrawer
          key={selectedLead.id}
          opportunity={selectedLead}
          saved={basketIds.includes(selectedLead.id)}
          initialTab={(Object.keys(tabLabels(copy)) as string[]).includes(searchParams.get("tab") ?? "")
            ? searchParams.get("tab") as LeadTab
            : "overview"}
          interactiveDemo={interactiveDemo}
          onToggleSaved={() => toggleBasket(selectedLead.id)}
          onDemoReview={(review) => dispatchDemo({
            type: "review_lead",
            opportunityId: selectedLead.id,
            decision: review.decision,
            reasonCode: review.reasonCode,
            notes: review.notes,
            route: review.route,
            reviewedAt: new Date().toISOString(),
          })}
          onDemoResolve={(resolution) => dispatchDemo({
            type: "resolve_attention",
            opportunityId: selectedLead.id,
            action: resolution.action,
            reasonCode: resolution.reasonCode,
            notes: resolution.notes,
            resolvedAt: new Date().toISOString(),
          })}
          onDemoPromote={(promotion) => dispatchDemo({
            type: "promote_opportunity",
            opportunityId: selectedLead.id,
            reasonCode: promotion.reasonCode,
            notes: promotion.notes,
            route: promotion.route,
            language: promotion.language,
            promotedAt: new Date().toISOString(),
          })}
          onReviewed={completeReviewedLead}
          onResolved={completeResolvedOpportunity}
          onPromoted={() => router.refresh()}
          onClose={closeLead}
        />
      ) : null}
    </div>
  );
}
