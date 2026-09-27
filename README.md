# YipYip Early Signal

YipYip is an autonomous lead-discovery and qualification system for digital agencies. A workspace defines one editable Lead Strategy, approves reputable sources once, and receives evidence-backed qualified Leads after recurring discovery, assessment, focused research, and deterministic routing.

The product contract is [PRD.md](./PRD.md). The editable workflow is [docs/yipyip-workflow.excalidraw](./docs/yipyip-workflow.excalidraw), with [SVG](./docs/yipyip-workflow.svg) and [PNG](./docs/yipyip-workflow.png) previews.

## Implemented vertical slice

- Optional **Readiness experiment** (`/?view=readiness`): evidence-backed conversation readiness beside unchanged delivery qualification. Defaults off for authenticated workspaces; sample/empty demos provide explicitly simulated, session-only labels. See [shadow evaluation guide](docs/READINESS_EXPERIMENT.md).

- Responsive lead gallery that defaults to qualified Leads, with Monitoring and Needs-attention views.
- URL-backed artifact drawer at `/?lead=<opportunity-id>` and a shared session shortlist drawer that remains available across Leads, Source Network, and the Pursuit workspace. Stale saved IDs are removed when their Opportunities no longer exist, keeping the badge and drawer count aligned.
- Authenticated **Source Network** at `/sources?workspace=<uuid>` with one editable, versioned Lead Strategy.
- Coverage-aware, bounded Source Scout proposals with reputation evidence, sample results, access/policy checks, cost, and individual approval. Each Scout sees the current source inventory, prioritizes uncovered/lowest-covered strategy areas, and explains what genuinely new coverage a proposal adds.
- Resilient Source Scout output handling: OpenAI validates the strict object shape, while YipYip independently bounds and validates each proposal so one malformed candidate cannot erase valid siblings. Only sanitized issue paths/codes are retained.
- Deterministic Scout diversity: active/pending domains and same-run duplicates are rejected, off-strategy gaps are excluded, and no run may retain more than two proposals for one coverage gap or normalized source family. The stage remains limited to five proposals and six hosted-search calls under its configured cost envelope.
- Source Scout waits for approval only when at least one cited proposal survives deterministic validation; valid empty runs complete with explicit rejection/suppression telemetry.
- Approval-to-weekday-monitor setup with timezone-aware `07:00 Europe/Amsterdam` scheduling contracts.
- Protected server worker at `/api/internal/automation/tick`, service-only dispatch/lease/completion RPCs, one stage per invocation, expired-lease recovery, and bounded retries.
- Authenticated operator runner at `/api/automation/run` with a sticky, polled current-stage display, elapsed time, queue counts, explicit web-search activity, safe expired-lease recovery, idempotent per-source **Queue live monitor**, and reviewer **Research missing info** controls for qualification exceptions.
- Specialized bounded Source Scout, monitor, assessor, gap-analysis, and research agents. Deep research runs focused commercial, buyer-access, capability, and timing bundles; a first semantic unknown receives one diversified continuation. Deterministic application code owns validation, score calculation, routing, and source health.
- Research telemetry separates all consulted URLs from the smaller set of sources cited for stored claims. Direct facts may use one authoritative primary source; strongly inferred findings require at least two cited sources.
- Source Monitor classifies results as organization-specific or programme-only. Funding calls without an identified buyer/applicant remain monitored Signals and cannot create synthetic Organizations, Opportunities, Assessments, or Leads.
- Signal persistence separates page provenance from logical item identity: several opportunities may safely originate from one roundup URL, unchanged retries reuse the prior Signal, and changed snapshots receive an atomically allocated revision.
- Source Monitor treats discovery as a recall-oriented intake boundary: a concrete current software signal may continue with unknown budget, buyer contact, route, or addressable scope so later assessment and focused research can resolve it. A valid empty run records an explicit reason rather than inventing a candidate.
- Deterministic contact-access gate: application code injects bounded research for a named person, responsible team, procurement desk, or official tender channel; citation-backed routes are shown in the Lead and otherwise promising cases with unavailable routes enter Monitoring after two attempts.
- Exact Signal/Organization/Opportunity resolution, automated initial/final Assessments, decision-relevant Research Questions/Findings, automatic qualified Lead creation, terminal Monitoring for promising but publicly unresolved cases, and Needs-attention exceptions for genuine conflict or risk.
- Policy `2026-09-25.2` preserves the original-brief weights and gates while adding potential-aware research and terminal Monitoring for unavailable public facts. It propagates YipYip's software capabilities, hard/sensitive sectors, search exclusions, commercial thresholds, and effective-dated capacity through discovery, Search Plans, assessment, and deterministic routing; historical `2026-09-25.1` Assessments remain unchanged.
- Technical capability fit and delivery capacity are now separate persisted gates. Evaluation shows matched YipYip services, unsupported or unresolved project requirements, citation confidence, and the operator-owned capacity status/valid-through date. Capacity-only failures use `delivery_capacity_uncertain`; technical-fit ambiguity uses `capability_fit_uncertain`.
- Lead creation is service-only and independently requires a final `qualify` Assessment, no hard rejection, and persisted `qualificationChecks.allPassed = true`. Historical policy mismatches are quarantined under **Needs requalification** without rewriting Lead or review history.
- Commercial fit separates total procurement value from YipYip-addressable scope, records whether that scope is a dedicated package, explicit lot, whole procurement, proxy, or unknown, and keeps the editable €30k minimum, €50k–€100k preferred, and €250k review defaults.
- Every newly qualified Lead version stores an immutable evidence-grounded email and cold-call draft. The Outreach tab provides copy controls, source links, language, and caveats; it never sends messages.
- Distinct drawer actions: non-Lead exceptions use **Resolve** with atomic Research missing information / Pass on opportunity actions, while finished Leads use **Decision** with version-checked Start pursuing, Pass on Lead, Research a gap, and route changes. Both paths retain stable reasons, idempotency, role enforcement, and immutable history.
- Active automatic qualification is shown separately as **Progress**. Queued or running qualification workflows—including the normal signal-created path—say that research is underway and direct an operator to **Source Network → Process live queue**; they do not display a false exception warning or ask for another research request.
- Owner/reviewer **Create manual Lead** for eligible completed Opportunities during low-volume periods. Manual Leads are labelled separately from automatic qualification, retain the unchanged score/lifecycle and unresolved gates, record an immutable attributed reason, receive a caveated outreach snapshot, and still require a separate pursuit Decision. Hard-excluded sectors and expired Opportunities without a current follow-on remain blocked.
- Dedicated `/reviewed` **Pursuit workspace** for requalification, saved, actively pursued, research-pending, and passed projects. The basket remains session-only; Supabase Lead state and decision history remain persistent.
- Workspace RLS, explicit grants, same-workspace references, immutable provenance/health events, generated Supabase types, and transactional SQL acceptance suites.
- Browser-local deterministic demo of the full workflow. Its Source Network mirrors the live operations layout and reuses the complete live Lead Strategy fields, while its worker, source proposals, activity, and outcomes remain explicitly simulated. It uses restrained Motion transitions with reduced-motion support and never contacts Supabase or OpenAI.
- English/Dutch interface controls and persistent light/dark themes across Leads, Source Network, Pursuit workspace, login, drawers, and the demo. Source-authored lead evidence is preserved in its original language.

Legacy Coverage Profile and Query Pack tables remain as internal storage/provenance. They are not user-facing concepts. The former manual discovery path is retained only for migration compatibility and historical run attribution.

## Run locally

Requirements: Node.js 22+, pnpm 10+, Docker, and the Supabase CLI supplied by this project.

```bash
pnpm install
pnpm exec supabase start
pnpm exec supabase db reset --local
cp .env.example .env.local
pnpm dev
```

Use `pnpm exec supabase status` to copy the local API URL and publishable key into `.env.local`. Open `http://localhost:3000/login`, then choose **Start with an empty demo** to rehearse the presentation path without an account. The Source Network has the same onboarding structure and fields as live, but all proposals, runs, costs, evidence, and outcomes are deterministic browser-local simulations. The demo persists only in the current tab's `sessionStorage`.

To test persistent live automation, create a user in local Supabase Studio under **Authentication → Users**, sign in at `/login`, and open **Source Network**. A user with no memberships can create a private workspace from that page; the operation atomically creates the workspace and owner membership.

## Live automation configuration

Live automation is server-only and defaults off. Configure:

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_DISCOVERY_MODEL=gpt-5.4-mini-2026-03-17
OPENAI_USD_TO_EUR=1
SUPABASE_SERVICE_ROLE_KEY=
AUTOMATION_CRON_SECRET=
APP_BASE_URL=http://localhost:3000
NEXT_ALLOWED_DEV_ORIGINS=
AUTOMATION_ENABLED=false
AUTOMATION_AGENT_TIMEOUT_SECONDS=150
```

`OPENAI_BASE_URL` is optional and must be an absolute HTTP(S) API root whose provider supports the Responses API, structured output, hosted web search, tool-call reporting, and URL citations. The runtime supports modern `web_search` and a narrow `web_search_preview` compatibility fallback, but rejects a response that did not actually search. `SUPABASE_SERVICE_ROLE_KEY`, `AUTOMATION_CRON_SECRET`, and OpenAI credentials must never enter browser code.

Operational cost estimates use reviewed Standard token prices for the configured OpenAI model, provider-reported cached input, and the current `$0.01` hosted-search call price. `OPENAI_USD_TO_EUR` converts those USD prices into the existing euro workflow envelope; it defaults to the explicit conservative planning rate `1`. Unknown model IDs stop before a vendor request until their pricing is reviewed. Each focused Research response is capped at three hosted tool calls and records the active cap, pricing version, cached tokens, and conversion rate in stage telemetry. Because the Agents SDK exposes normalized and raw representations of the same hosted call, YipYip deduplicates usage by the provider call ID before enforcing or pricing that limit.

`AUTOMATION_AGENT_TIMEOUT_SECONDS` controls the bounded foreground deadline for each live agent stage. It defaults to `150`, accepts `30`–`240`, and automatically gives the durable database stage a 30-second-longer lease. The automation route declares a 300-second deployment ceiling so persistence and cleanup can complete after the agent deadline.

Interactive operator processing requires `AUTOMATION_ENABLED=true`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`. `APP_BASE_URL` and `AUTOMATION_CRON_SECRET` are additionally required only for the protected scheduled-Cron endpoint.

`NEXT_ALLOWED_DEV_ORIGINS` is an optional comma-separated development-only hostname list for testing from another local browser surface (for example, a private-network address). Leave it empty for normal `localhost` development.

Run the app with `pnpm dev` in a visible terminal when testing live automation. Each claimed stage now writes structured `[automation]` start, completion, or failure lines to that Next.js terminal; durable copies of failures remain in `public.automation_stage_runs.failure_reason` and are also shown in Source Network. A Responses `response.incomplete` state commonly indicates `max_output_tokens`, `max_messages`, `content_filter`, or `steered`; the worker records it as `provider_incomplete` and schedules only the bounded workflow retry. Provider-output contract mismatches retry once; a second identical mismatch stops with its specific error code instead of entering a four-attempt loop.

For zero-result debugging, open **Source Network → Recent activity**. Every source-monitor cycle shows the approved source, hosted-search count, consulted-URL count, generated/accepted/rejected candidates, created or matched Opportunities, validation rejection reasons, and an explicit zero-result explanation. A successful monitor with zero candidates is operationally healthy but creates no Opportunity, so the Lead gallery's **All opportunities** filter remains empty; its empty state links back to Source Network. The terminal emits `source_monitor.completed`, `normalization.completed`, and `resolution.completed` with the corresponding non-sensitive IDs/counts. It also emits `source_network.snapshot` when the activity view loads, `queue.empty` when nothing is claimable, and a warning-level `dashboard.load_failed` if a live dashboard query falls back to sample data. That warning names the failed query and preserves sanitized Supabase code, message, details, and hint.

The migration deliberately does not activate hosted Cron. In a deployed Supabase project, store the app URL and automation secret in Vault and schedule a frequent `pg_cron`/`pg_net` call to `POST /api/internal/automation/tick`. That endpoint dispatches due jobs and processes one bounded stage. Enabling hosted Cron requires separate operator authorization. The manual source-monitor RPC accepts downward-only result and cost overrides for a controlled local smoke test; normal UI runs keep the configured limits.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec supabase db reset --local
pnpm exec supabase db lint --local --schema public --level warning --fail-on error
docker exec -i supabase_db_Yipyip psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/intent_based_discovery_coverage.sql
docker exec -i supabase_db_Yipyip psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/agent_opportunity_discovery.sql
docker exec -i supabase_db_Yipyip psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/autonomous_lead_workflow.sql
docker exec -i supabase_db_Yipyip psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/signal_revision_persistence.sql
```

Automated checks mock every agent boundary and never issue billable OpenAI calls.

## Remaining boundary

The code and database contract now support the corrected autonomous vertical slice, including guarded qualification, outreach drafting, and on-demand operator execution. The original brief is not proven until a controlled campaign produces 2–3 distinct current organizations that survive YipYip's commercial, capability, timing, contact, capacity, and evidence gates. Before running that campaign, an owner/operator must record factual current capacity and an effective-until date in the Lead Strategy; `unknown` or expired capacity intentionally cannot auto-qualify. Production operation still requires live calibration, a labeled evaluation set, deployment secrets, and hosted Cron activation. Probabilistic entity merging, reviewer field correction, outreach sending, CRM delivery, and proposal generation remain future work.
