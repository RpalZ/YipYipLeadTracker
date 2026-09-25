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
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

import { reviewLeadAction } from "@/app/actions/lead-review";
import { useDemoWorkflow } from "@/components/use-demo-workflow";
import { useReviewBasket } from "@/components/use-review-basket";
import type { DashboardData, LifecycleStatus, OpportunityView } from "@/lib/domain";
import {
  initialLeadReviewActionState,
  successfulReviewResultKey,
} from "@/lib/lead-review-action-state";
import { buildLeadHref, resolveLeadId } from "@/lib/lead-navigation";

type FilterKey = "qualified" | "monitoring" | "needs_review" | "all";
type LeadTab = "overview" | "evaluation" | "sources" | "review";

const filterLabels: Record<FilterKey, string> = {
  qualified: "Qualified leads",
  monitoring: "Monitoring",
  needs_review: "Needs attention",
  all: "All activity",
};

const statusLabels: Record<LifecycleStatus, string> = {
  discovered: "Discovered",
  assessing: "Assessing",
  needs_research: "Needs research",
  ready_for_final_assessment: "Final assessment",
  needs_review: "Needs review",
  qualified: "Qualified",
  rejected: "Rejected",
  delivered: "Delivered",
};

const tabLabels: Record<LeadTab, string> = {
  overview: "Overview",
  evaluation: "Evaluation",
  sources: "Sources",
  review: "Review",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const eur = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const formatDate = (value: string) => dateFormatter.format(new Date(value));

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
  if (score === null) return <span className="fit-score unassessed"><strong>—</strong><small>Unassessed</small></span>;
  const tone = score >= 80 ? "strong" : score >= 70 ? "promising" : "explore";
  return <span className={`fit-score ${tone}`}><strong>{score}</strong><small>/100 fit</small></span>;
}

function SideDrawer({
  className,
  labelledBy,
  onRequestClose,
  children,
}: {
  className: string;
  labelledBy: string;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onRequestClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`side-drawer ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onRequestClose();
        }
      }}
      onClick={handleBackdropClick}
    >
      <motion.div
        className="drawer-surface"
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </dialog>
  );
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
  const outlinedSourceCount = opportunity.evidence.length || opportunity.signalCount;

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985 }}
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
          <span className={`status status-${opportunity.lifecycleStatus}`}>
            {statusLabels[opportunity.lifecycleStatus]}
          </span>
        </span>
        <strong className="project-title">{opportunity.title}</strong>
        <span className="project-description">{opportunity.summary}</span>
        <span className="project-facts">
          <span><small>WHY</small><strong>{opportunity.technicalDifficultyInferred ? "Estimated " : ""}{opportunity.technicalDifficulty} build · {opportunity.score === null ? "Unassessed" : `${opportunity.score}/100 fit`}</strong></span>
          <span><small>BUDGET</small><strong>{opportunity.budgetLabel}</strong></span>
          <span><small>WHERE</small><strong>{opportunity.location}</strong><em>{opportunity.workMode}</em></span>
          <span><small>WHO</small><strong>{opportunity.contactLabel}</strong><em>{opportunity.contactStatus === "confirmed" ? "Confirmed" : opportunity.contactStatus === "inferred" ? "Inferred from sources" : "Research pending"}</em></span>
        </span>
        <span className="source-preview">
          <Icon name="source" />
          {outlinedSourceCount} outlined source{outlinedSourceCount === 1 ? "" : "s"}
          <span>{opportunity.primarySignalType}</span>
        </span>
      </button>
      <button
        type="button"
        className={`save-project ${saved ? "saved" : ""}`}
        onClick={onToggleSaved}
        aria-label={`${saved ? "Remove" : "Add"} ${opportunity.title} ${saved ? "from" : "to"} basket`}
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
  onReviewed,
  onClose,
}: {
  opportunity: OpportunityView;
  saved: boolean;
  initialTab?: LeadTab;
  interactiveDemo: boolean;
  onToggleSaved: () => void;
  onDemoReview: (review: { decision: "pursue" | "pass" | "request_research" | "route_changed"; reasonCode?: string; notes?: string; route?: OpportunityView["route"] }) => void;
  onReviewed: (leadId: string, action: string) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<LeadTab>(initialTab);
  const tabs = Object.keys(tabLabels) as LeadTab[];
  const outlinedSourceCount = opportunity.evidence.length || opportunity.signalCount;

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
          <span className={`status status-${opportunity.lifecycleStatus}`}>{statusLabels[opportunity.lifecycleStatus]}</span>
          <h2 id="lead-drawer-title">{opportunity.title}</h2>
          <p>{opportunity.summary}</p>
        </div>
        <div className="drawer-header-actions">
          <FitScore score={opportunity.score} />
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close lead details">
            <Icon name="close" />
          </button>
        </div>
      </header>

      <div className="drawer-action-row">
        <button type="button" className={saved ? "saved" : ""} onClick={onToggleSaved}>
          <Icon name="basket" />
          {saved ? "Saved to basket" : "Add to review basket"}
        </button>
        <span>{opportunity.lastAssessedAt ? `Assessed ${formatDate(opportunity.lastAssessedAt)}` : `Discovered ${formatDate(opportunity.firstSeenAt)} · Unassessed`}</span>
      </div>

      <div className="drawer-tabs" role="tablist" aria-label="Lead detail sections">
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
            {tabLabels[tab]}{tab === "sources" ? ` (${outlinedSourceCount})` : ""}
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
          <div className="lead-essentials" aria-label="Project essentials">
            <div><small>WHY THIS WORK</small><strong>{opportunity.technicalDifficultyInferred ? "Estimated " : ""}{opportunity.technicalDifficulty} technical difficulty</strong><span>{opportunity.score === null ? "Fit not assessed" : `${opportunity.score}/100 fit`} · {opportunity.confidence === null ? "confidence not assessed" : `${Math.round(opportunity.confidence * 100)}% evidence confidence`}</span></div>
            <div><small>BUDGET</small><strong>{opportunity.budgetLabel}</strong><span>{opportunity.route} delivery route</span></div>
            <div><small>WHERE</small><strong><Icon name="pin" />{opportunity.location}</strong><span>{opportunity.workMode}</span></div>
            <div><small>WHO TO CONTACT</small><strong><Icon name="person" />{opportunity.contactLabel}</strong><span>{opportunity.contactStatus === "confirmed" ? "Evidence-backed contact route" : opportunity.contactStatus === "inferred" ? "Evidence-backed route, strongly inferred" : "Needs contact research"}</span>{opportunity.contactEvidenceUrls?.[0] ? <a className="contact-evidence-link" href={opportunity.contactEvidenceUrls[0]} target="_blank" rel="noreferrer">Open supporting source ↗</a> : null}</div>
          </div>

          <div className="drawer-section">
            <span className="section-label">WHY NOW</span>
            <h3>The engagement window</h3>
            <p>{opportunity.whyNow}</p>
            <div className="next-step"><small>SUGGESTED APPROACH</small><p>{opportunity.suggestedNextAction}</p></div>
          </div>

          <div className="drawer-section open-questions">
            <span className="section-label">BEFORE WE COMMIT</span>
            <h3>Open questions</h3>
            {opportunity.missingFields.length ? (
              <ul>{opportunity.missingFields.map((field) => <li key={field}>{field}</li>)}</ul>
            ) : <p>No material qualification gaps are recorded.</p>}
          </div>
        </section>

        <section
          id="lead-panel-evaluation"
          role="tabpanel"
          aria-labelledby="lead-tab-evaluation"
          hidden={activeTab !== "evaluation"}
        >
          <div className="evaluation-summary">
            <div><small>OVERALL FIT</small><strong>{opportunity.score === null ? "Unassessed" : `${opportunity.score}/100`}</strong><span>{opportunity.score === null ? "No Assessment exists yet" : "Explainable weighted assessment"}</span></div>
            <div><small>EVIDENCE CONFIDENCE</small><strong>{opportunity.confidence === null ? "Unassessed" : `${Math.round(opportunity.confidence * 100)}%`}</strong><span>Agent confidence does not qualify a lead</span></div>
            <div><small>TECHNICAL DIFFICULTY</small><strong>{opportunity.technicalDifficultyInferred ? "Estimated · " : ""}{opportunity.technicalDifficulty}</strong><span>{opportunity.technicalDifficultyInferred ? "Inferred from the known scope" : "Estimated from the known scope"}</span></div>
          </div>
          {opportunity.commercialFit ? (
            <div className="drawer-section commercial-fit-summary">
              <span className="section-label">COMMERCIAL FIT SNAPSHOT</span>
              <h3>The evidence used for this Assessment</h3>
              <dl>
                <div><dt>Evidence status</dt><dd>{opportunity.commercialFit.budgetEvidenceStatus.replaceAll("_", " ")}</dd></div>
                <div><dt>Addressable scope</dt><dd>{opportunity.commercialFit.addressableScopeValueEur === null ? "Unknown" : eur.format(opportunity.commercialFit.addressableScopeValueEur)}</dd></div>
                <div><dt>Total project value</dt><dd>{opportunity.commercialFit.totalProjectValueEur === null ? "Unknown" : eur.format(opportunity.commercialFit.totalProjectValueEur)}</dd></div>
                <div><dt>Scope boundary</dt><dd>{opportunity.commercialFit.addressableScopeStatus}</dd></div>
              </dl>
              <p>{opportunity.commercialFit.explanation}</p>
            </div>
          ) : null}
          <div className="drawer-section">
            <span className="section-label">FIT + DIFFICULTY</span>
            <h3>Qualification dimensions</h3>
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
          id="lead-panel-sources"
          role="tabpanel"
          aria-labelledby="lead-tab-sources"
          hidden={activeTab !== "sources"}
        >
          <div className="drawer-section sources-section">
            <span className="section-label">SOURCES + PROVENANCE</span>
            <h3>What supports this lead</h3>
            <p className="section-intro">Every external claim should resolve to an outlined source. Inferences remain visibly labeled.</p>
            <div className="outlined-sources">
              {opportunity.evidence.length ? opportunity.evidence.map((item, index) => (
                <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                  <span className="source-number">SRC_{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{item.title}</strong><small>{item.publisher} · {formatDate(item.publishedAt)}</small></span>
                  <span className={`evidence-status evidence-${item.status}`}>{item.status.replaceAll("_", " ")}</span>
                  {item.excerpt ? <em>{item.excerpt}</em> : null}
                </a>
              )) : <div className="no-source-detail">{opportunity.signalCount} source records are stored in Supabase. Their captured excerpts are awaiting display.</div>}
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
            onReviewed={onReviewed}
          />
        </section>
      </div>
    </SideDrawer>
  );
}

const reviewReasons = [
  ["poor_fit", "Poor overall fit"],
  ["budget", "Budget or commercial fit"],
  ["timing", "Timing"],
  ["no_access", "No credible access route"],
  ["scope", "Scope needs clarification"],
  ["contact", "Contact needs research"],
  ["delivery_route", "Delivery route"],
  ["partner_fit", "Partner fit"],
  ["capacity", "Delivery capacity"],
  ["conflicting_evidence", "Conflicting evidence"],
  ["stale", "Stale opportunity"],
  ["duplicate", "Duplicate"],
  ["smoke_test", "Local smoke test"],
  ["other", "Other"],
] as const;

function LeadReviewPanel({
  opportunity,
  interactiveDemo,
  onDemoReview,
  onReviewed,
}: {
  opportunity: OpportunityView;
  interactiveDemo: boolean;
  onDemoReview: (review: { decision: "pursue" | "pass" | "request_research" | "route_changed"; reasonCode?: string; notes?: string; route?: OpportunityView["route"] }) => void;
  onReviewed: (leadId: string, action: string) => void;
}) {
  const [state, formAction, pending] = useActionState(reviewLeadAction, initialLeadReviewActionState);
  const [demoMessage, setDemoMessage] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const idempotencyInputRef = useRef<HTMLInputElement>(null);
  const handledResultRef = useRef<string | null>(null);

  useEffect(() => {
    const resultKey = successfulReviewResultKey(state);
    if (!resultKey || !state.action || handledResultRef.current === resultKey) return;
    handledResultRef.current = resultKey;
    if (idempotencyInputRef.current) idempotencyInputRef.current.value = crypto.randomUUID();
    onReviewed(opportunity.id, state.action);
  }, [onReviewed, opportunity.id, state]);

  if (!opportunity.lead) {
    return (
      <div className="drawer-section review-empty">
        <span className="section-label">HUMAN DECISION</span>
        <h3>No review-ready Lead yet</h3>
        <p>This Opportunity must finish qualification or be resolved from Needs attention before a Lead decision is available.</p>
      </div>
    );
  }

  const capability = interactiveDemo ? "decide" : opportunity.reviewCapability ?? "read_only";
  const canDecide = capability === "decide";
  const canResearch = capability === "decide" || capability === "research_only";
  const submitDemo = (event: FormEvent<HTMLFormElement>) => {
    if (!interactiveDemo) return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const decision = String(form.get("action")) as "pursue" | "pass" | "request_research" | "route_changed";
    const reasonCode = String(form.get("reasonCode") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const route = String(form.get("route") ?? "") as OpportunityView["route"];
    if (["pass", "request_research", "route_changed"].includes(decision) && !reasonCode) {
      setDemoMessage("Choose a reason before submitting this action.");
      return;
    }
    if (reasonCode === "other" && !notes) {
      setDemoMessage("Add a short note when using the Other reason.");
      return;
    }
    onDemoReview({ decision, reasonCode: reasonCode || undefined, notes: notes || undefined, route });
    setDemoMessage("Simulated review saved in this browser session.");
    onReviewed(opportunity.id, decision);
  };

  return (
    <div className="drawer-section lead-review-section">
      <span className="section-label">HUMAN DECISION</span>
      <div className="review-state-summary">
        <div><small>STATUS</small><strong>{opportunity.lead.status.replaceAll("_", " ")}</strong></div>
        <div><small>VERSION</small><strong>Lead v{opportunity.lead.version}</strong></div>
        <div><small>ROUTE</small><strong>{opportunity.lead.route}</strong></div>
        <div><small>RESEARCH</small><strong>{opportunity.lead.pendingResearch ? "Queued or running" : "No requested cycle"}</strong></div>
      </div>

      {interactiveDemo ? <p className="review-demo-label">Simulated · stored only in this browser tab</p> : null}
      {capability === "read_only" ? <p className="review-readonly">Your workspace role can inspect review history but cannot change this Lead.</p> : null}

      <form action={interactiveDemo ? undefined : formAction} onSubmit={submitDemo} className="lead-review-form">
        <input type="hidden" name="leadId" value={opportunity.lead.id} />
        <input type="hidden" name="expectedVersion" value={opportunity.lead.version} />
        <input ref={idempotencyInputRef} type="hidden" name="idempotencyKey" defaultValue={idempotencyKey} />
        <label><span>Reason</span><select name="reasonCode" defaultValue=""><option value="">Choose when required</option>{reviewReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Delivery route</span><select name="route" defaultValue={opportunity.lead.route}><option value="direct">Direct</option><option value="partner">Partner</option><option value="nurture">Nurture</option><option value="monitor">Monitor</option></select></label>
        <label className="wide"><span>Review note</span><textarea name="notes" rows={3} placeholder="Optional, except when the reason is Other" /></label>
        <div className="lead-review-actions">
          <button type="submit" name="action" value="pursue" disabled={pending || !canDecide}>Pursue</button>
          <button type="submit" name="action" value="pass" disabled={pending || !canDecide}>Pass</button>
          <button type="submit" name="action" value="request_research" disabled={pending || !canResearch || opportunity.lead.pendingResearch}>Request research</button>
          <button type="submit" name="action" value="route_changed" disabled={pending || !canDecide}>Save route</button>
        </div>
        <p className={`review-action-message ${(state.ok || demoMessage) ? "success" : ""}`} role="status" aria-live="polite">
          {pending ? "Saving the attributable review decision…" : demoMessage || state.message}
        </p>
      </form>

      <div className="review-history">
        <h3>Decision history</h3>
        {opportunity.reviewHistory?.length ? (
          <ol>{opportunity.reviewHistory.map((event) => (
            <li key={event.id}>
              <strong>{event.decision.replaceAll("_", " ")}</strong>
              <span>{formatDate(event.createdAt)}{event.reasonCode ? ` · ${event.reasonCode.replaceAll("_", " ")}` : ""}</span>
              {event.notes ? <p>{event.notes}</p> : null}
            </li>
          ))}</ol>
        ) : <p>No human review decisions have been recorded for this Opportunity.</p>}
      </div>
    </div>
  );
}

function BasketDrawer({
  items,
  onSelect,
  onRemove,
  onClear,
  onReview,
  onClose,
}: {
  items: OpportunityView[];
  onSelect: (id: string, trigger: HTMLButtonElement) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onReview: () => void;
  onClose: () => void;
}) {
  return (
    <SideDrawer className="basket-drawer" labelledBy="basket-drawer-title" onRequestClose={onClose}>
      <header className="drawer-header basket-drawer-header">
        <div>
          <span className="section-label">SHORTLIST</span>
          <h2 id="basket-drawer-title">Review basket</h2>
          <p>Save leads that deserve a proper team review.</p>
        </div>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close review basket">
          <Icon name="close" />
        </button>
      </header>

      <div className="basket-drawer-count"><strong>{items.length}</strong><span>saved lead{items.length === 1 ? "" : "s"}</span></div>

      <div className="basket-drawer-content">
        {items.length ? (
          <>
            <div className="basket-list">
              {items.map((item) => (
                <div className="basket-item" key={item.id}>
                  <button type="button" onClick={(event) => onSelect(item.id, event.currentTarget)}>
                    <span>{item.organization}</span>
                    <strong>{item.title}</strong>
                    <small>{item.score === null ? "Unassessed" : `${item.score}/100 fit`} · {item.location}</small>
                  </button>
                  <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title} from basket`}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="review-basket-button" onClick={onReview}>
              Review saved leads
              <Icon name="arrow" />
            </button>
            <button type="button" className="clear-basket" onClick={onClear}>Clear basket</button>
          </>
        ) : (
          <div className="basket-empty">
            <Icon name="basket" />
            <strong>Your basket is empty</strong>
            <span>Add a lead when its fit, timing, and evidence look worth discussing.</span>
          </div>
        )}
      </div>
    </SideDrawer>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<FilterKey>("qualified");
  const [query, setQuery] = useState("");
  const [basketOpen, setBasketOpen] = useState(false);
  const { state: demoState, hydrated: demoHydrated, dispatch: dispatchDemo } = useDemoWorkflow();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const previousPanelOpenRef = useRef(false);
  const resetHandledRef = useRef(false);
  const interactiveDemo = data.mode === "demo" && data.demoMode === "empty";
  const opportunities = interactiveDemo ? demoState.opportunities : data.opportunities;
  const basket = useReviewBasket(data.mode === "demo" ? `demo:${data.demoMode ?? "sample"}` : "supabase");
  const basketIds = basket.ids;

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
        (filter === "qualified" && opportunity.lifecycleStatus === "qualified") ||
        (filter === "needs_review" && opportunity.lifecycleStatus === "needs_review") ||
        (filter === "monitoring" && ["discovered", "assessing", "needs_research", "ready_for_final_assessment"].includes(opportunity.lifecycleStatus));
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

  const basketItems = basketIds
    .map((id) => opportunities.find((opportunity) => opportunity.id === id))
    .filter((item): item is OpportunityView => Boolean(item));

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
    basket.toggle(id);
  };

  const openLead = useCallback((id: string, trigger?: HTMLElement | null) => {
    if (trigger) returnFocusRef.current = trigger;
    setBasketOpen(false);
    router.push(buildLeadHref(pathname, currentSearch, id), { scroll: false });
  }, [currentSearch, pathname, router]);

  const closeLead = useCallback(() => {
    router.replace(buildLeadHref(pathname, currentSearch, null), { scroll: false });
  }, [currentSearch, pathname, router]);

  const openBasket = (trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger;
    if (leadId) router.replace(buildLeadHref(pathname, currentSearch, null), { scroll: false });
    setBasketOpen(true);
  };

  const openReviewWorkspace = () => {
    setBasketOpen(false);
    router.push(interactiveDemo ? "/reviewed?demo=empty" : data.mode === "demo" ? "/reviewed?demo=sample" : "/reviewed");
  };

  const completeReviewedLead = useCallback((id: string, action: string) => {
    if (action === "route_changed") return;
    basket.remove(id);
  }, [basket]);

  return (
    <div className="job-board-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="YipYip project board home">
          <span>YY</span><strong>early_signal</strong>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#projects" aria-current="page">Leads</a>
          <Link href={interactiveDemo ? "/sources?demo=empty" : "/sources"}>Source Network</Link>
          <Link href={interactiveDemo ? "/reviewed?demo=empty" : data.mode === "demo" ? "/reviewed?demo=sample" : "/reviewed"}>Reviewed</Link>
          <button type="button" className="header-basket" onClick={(event) => openBasket(event.currentTarget)} aria-haspopup="dialog">
            <Icon name="basket" />
            Basket
            <span>{basketIds.length}</span>
          </button>
        </nav>
        <a className="account-link" href="/login">YK</a>
      </header>

      <main id="top">
        <section className="board-heading">
          <div>
            <span className="section-label">AUTOMATED OPPORTUNITY INTELLIGENCE</span>
            <h1>Qualified leads</h1>
          </div>
          <div className="board-count"><strong>{opportunities.filter((item) => item.lifecycleStatus === "qualified").length}</strong><span>ready to review</span></div>
        </section>

        <div className="toolbar" id="projects">
          <label className="search-field">
            <Icon name="search" />
            <span className="sr-only">Search projects</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search project, location, contact, source..."
            />
          </label>
          <div className="filter-row" aria-label="Filter projects">
            {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={filter === key ? "active" : ""}
                aria-pressed={filter === key}
              >
                {filterLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="gallery-meta">
          <span>{filtered.length} lead{filtered.length === 1 ? "" : "s"}</span>
          <span>Newest signals first</span>
          {interactiveDemo ? (
            <span className="notice demo-notice" role="status"><i />Interactive demo · browser session only</span>
          ) : data.notice ? <span className="notice" role="status"><i />{data.notice}</span> : null}
          {interactiveDemo && demoState.strategySaved ? (
            <button type="button" className="demo-reset" onClick={() => dispatchDemo({ type: "reset" })}>Reset</button>
          ) : null}
        </div>

        <section className="project-gallery" aria-label="Available projects">
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
                <span className="empty-kicker">{interactiveDemo ? "READY WHEN YOU ARE" : "NO RESULTS"}</span>
                <strong>{opportunities.length === 0 ? "Set your Lead Strategy once." : "No leads in this view."}</strong>
                <span>
                  {opportunities.length === 0
                    ? "Approve a proposed source, then watch discovery, assessment, focused research, and qualification complete automatically."
                    : "Try a different filter or search."}
                </span>
                {interactiveDemo ? (
                  <div className="empty-actions">
                    <Link className="primary-link" href="/sources?demo=empty">Open autonomous workflow →</Link>
                    <Link href="/?demo=sample">Skip to sample projects</Link>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {basketOpen ? (
        <BasketDrawer
          items={basketItems}
          onSelect={(id, trigger) => openLead(id, trigger)}
          onRemove={basket.remove}
          onClear={basket.clear}
          onReview={openReviewWorkspace}
          onClose={() => setBasketOpen(false)}
        />
      ) : selectedLead ? (
        <LeadDrawer
          key={selectedLead.id}
          opportunity={selectedLead}
          saved={basketIds.includes(selectedLead.id)}
          initialTab={searchParams.get("tab") === "review" ? "review" : "overview"}
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
          onReviewed={completeReviewedLead}
          onClose={closeLead}
        />
      ) : null}
    </div>
  );
}
