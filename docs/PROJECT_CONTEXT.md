# YipYip Project Context

Last updated: 25 September 2026

## Product

YipYip is an autonomous lead engine. A workspace configures one editable Lead Strategy, approves reputable sources once, and then receives automatically discovered, assessed, researched, and qualified Leads. Humans review finished Leads and genuine exceptions—not routine assessment steps. `PRD.md` version 1.9 is the product source of truth.

## Implemented

- Next.js 16 App Router application, JetBrains Mono, responsive qualified-Lead gallery, URL-backed modal lead drawer, evidence tabs, and separate session basket.
- Authenticated Source Network at `/sources?workspace=<uuid>` with explicit workspace selection, editable/versioned Lead Strategy, automation summary, source approval inbox, approved monitors, workflow history, and exceptions.
- Browser-local `/sources?demo=empty` simulation: save strategy → automatic Source Scout → individual approval → automatic monitor/normalize/resolve/assess/gap/research/reassess/route → two qualified Leads plus one Needs-attention exception. Repeat monitoring demonstrates exact-match deduplication. It never calls Supabase or OpenAI.
- `20260924111240_autonomous_lead_workflow.sql`: Lead Strategy automation fields, legacy query-pack archival, source reputation separate from health, candidates, weekday jobs, workflow/stage leases, exceptions, role-scoped RPCs, same-workspace qualification references, and service-only dispatch/worker functions.
- `20260924124107_live_operator_controls.sql`: authenticated workspace onboarding, current-strategy source carry-forward, superseded-work cancellation, one-active-workflow constraints, atomic retry/exception-research RPCs, bounded research pass identity, workspace-scoped service claims, and operator source-monitor queueing.
- `20260924154613_correct_empty_source_scout_state.sql`: repairs historical zero-proposal Source Scout workflows that were incorrectly left at `waiting_approval`; future zero-reviewable runs finish successfully with an explicit empty result.
- Timezone-aware weekday scheduling at local 07:00, including Amsterdam DST; frequent Cron is expected to call a protected Next.js endpoint, which dispatches due work and processes one stage.
- Specialized bounded OpenAI agents for Source Scout, source monitoring, First/Final Assessment, Gap Analysis, and focused Research. Application code validates evidence, calculates scores, handles idempotency/retries, and routes outcomes.
- Search agents require an observed hosted-search call and accept evidence URLs only from raw web-search sources or URL-citation annotations. Custom API roots receive a narrow modern-to-preview search compatibility fallback.
- Search-agent Responses explicitly include `web_search_call.action.sources`, so deterministic citation validation receives the provider's consulted URLs instead of trusting URLs emitted by the model. Source Scout records generated, evidence-rejected, suppressed, and reviewable proposal counts.
- Agent-facing URL fields use strict-output-compatible bounded strings; deterministic application validation still requires canonical HTTPS URLs, citation allow-list membership, and source-host agreement before persistence.
- Research Agent `value` output is a bounded nullable string rather than an unconstrained JSON value, ensuring every nullable `anyOf` branch has an explicit OpenAI strict-schema type. Historical JSON-valued findings are normalized to bounded text before final reassessment.
- Live stages emit structured, credential-redacted `[automation]` start/completion/failure events to the Next.js server terminal and retain durable failure details in stage history. Provider-incomplete failures have their own operational code.
- Live agent stages default to a configurable 150-second foreground deadline (`AUTOMATION_AGENT_TIMEOUT_SECONDS`, bounded to 30–240 seconds), receive a database lease 30 seconds longer than that deadline, and run behind automation routes with a 300-second deployment ceiling.
- Search-agent Responses allow 4,000 provider output tokens because that ceiling includes hidden reasoning tokens; prompts still target approximately 1,200 tokens of concise final structured output, and the workflow cost envelope remains enforced.
- Exact Organization/Opportunity resolution, immutable Signals, automated Assessments with null `assessed_by`, Research Questions/Findings, automatic review-ready Leads, and explicit qualification exceptions.
- Commercial-fit scoring policy `2026-09-24.2`: weights total 100%; Budget and Delivery require 6/10 at 0.65 confidence; €30k minimum, €50k–€100k preferred, and €250k review defaults are editable in Lead Strategy. Assessments persist total value separately from YipYip-addressable value, evidence status/references, scope boundary, and explanation. Unsupported commercial claims are downgraded deterministically; unresolved final unknowns enter Needs attention.
- `20260924171140_commercial_fit_lead_review.sql` plus forward fixes: strategy budget fields, immutable strategy-specific policy snapshots, Assessment commercial snapshots, sequential Lead versions, downward-only monitor smoke overrides, and an atomic role-scoped `review_lead` RPC with idempotency and stale-version protection.
- Lead drawer Review tab with Pursue, Pass, Request research, and route change; stable reasons, immutable history, role-aware controls, and accessible pending/results. The session basket opens the dedicated `/reviewed` pursuit workspace, which groups saved, working, research-pending, and passed projects. Demo state remains in `sessionStorage`.
- Deterministic contact-route policy injects a high-impact research question when no confirmed route exists. Citation-backed named-person, responsible-team, procurement-desk, or tender-channel findings are projected into the Lead; a bounded unknown becomes a `contact_route_unresolved` exception instead of a qualified Lead.
- Deterministic monitor health from terminal telemetry with immutable health events. Reputation expresses trust/relevance; health expresses execution reliability.
- Explicit grants/RLS, owner/operator strategy/source controls, reviewer exception visibility/resolution, viewer read-only access, service-only worker RPCs, generated Supabase types, and three transactional SQL suites.
- Motion 13 for restrained state transitions with user reduced-motion behavior; project-local Motion AI Kit is installed.

## Current architecture

- `app/page.tsx`, `components/dashboard.tsx`, and `lib/data/opportunities.ts`: qualified-Lead gallery and evidence review.
- `app/sources/*`, `components/source-actions.tsx`, and `lib/data/discovery.ts`: authenticated Source Network and owner/operator mutations.
- `lib/demo-workflow.ts`, `components/use-demo-workflow.ts`, and `components/demo-sources.tsx`: deterministic browser-session workflow simulator.
- `lib/automation/contracts.ts`: strict outputs for Source Scout, assessment, gaps, and research.
- `lib/automation/agent-runtime.ts`: server-only bounded agent executors; no tracing or response storage.
- `lib/automation/strategy.ts` and `pipeline.ts`: search-plan snapshots, source reputation/suppression, DST schedule calculation, deterministic scoring/routing, and retry policy.
- `lib/automation/worker.ts`: one durable stage per invocation, exact persistence, automated qualification, health evaluation, and failure routing.
- `app/api/internal/automation/tick/route.ts`: bearer-protected automation entry point; requires feature flag, service key, OpenAI key, and automation secret.
- `app/api/automation/run/route.ts`: same-origin authenticated owner/operator POST entry point that drains one workspace queue one durable stage per request, plus an authenticated GET status surface for the current leased stage and queued counts; it does not require the hosted-Cron URL or bearer secret.
- `components/source-actions.tsx` and `lib/automation/operator-progress.ts`: sticky live-run feedback backed by durable-stage polling, friendly stage explanations, elapsed time, completed/queued counts, explicit web-search state, persisted attempt failures, scheduled retry time, stale-lease recovery guidance, accessible announcements, and reduced-motion behavior.
- `lib/scoring.ts`, `lib/automation/pipeline.ts`, and `lib/automation/worker.ts`: deterministic commercial curve, minimum dimension gates, evidence-reference validation, focused unknown-budget research, immutable policy lookup, commercial snapshot persistence, final routing, and sequential qualified-Lead creation.
- `app/actions/lead-review.ts`, `components/dashboard.tsx`, `components/review-workspace.tsx`, and `lib/data/opportunities.ts`: authenticated Lead review actions, contact/commercial-fit presentation, batched history/capability loading, session shortlist, and the dedicated pursuit workspace.
- Legacy `lib/discovery/*` and manual discovery tables remain for compatible source-monitor execution and historical provenance. Query Packs and Coverage Profiles are not presented as user-facing concepts.
- `supabase/migrations/`: imperative schema. The autonomous migration preserves legacy identifiers/history, adds scheduling and durable orchestration, and does not activate hosted Cron.
- `supabase/tests/autonomous_lead_workflow.sql`: Lead Strategy roles, source approval, source/job creation, tenant isolation, service-only claims, lease expiry, dispatch idempotency, and DST scheduling.

## Active decisions

- One active Lead Strategy per workspace initially, with immutable version history.
- Source approval is the only routine human gate before monitoring. Agents never approve sources.
- Approved sources run every weekday at 07:00 in the strategy timezone; Source Scout reruns on material strategy changes and every 30 days.
- One protected invocation performs one bounded stage so workflows remain resumable and request-duration safe.
- Exact deterministic entity matching is automatic. Ambiguous/probabilistic matches go to Needs attention.
- Qualified Opportunities automatically create review-ready Leads. Rejected and in-progress Opportunities stay in operational history and do not clutter the default gallery.
- Automatic qualification requires a supported actionable contact route; inferred labels trigger bounded research and terminal unknowns route to Needs attention.
- Internal Search Plan snapshots retain query reproducibility; users never manage Query Packs.
- Live automation and Cron default off. No deployment, billable agent run, outreach, or delivery action occurs without explicit authorization.

## Known limitations

- Hosted Cron/Vault remains unconfigured. Earlier bounded Source Scout attempts against a custom Responses endpoint did not report or execute a hosted web-search call in a form the SDK could verify; those runs were correctly rejected and nothing was persisted. Later official-endpoint runs performed hosted search but omitted the optional raw search-source list, so deterministic citation validation rejected every proposal; source-list inclusion is now corrected, but a successful post-fix end-to-end live run is still pending.
- Agent cost is an estimate; the first controlled source-monitor smoke cost €0.076098 and returned one candidate, but the candidate was correctly rejected for an out-of-lookback publication and a source URL that did not exactly match the provider-cited PDF/HTML variant. A labeled evaluation set and more controlled source runs are still required to calibrate quality, thresholds, URL equivalence, and cost.
- The Agents SDK currently reduces an unsuccessful `response.incomplete` event to a generic model-behavior error, so the exact provider `incomplete_details.reason` is not available through the existing non-streaming runner path. The official reasons are max output tokens, max messages, content filtering, or steering.
- The first live approved-source monitor repeatedly reached the former 60-second foreground deadline. The coordinated limit is now 150 seconds by default; genuinely longer multi-search work still requires a durable Responses background-mode integration rather than an unbounded HTTP request.
- Source Monitor currently uses the hosted web-search path scoped to an approved source; source-specific feed/API adapters remain future work.
- Entity resolution is exact only. Persistent pursuit/pass/research/route review is implemented; field correction, merge/split review UI, delivery/export, CRM, outreach, and proposal generation remain future.
- The public demo is deterministic `sessionStorage`, not live research or an authenticated demo account.
- Basket contents remain client-session only; `/reviewed` combines that shortlist with persistent Lead/review state but does not make the shortlist itself durable.

## Safest next work

Calibrate the official-publication monitor against a labeled recent set before relaxing validation. In particular, decide whether provider-cited PDF and canonical HTML variants should be considered equivalent only when they resolve to the same official publication identifier, and strengthen the monitor prompt/date checks so stale results are not proposed. Then run one bounded candidate that reaches commercial assessment to validate the new policy live. Keep hosted Cron/Vault disabled until repeated source precision, research value, health, and cost are acceptable.
