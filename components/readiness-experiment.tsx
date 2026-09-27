"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OpportunityView } from "@/lib/domain";
import { evaluateConversationReadiness, readinessApplicability, readinessLabels, readinessReasons, readinessMetrics, parseDemoReadinessLabels, type ReadinessView, type ReadinessLabel, type ConversationReadinessInput } from "@/lib/readiness";
import { readinessCopy, readinessTerm } from "@/lib/readiness-copy";
import { labelReadinessAction } from "@/app/actions/readiness-label";
import { useInterfacePreferences } from "./interface-preferences";

const DEMO_STORAGE = "yipyip-readiness-labels-v1";
function demoEvaluation(opportunity: OpportunityView, index: number): ReadinessView {
  const ref = opportunity.evidence[0]?.url ?? "https://example.org/simulated-evidence";
  const evidence = { confidence: 0.8, evidenceRefs: [ref], rationale: "Simulated evidence for the presentation workflow; not a live assessment." };
  const input: ConversationReadinessInput = {
    softwareNeed: { status: "concrete", ...evidence }, capability: { status: "transferable", ...evidence },
    buyingIntent: { status: index % 3 === 2 ? "no_new_software" : "unknown", ...evidence },
    commercial: { status: index % 3 === 1 ? "unknown" : "funding_proxy", scopeBasis: "capacity_proxy", addressableValueEur: null, supportsMinimum: index % 3 !== 1, ...evidence },
    timing: { status: "future_planning", validUntil: null, ...evidence }, contact: { status: "legitimate_route", ...evidence },
    safeguards: { status: "clear", ...evidence }, questions: ["Is external software support being considered?", "Who owns the scope and budget?"],
  };
  const createdAt = opportunity.lastAssessedAt ?? opportunity.firstSeenAt;
  return { id: `demo-readiness-${opportunity.id}`, assessmentId: opportunity.latestAssessmentId ?? `demo-assessment-${opportunity.id}`,
    createdAt, input, result: evaluateConversationReadiness(input, { allowedEvidenceRefs: [ref], minimumBudgetEur: 30_000, evaluatedAt: createdAt }), labels: [] };
}

function LabelForm({ view, viewerId, demo, onDemoLabel }: { view: ReadinessView; viewerId: string; demo: boolean; onDemoLabel: (label: ReadinessLabel) => void }) {
  const { locale } = useInterfacePreferences(); const copy = readinessCopy[locale]; const router = useRouter();
  const prior = view.labels.find((label) => label.reviewerId === viewerId);
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState("");
  const [state, action, pending] = useActionState(async (previous: { ok: boolean; message: string }, form: FormData) => {
    if (!demo) return labelReadinessAction(previous, form).then((result) => { if (result.ok) { setRequestId(""); setReason(""); router.refresh(); } return result; });
    const label = String(form.get("label")); const selectedReason = String(form.get("reason")); const notes = String(form.get("notes") ?? "").trim();
    if (!readinessLabels.some((item) => item === label) || !readinessReasons.some((item) => item === selectedReason) || (selectedReason === "other" && !notes)) return { ok: false, message: "invalid" };
    onDemoLabel({ id: crypto.randomUUID(), reviewerId: viewerId, label: label as ReadinessLabel["label"], reason: selectedReason, notes: notes || null, createdAt: new Date().toISOString() });
    setReason(""); setRequestId("");
    return { ok: true, message: "saved" };
  }, { ok: false, message: "" });
  return <form action={action} className="readiness-label-form" onSubmit={(event) => {
    // Generate at submission (not render/SSR), retaining the key for transport retries.
    const input = event.currentTarget.elements.namedItem("idempotencyKey") as HTMLInputElement;
    input.value = requestId || crypto.randomUUID(); setRequestId(input.value);
  }}>
    <input type="hidden" name="evaluationId" value={view.id} />
    <input type="hidden" name="expectedLabelId" value={prior?.id ?? ""} />
    <input type="hidden" name="idempotencyKey" defaultValue="" />
    <fieldset disabled={pending}>
      <legend>{copy.judgment}</legend>
      <label>{copy.judgment}<select name="label" required defaultValue=""><option value="" disabled>{copy.choose}</option>{readinessLabels.map((label) => <option key={label} value={label}>{copy.labels[label]}</option>)}</select></label>
      <label>{copy.reason}<select name="reason" required value={reason} onChange={(event) => setReason(event.target.value)}><option value="" disabled>{copy.choose}</option>{readinessReasons.map((item) => <option key={item} value={item}>{copy.reasons[item]}</option>)}</select></label>
      <label className="readiness-wide">{copy.notes}<textarea name="notes" maxLength={1000} required={reason === "other"} rows={2} /></label>
      <button type="submit" className="primary-action">{pending ? copy.saving : copy.submit}</button>
    </fieldset>
    <p role="status" aria-live="polite">{state.message ? copy.messages[state.message as keyof typeof copy.messages] ?? copy.messages.failed : ""}</p>
  </form>;
}

export function ReadinessExperiment({ opportunities, demo, viewerId, notice }: { opportunities: OpportunityView[]; demo: boolean; viewerId?: string; notice?: string }) {
  const { locale, copy: shared } = useInterfacePreferences(); const copy = readinessCopy[locale];
  const [blind, setBlind] = useState(true);
  const [demoLabels, setDemoLabels] = useState<Record<string, ReadinessLabel[]>>({});
  useEffect(() => {
    if (!demo) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { setDemoLabels(parseDemoReadinessLabels(JSON.parse(sessionStorage.getItem(DEMO_STORAGE) ?? "{}"))); } catch { /* Browser storage may be unavailable. */ }
    });
    return () => { active = false; };
  }, [demo]);
  const identity = demo ? "simulated-reviewer" : viewerId ?? "";
  const rows = opportunities.map((opportunity, index) => {
    const view = demo ? demoEvaluation(opportunity, index) : opportunity.readiness;
    if (view && demo) view.labels = demoLabels[view.id] ?? [];
    return { opportunity, view, applicability: view ? demo ? "current" as const : readinessApplicability(view, opportunity.latestAssessmentId) : null };
  });
  const metrics = readinessMetrics(rows.flatMap(({ opportunity, view, applicability }) => view ? [{ evaluation: view, current: applicability === "current", qualified: opportunity.lifecycleStatus === "qualified" }] : []));
  return <section className="readiness-experiment" aria-labelledby="readiness-title">
    <h1 id="readiness-title">{copy.title}</h1><p>{copy.intro}</p>
    {demo && <p className="notice" role="status">{copy.simulated}</p>}
    {notice && <p role="alert">{copy.messages[notice as keyof typeof copy.messages] ?? copy.messages.load_failed}</p>}
    <label className="readiness-blind"><input type="checkbox" checked={blind} onChange={(event) => setBlind(event.target.checked)} />{copy.blind}</label>
    <p>{copy.blindNote}</p>
    <dl className="readiness-metrics">
      <div><dt>{copy.coverage}</dt><dd>{metrics.evaluated}/{opportunities.length}</dd></div>
      <div><dt>{copy.judgments}</dt><dd>{metrics.labels}</dd></div>
      <div><dt>{copy.comparisons}</dt><dd>{metrics.comparable}</dd></div>
      <div><dt>{copy.disagreements}</dt><dd>{metrics.disagreements}</dd></div>
      <div><dt>{copy.misses}</dt><dd>{metrics.falseNegativeCandidates}</dd></div>
    </dl><p>{copy.metricsNote}</p>
    {rows.length === 0 && <p>{copy.empty}</p>}
    {rows.map(({ opportunity, view, applicability }) => {
      const reveal = !blind || Boolean(view?.labels.some((label) => label.reviewerId === identity));
      return <article key={opportunity.id} className="readiness-case">
        <p>{opportunity.organization}</p><h2>{opportunity.title}</h2><p>{opportunity.summary}</p>
        <p>{shared.drawer.deliveryCapacity}: {readinessTerm(opportunity.qualificationChecks?.capacityEvidence?.status ?? "unknown", locale)}{opportunity.qualificationChecks?.capacityEvidence?.effectiveUntil ? ` · ${shared.drawer.capacityValidThrough}: ${opportunity.qualificationChecks.capacityEvidence.effectiveUntil}` : ""}. {readinessTerm("no_delivery_capacity_commitment", locale)}.</p>
        <details><summary>{shared.drawer.sources}</summary><ul>{opportunity.evidence.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>{source.excerpt}</p></li>)}</ul></details>
        {!view ? <p>{copy.missing}</p> : <>
          <p>{copy.snapshot}: <time dateTime={view.evidenceAt ?? view.createdAt}>{new Date(view.evidenceAt ?? view.createdAt).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB")}</time> · {copy[applicability!]}</p>
          {(demo || opportunity.reviewCapability === "decide") && applicability === "current" ? <LabelForm key={view.id} view={view} viewerId={identity} demo={demo} onDemoLabel={(label) => {
            const next = { ...demoLabels, [view.id]: [label, ...(demoLabels[view.id] ?? [])] };
            setDemoLabels(next); try { sessionStorage.setItem(DEMO_STORAGE, JSON.stringify(next)); } catch { /* Session only. */ }
          }} /> : <p>{copy.readOnly}</p>}
          {!reveal ? <p>{copy.reveal}</p> : <>
            <dl className="readiness-comparison"><div><dt>{copy.existing}</dt><dd>{readinessTerm(opportunity.lifecycleStatus, locale)} · {opportunity.score ?? "—"}/100</dd></div><div><dt>{copy.experimental}</dt><dd>{applicability === "current" ? copy.statuses[view.result.status] : copy[applicability!]}</dd></div></dl>
            <ul>{view.result.reasons.map((reason) => <li key={reason}>{readinessTerm(reason, locale)}</li>)}</ul>
            <h3>{copy.uncertainty}</h3><ul>{view.result.uncertainties.map((item) => <li key={item}>{readinessTerm(item, locale)}</li>)}</ul>
            <h3>{copy.questions}</h3><ul>{view.result.questions.map((question) => <li key={question}>{question}</li>)}</ul>
            <details><summary>{copy.evidence}</summary>{view.input && Object.entries(view.input).filter(([key]) => key !== "questions").map(([key, value]) => {
              const claim = value as ConversationReadinessInput["softwareNeed"];
              return <div key={key}><h3>{readinessTerm(key, locale)}: {readinessTerm(claim.status, locale)}</h3><p>{claim.rationale}</p><ul>{claim.evidenceRefs.map((ref) => {
                const url = ref.startsWith("https://") ? ref : opportunity.evidence.find((item) => item.id === ref)?.url;
                return <li key={ref}>{url?.startsWith("https://") ? <a href={url} target="_blank" rel="noreferrer">{url}</a> : ref}</li>;
              })}</ul></div>;
            })}</details>
            {view.labels.length > 0 && <details><summary>{copy.history}</summary><ul>{view.labels.map((label) => <li key={label.id}>{copy.labels[label.label]} · {copy.reasons[label.reason as keyof typeof copy.reasons] ?? label.reason} · {new Date(label.createdAt).toLocaleString(locale)}{label.notes && <p>{label.notes}</p>}</li>)}</ul></details>}
          </>}
        </>}
      </article>;
    })}
  </section>;
}
