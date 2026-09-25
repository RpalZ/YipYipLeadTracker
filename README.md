# YipYip Early Signal

YipYip is an autonomous lead-discovery and qualification system for digital agencies. A workspace defines one editable Lead Strategy, approves reputable sources once, and receives evidence-backed qualified Leads after recurring discovery, assessment, focused research, and deterministic routing.

The product contract is [PRD.md](./PRD.md). The editable workflow is [docs/yipyip-workflow.excalidraw](./docs/yipyip-workflow.excalidraw), with [SVG](./docs/yipyip-workflow.svg) and [PNG](./docs/yipyip-workflow.png) previews.

## Implemented vertical slice

- Responsive lead gallery that defaults to qualified Leads, with Monitoring and Needs-attention views.
- URL-backed artifact drawer at `/?lead=<opportunity-id>` and a separate session basket drawer.
- Authenticated **Source Network** at `/sources?workspace=<uuid>` with one editable, versioned Lead Strategy.
- Bounded Source Scout proposals with reputation evidence, sample results, access/policy checks, cost, and individual approval.
- Source Scout waits for approval only when at least one cited proposal survives deterministic validation; valid empty runs complete with explicit rejection/suppression telemetry.
- Approval-to-weekday-monitor setup with timezone-aware `07:00 Europe/Amsterdam` scheduling contracts.
- Protected server worker at `/api/internal/automation/tick`, service-only dispatch/lease/completion RPCs, one stage per invocation, expired-lease recovery, and bounded retries.
- Authenticated operator runner at `/api/automation/run` with a sticky, polled current-stage display, elapsed time, queue counts, explicit web-search activity, safe expired-lease recovery, idempotent per-source **Queue live monitor**, and reviewer **Research missing info** controls for qualification exceptions.
- Specialized bounded Source Scout, monitor, assessor, gap-analysis, and research agents. Deterministic application code owns validation, score calculation, routing, and source health.
- Exact Signal/Organization/Opportunity resolution, automated initial/final Assessments, decision-relevant Research Questions/Findings, automatic qualified Lead creation, and Needs-attention exceptions.
- Commercial-fit policy `2026-09-24.2` separates total procurement value from YipYip-addressable scope, enforces budget/delivery evidence gates, and uses editable €30k minimum, €50k–€100k preferred, and €250k review defaults.
- Persistent Lead Review tab with version-checked Pursue, Pass, Request research, and route-change actions; immutable events, stable reasons, role enforcement, and sequential Lead versions. Demo decisions remain session-only and visibly simulated.
- Workspace RLS, explicit grants, same-workspace references, immutable provenance/health events, generated Supabase types, and transactional SQL acceptance suites.
- Browser-local deterministic demo of the full workflow. It uses Motion transitions with reduced-motion support and never contacts Supabase or OpenAI.

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

Use `pnpm exec supabase status` to copy the local API URL and publishable key into `.env.local`. Open `http://localhost:3000/login`, then choose **Start with an empty demo** to test the autonomous workflow without an account. The demo persists only in the current tab's `sessionStorage`.

To test persistent live automation, create a user in local Supabase Studio under **Authentication → Users**, sign in at `/login`, and open **Source Network**. A user with no memberships can create a private workspace from that page; the operation atomically creates the workspace and owner membership.

## Live automation configuration

Live automation is server-only and defaults off. Configure:

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_DISCOVERY_MODEL=gpt-5.4-mini-2026-03-17
SUPABASE_SERVICE_ROLE_KEY=
AUTOMATION_CRON_SECRET=
APP_BASE_URL=http://localhost:3000
AUTOMATION_ENABLED=false
AUTOMATION_AGENT_TIMEOUT_SECONDS=150
```

`OPENAI_BASE_URL` is optional and must be an absolute HTTP(S) API root whose provider supports the Responses API, structured output, hosted web search, tool-call reporting, and URL citations. The runtime supports modern `web_search` and a narrow `web_search_preview` compatibility fallback, but rejects a response that did not actually search. `SUPABASE_SERVICE_ROLE_KEY`, `AUTOMATION_CRON_SECRET`, and OpenAI credentials must never enter browser code.

`AUTOMATION_AGENT_TIMEOUT_SECONDS` controls the bounded foreground deadline for each live agent stage. It defaults to `150`, accepts `30`–`240`, and automatically gives the durable database stage a 30-second-longer lease. The automation route declares a 300-second deployment ceiling so persistence and cleanup can complete after the agent deadline.

Interactive operator processing requires `AUTOMATION_ENABLED=true`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`. `APP_BASE_URL` and `AUTOMATION_CRON_SECRET` are additionally required only for the protected scheduled-Cron endpoint.

Run the app with `pnpm dev` in a visible terminal when testing live automation. Each claimed stage now writes structured `[automation]` start, completion, or failure lines to that Next.js terminal; durable copies of failures remain in `public.automation_stage_runs.failure_reason` and are also shown in Source Network. A Responses `response.incomplete` state commonly indicates `max_output_tokens`, `max_messages`, `content_filter`, or `steered`; the worker records it as `provider_incomplete` and schedules only the bounded workflow retry.

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
```

Automated checks mock every agent boundary and never issue billable OpenAI calls.

## Remaining boundary

The code and database contract now support the autonomous vertical slice, including on-demand operator execution. Production operation still requires a compatible hosted-search provider, a labeled evaluation set, successful live end-to-end calibration, deployment secrets, and hosted Cron activation. Probabilistic entity merging, reviewer field correction, outreach, email, CRM delivery, and proposal generation remain future work.
