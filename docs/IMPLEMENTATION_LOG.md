# YipYip Implementation Log

Chronological record of meaningful implementation and verification units. `docs/PROJECT_CONTEXT.md` remains the concise current-state source.

## 2026-09-22 — Establish repository context contract

- **Objective:** Make future work reconstructable and evidence-based before implementing the approved lead-gallery redesign.
- **Affected:** `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/IMPLEMENTATION_LOG.md`.
- **Decisions:** Log coherent implementation and verification units rather than every shell command; keep current state separate from chronological history; never record secrets or unverified passes.
- **Outcome:** Added repository-wide grounding, logging, safety, and completion requirements plus a baseline description of implemented and missing behavior.
- **Verification:** Confirmed the files were created through the repository patch workflow. Full application checks are deferred until the implementation is complete.
- **Limitations:** The baseline context describes the approved drawer design before the UI implementation is complete.
- **Next:** Create and validate the six repository-local PRD skills.

## 2026-09-22 — Add PRD-specific repository skills

- **Objective:** Route future YipYip work through focused, reusable product guidance without duplicating the PRD.
- **Affected:** `.codex/skills/yipyip-*` skill entrypoints and UI metadata.
- **Decisions:** Created six implicitly discoverable specialists for context, discovery, assessment/research, data, lead-review frontend, and QA/reliability; each reads canonical repository context and preserves its subsystem boundaries.
- **Outcome:** Added twelve skill files covering the PRD workflow and authorization constraints.
- **Verification:** All six skills passed `quick_validate.py`. The initial direct invocation lacked execute permission, so validation was rerun successfully through `python3`.
- **Limitations:** The skills encode project guidance but do not implement the missing pipeline stages themselves.
- **Next:** Implement the lead gallery and drawers using the frontend skill.

## 2026-09-22 — Implement progressive lead gallery and drawers

- **Objective:** Replace the simultaneous feed, full detail, and basket columns with a readable gallery and artifact-style progressive disclosure.
- **Affected:** `components/dashboard.tsx`, `app/globals.css`, `lib/lead-navigation.ts`, and `tests/lead-navigation.test.ts`.
- **Decisions:** Use `?lead=<id>` as the public lead state; use native modal dialogs for focus containment and inert background behavior; separate lead content into Overview, Evaluation, and Sources; keep the basket session-only in its own drawer.
- **Outcome:** Added the compact page header, two-column lead gallery, larger typography, URL-backed lead drawer, basket drawer, keyboard tabs, source outlines, invalid-ID cleanup, and responsive full-screen mobile drawers.
- **Verification:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The first lint run found a synchronous state reset in an effect; the drawer now remounts per lead and lint passes.
- **Limitations:** Review actions remain intentionally disabled, basket state resets on reload, and browser interaction testing is still pending.
- **Next:** Verify desktop, tablet, and mobile behavior in the running application, then update canonical context and README.

## 2026-09-22 — Verify and document the lead-review experience

- **Objective:** Complete the acceptance pass for the progressive-disclosure redesign and leave the repository context aligned with verified behavior.
- **Affected:** `app/globals.css`, `components/dashboard.tsx`, `README.md`, and `docs/PROJECT_CONTEXT.md`.
- **Decisions:** Allow project facts to wrap instead of truncating at tablet widths; use the rendered evidence records as the visible source count; retain explicit Escape handling in addition to native dialog cancellation.
- **Outcome:** Desktop, 1024px tablet, and 390px mobile layouts present leads first without persistent detail or basket columns. Lead and basket dialogs remain mutually exclusive, mobile drawers fill the viewport, and card metadata stays readable without horizontal overflow.
- **Verification:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` all passed after the final changes. Browser checks passed for initial state, card and direct-URL opening, invalid-ID cleanup, browser Back, Close, Escape, backdrop close, focus restoration, modal scroll lock, keyboard tab navigation, outlined source links, search, filters, basket add/remove/clear, 1024px wrapping, 390px base typography, and console errors. The final browser console contained no warnings or errors.
- **Limitations:** Basket persistence, review mutations, hosted-source capture, discovery automation, and the OpenAI Agents SDK workflow remain future slices. Demo source links are representative rather than archived evidence.
- **Next:** Implement the server-only research-agent vertical slice with structured outputs, bounded web search, provenance, and Supabase persistence.

## 2026-09-22 — Add editable workflow map

- **Objective:** Give product reviewers one visual reference for understanding and verifying both the working lead-review experience and the planned signal-to-lead automation.
- **Affected:** `docs/yipyip-workflow.excalidraw`, `docs/yipyip-workflow.svg`, `docs/yipyip-workflow.png`, `scripts/generate-yipyip-workflow.mjs`, `README.md`, and `docs/PROJECT_CONTEXT.md`.
- **Decisions:** Split the diagram into an operator-review lane and a backend pipeline lane; distinguish verified behavior, existing data contracts, and planned work by both fill and line style; keep Supabase and production controls visible as shared foundations.
- **Outcome:** Added an editable Excalidraw source plus SVG and PNG previews. The review lane covers gallery, URL-backed details, source tabs, and basket behavior; the pipeline lane covers discovery, assessment, bounded research, human decisions, and delivery.
- **Verification:** Regenerated all diagram formats, parsed the Excalidraw JSON successfully as version 2 with 79 elements, and visually inspected the rendered PNG for label and connector readability.
- **Limitations:** The diagram documents intended future discovery, research, persistent review, delivery, and production-control stages; its legend prevents those from being mistaken for implemented behavior.
- **Next:** Use the diagram as the shared architecture reference when implementing the research-agent vertical slice.

## 2026-09-22 — Specify future Assisted Source Bootstrap

- **Objective:** Make first-run source setup easier to understand and formally capture AI-assisted source discovery as future work without weakening source governance.
- **Affected:** `PRD.md`, `docs/yipyip-workflow.excalidraw`, `docs/yipyip-workflow.svg`, `docs/yipyip-workflow.png`, `scripts/generate-yipyip-workflow.mjs`, and `docs/PROJECT_CONTEXT.md`.
- **Decisions:** Added three future onboarding routes—curated starter packs, known-source submission, and bounded Source Scout proposals. Every proposal remains disabled until an authorized source administrator approves access, policy, ownership, retention, schedules, rate limits, and cost controls. Automatic source enablement and a self-service adapter marketplace remain outside scope.
- **Outcome:** Updated the PRD to version 1.1 with a future workflow step, functional specification, FR 13, logical component, review gate, explicit MVP exclusion, Phase Five placement, open decision, and post-MVP acceptance criteria. The workflow diagram now shows a yellow dashed `FUTURE · source bootstrap` stage feeding approved entries into the Source Registry.
- **Verification:** `pnpm lint` passed. The regenerated Excalidraw document parsed as version 2 with 82 elements and contained the future-bootstrap label. PRD checks confirmed the feature section, FR 13, future component, MVP exclusion, Phase Five entry, and future acceptance section. The regenerated PNG was visually inspected for readable labels and connectors.
- **Limitations:** This task updates product requirements and architecture documentation only; no onboarding UI, Source Scout, adapter, job, schema migration, or hosted source was implemented or enabled.
- **Next:** Define the initial curated starter packs and proposal-governance policy before implementation planning for Phase Five.

## 2026-09-22 — Reframe source onboarding around coverage intent

- **Objective:** Remove the expectation that YipYip business users collect individual source links and make signal areas and commercial criteria the normal discovery configuration.
- **Affected:** `PRD.md`, `docs/yipyip-workflow.excalidraw`, `docs/yipyip-workflow.svg`, `docs/yipyip-workflow.png`, `scripts/generate-yipyip-workflow.mjs`, and `docs/PROJECT_CONTEXT.md`.
- **Decisions:** Split the future feature into a user-facing, versioned Discovery Coverage Profile and an internal exact-source registry. Users choose signal areas such as pitches, newsletters, funding, strategy, hiring, and consultations plus sector, geography, organization, project, keyword, freshness, cadence, and cost criteria. Curated packs and Source Scout resolve that intent; source operations retains approval responsibility for exact URLs and adapters.
- **Outcome:** Updated the PRD to version 1.2 with revised goals, non-goals, users, product principle, workflow, functional specification, future schema, FR 13, architecture, review ownership, MVP boundary, Phase Five roadmap, open decision, and acceptance criteria. The workflow now visibly separates future Discovery Coverage, source resolution, and the internal registry.
- **Verification:** `pnpm lint` passed. The regenerated Excalidraw document parsed as version 2 with 84 elements and contained the required Discovery Coverage, Source Scout, and internal-registry labels. PRD checks confirmed every updated contract section, and the PNG was visually inspected for readable nodes and connectors.
- **Limitations:** This remains a documentation and architecture change only; no Coverage Profile schema migration, onboarding interface, Source Scout, source catalog UI, or adapters were implemented.
- **Next:** Define the recommended default signal-area profile and the initial curated source packs before future implementation planning.

## 2026-09-22 — Implement the intent-based coverage data foundation

- **Objective:** Carry the approved criteria-first source model into the durable Supabase contract without prematurely enabling autonomous discovery or source collection.
- **Affected:** `supabase/migrations/20260922134229_intent_based_discovery_coverage.sql`, `supabase/tests/intent_based_discovery_coverage.sql`, `lib/supabase/database.types.ts`, all three Supabase client factories, `PRD.md`, `README.md`, and `docs/PROJECT_CONTEXT.md`.
- **Decisions:** Kept user-facing Coverage Profiles separate from the internal exact-source registry; modeled curated packs, candidate proposals, and approved profile-to-source mappings as normalized workspace-scoped records; allowed reviewers to edit intent and pack selection while reserving technical source approval and mapping for owners/operators; required an attributable review and same-workspace registry target before a candidate can be approved. Candidate approval never changes the registry's disabled-by-default state.
- **Outcome:** Added the schema foundation, composite tenant-safe references, constraints, indexes, update triggers, explicit grants, RLS policies, repeatable transactional acceptance coverage, generated database types, and typed Supabase clients. PRD version 1.3 now distinguishes the implemented data foundation from the still-future onboarding, Source Scout, scheduling, and adapter behavior.
- **Verification:** A fresh local Supabase reset applied both migrations; `supabase migration list --local` reported both versions; `supabase db lint --local --schema public --level warning --fail-on error` reported no schema errors; the SQL acceptance test passed owner/reviewer/stranger/anonymous, approval-integrity, cross-workspace, and approved-mapping checks and rolled back its fixtures; generated types completed successfully; `pnpm typecheck` passed after wiring the clients. Full application gates are recorded in the next verification unit.
- **Limitations:** No default source-pack rows, onboarding UI, Source Scout agent, scheduler, adapter, credential, or hosted migration was created. The local type-generation CLI emitted a non-fatal listener warning.
- **Next:** Run the full application checks and record the final verified state.

## 2026-09-22 — Verify the coverage foundation and application build

- **Objective:** Confirm the database extension and generated client contract do not regress the existing lead-review application.
- **Affected:** Local Supabase schema and the full Next.js workspace.
- **Outcome:** The coverage foundation is locally reproducible and the existing application continues to compile and render through its production build.
- **Verification:** `pnpm test` passed 2 test files; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The production build completed all application routes successfully. Database verification had already passed the fresh reset, migration listing, schema lint, and transactional acceptance suite recorded above.
- **Limitations:** Verification used the local Supabase stack only. No hosted project migration, live source, external adapter, or LLM call was attempted.
- **Next:** Populate a reviewed default Coverage Profile and initial curated source packs before implementing any bounded Source Scout execution.

## 2026-09-23 — Begin the agent-driven opportunity discovery slice

- **Objective:** Implement one manually triggered, agent-driven Dutch agency-pitch discovery path through validated Signals, immediately visible unassessed Opportunities, run telemetry, and deterministic query-pack health.
- **Affected:** Discovery domain and OpenAI runtime, Supabase migrations and tests, Sources operator experience, dashboard evidence mapping, environment contract, and canonical documentation.
- **Decisions:** Keep the feature disabled by default; use one server-only bounded agent; apply deterministic validation and exact-key deduplication outside model judgment; calculate health for the repeatable query pack rather than individual cited pages; never run billable searches during implementation verification.
- **Outcome:** Work started after grounding against the current code, migrations, PRD, project context, OpenAI documentation, Supabase guidance, and the repository discovery/data/QA skills.
- **Verification:** No implementation checks have run yet; results will be recorded in subsequent entries.
- **Limitations:** No hosted migration, production adapter, scheduled job, or live OpenAI call is authorized by this implementation task.
- **Next:** Add the pinned agent dependencies and implement the pure discovery validation and health-policy layer with tests.

## 2026-09-23 — Add bounded discovery agent and deterministic policy layer

- **Objective:** Establish the server-only OpenAI boundary and the deterministic gate that decides what may reach persistence.
- **Affected:** `lib/discovery/*`, `.env.example`, discovery unit tests, and pinned package dependencies.
- **Decisions:** The feature remains off unless `DISCOVERY_AGENT_ENABLED=true`; the executor uses one `@openai/agents` agent with hosted web search, strict Zod output, low search context/reasoning, five turns, five candidates, a 60-second abort, 1,200 output tokens, disabled SDK tracing, and no response storage. Cost is an explicitly estimated telemetry value, not billing truth.
- **Outcome:** Implemented citation allow-listing, HTTPS canonicalization, date/confidence/restricted-source checks, SHA-256 fingerprints and opportunity keys, duplicate detection, all specified health transitions, usage/cost telemetry, and a hard requirement for at least one web-search call. No API request was issued.
- **Verification:** `pnpm test` passed all four test files after correcting the precedence of the three-success recovery rule. `pnpm typecheck` initially exposed an unsupported per-run tracing property; the implementation was changed to the SDK's exported `setTracingDisabled(true)` API and awaits the next full check.
- **Limitations:** No persistence, operator page, or gallery integration is connected yet; cost rates are policy estimates and must remain visibly labeled as estimates.
- **Next:** Add the workspace-safe migration and invoker RPCs, then regenerate types before connecting the server action.

## 2026-09-24 — Add atomic discovery persistence and database authorization

- **Objective:** Persist manual discovery runs and accepted Signals as exact-match, unassessed Opportunities without wrapping the external OpenAI call in a database transaction.
- **Affected:** `supabase/migrations/20260923174516_agent_opportunity_discovery.sql`, `supabase/tests/agent_opportunity_discovery.sql`, and generated Supabase types.
- **Decisions:** Added workspace-composite foreign keys across the touched source, Signal, Organization, Opportunity, and link records; used one-active-run partial uniqueness; kept health events append-only; made the start/complete/fail RPCs security-invoker with explicit role checks and narrow grants; retained rejected candidates without creating gallery records.
- **Outcome:** The migration creates governed jobs, run telemetry, result audits, health events, bootstrap/enable/start/complete/fail RPCs, exact deterministic Organization/Opportunity matching, idempotent immutable Signals, and dashboard evidence aggregation. Agent discoveries stay `discovered`, with no Assessment or Lead row.
- **Verification:** Fresh local `supabase db reset` applied all three migrations. Database lint initially found two ambiguous PL/pgSQL conflict targets; they were replaced with named constraints and variables were disambiguated. A second lint reported no schema errors. The transactional acceptance suite passed owner execution, reviewer/viewer denial, anonymous denial, cross-workspace isolation, one-active-run enforcement, completion rollback, repeat-run idempotency, exact matching, null score, evidence projection, and immutable health events. The first acceptance attempt also exposed Supabase default table privileges; the migration now revokes those before applying its explicit authenticated grants.
- **Limitations:** The migration has only been applied locally. No hosted migration, live model call, or billable search occurred.
- **Next:** Connect the operator page and server action, then verify responsive and keyboard behavior without enabling the live agent.

## 2026-09-24 — Connect Sources operations and unassessed gallery evidence

- **Objective:** Give authenticated workspace members a readable configuration/history page and owners/operators a single guarded manual-run path.
- **Affected:** `app/sources/*`, `components/source-actions.tsx`, `lib/data/discovery.ts`, discovery/domain data mapping, dashboard UI, navigation, and `app/globals.css`.
- **Decisions:** Multiple-workspace users must select a workspace explicitly; single-workspace users are redirected to the canonical workspace URL. Setup is deliberate, enablement requires typing `ENABLE`, only one run can be pending, and runtime/key/role/configuration failures disable the action. The Sources page reports estimated cost as an estimate.
- **Outcome:** Added `/sources?workspace=<uuid>`, configuration criteria, enable/pause controls, health, last attempt/success, failure rate, model/limits, recent run telemetry, result provenance, and direct Opportunity links. Dashboard score/confidence are nullable, agent-derived fields are marked inferred/estimated, source evidence is displayed, and unassessed projects never render `0/100`.
- **Verification:** `pnpm test` passed four test files; `pnpm typecheck` and `pnpm lint` passed. Browser and production-build checks remain pending.
- **Limitations:** Automated verification uses a mocked/persisted database path only; the operator-only live OpenAI smoke test remains intentionally unrun.
- **Next:** Run the production build and browser acceptance pass, then update PRD, README, context, and the workflow diagram.

## 2026-09-24 — Verify and document the manual discovery vertical slice

- **Objective:** Complete the approved slice with reproducible database/application checks, responsive browser verification, and aligned canonical documentation.
- **Affected:** discovery runtime and health policy, final migration/RPC behavior, application layout, `PRD.md`, `README.md`, `docs/PROJECT_CONTEXT.md`, the editable Excalidraw workflow and SVG/PNG previews, and this log.
- **Decisions:** Time, cost, and turn-limit aborts persist as `partial` rather than failed runs; cost is checked at agent turn boundaries where accumulated usage is available and again when web search starts; recovery from `failing` still requires three consecutive successful runs but does not override a low citation-acceptance run. Browser verification used a disposable local owner and mocked persisted result; the live agent stayed off.
- **Outcome:** PRD version 1.4 and the workflow now mark manual agent discovery, run telemetry, deterministic query-pack health, atomic Signal/Opportunity persistence, and Unassessed gallery entry as implemented. Source Scout, scheduling, probabilistic resolution, scoring, deep research, persistent review, and delivery remain visibly future. The disposable browser environment and credentials were removed and local Supabase was reset to migrations plus the deliberately empty seed.
- **Verification:** a fresh local reset applied all three migrations; local migration listing showed all three versions; database lint reported no errors; both transactional SQL suites passed and rolled back their fixtures; regenerated Supabase types exactly matched the checked-in file. Final `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. Browser checks passed sign-in/authorization, setup, pending-state duplicate-click protection, explicit `ENABLE` confirmation, disabled runtime gating, health and run telemetry, Opportunity deep link, Unassessed/null-score rendering, inference labels, source excerpt/link, 390px mobile and 1024px tablet layouts, 16px base text, and no horizontal overflow after the tablet header adjustment. No new browser warnings or errors appeared after adding Next.js scroll-behavior metadata.
- **Limitations:** No hosted migration, deployment, scheduled execution, production source, or live/billable OpenAI request was performed. Provider pricing remains an explicitly labeled estimate and a real-key smoke test still requires separate operator authorization.
- **Next:** Build a labeled discovery evaluation set, authorize one controlled live smoke test, and then implement First Assessment plus Gap Analysis before deep research or broader automation.

## 2026-09-24 — Add configurable discovery API base URL

- **Objective:** Allow the server-only discovery runtime to use an environment-configured OpenAI-compatible API root without changing the default endpoint when no override is provided.
- **Affected:** `lib/discovery/runtime-config.ts`, `lib/discovery/runtime.ts`, `.env.example`, runtime configuration tests, `README.md`, and `docs/PROJECT_CONTEXT.md`.
- **Decisions:** Use the standard server-only `OPENAI_BASE_URL`; validate an absolute HTTP(S) URL and reject fragments or embedded credentials; pass a run-scoped `OpenAIProvider` to the Agents SDK instead of changing a process-wide default client. Keep the Responses API selected because the discovery contract requires hosted web search.
- **Outcome:** The runtime now explicitly applies the validated endpoint override and keeps the SDK's default OpenAI endpoint when the variable is blank or absent. Documentation warns that a custom provider must support Responses and hosted web search.
- **Verification:** Implementation checks have not run yet; they are recorded in the next verification unit.
- **Limitations:** No live or billable provider request is authorized, so endpoint compatibility is not established by automated verification.
- **Next:** Run the runtime unit tests and the full local application gate.

## 2026-09-24 — Verify configurable discovery API base URL

- **Objective:** Confirm the endpoint override is type-safe, regression-safe, and does not require a live provider call.
- **Affected:** Discovery runtime configuration and the complete Next.js workspace.
- **Outcome:** The validated `OPENAI_BASE_URL` flows into a run-scoped Agents SDK `OpenAIProvider`; the provider remains on the Responses API and is closed after each run. Unset or blank configuration omits `baseURL` and retains the SDK default.
- **Verification:** `pnpm test` passed all five test files, including default/custom/local/invalid URL cases; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The first typecheck found that the convenience `run()` helper does not accept a per-run provider in SDK 0.18.0; the implementation now uses `Runner({ modelProvider })`, after which typecheck passed.
- **Limitations:** Tests do not call OpenAI or any custom gateway. A configured endpoint must support the Responses API, structured output, and hosted web search used by the discovery agent.
- **Next:** Set `OPENAI_BASE_URL` only when a compatible gateway is required, then perform a separately authorized operator smoke test before relying on that endpoint.

## 2026-09-24 — Install Motion AI Kit for project-local Codex use

- **Objective:** Add Motion's current animation guidance and hosted documentation tooling to this repository without changing global agent configuration.
- **Affected:** `.agents/skills/motion/`, `.codex/config.toml`, and `docs/PROJECT_CONTEXT.md`.
- **Decisions:** Used Motion AI Kit 14.1.0 at project scope and selected its native Codex target. Retained all existing `.codex/skills/yipyip-*` skills; used the hosted `motion` and `motion-plus` endpoints and stored no Motion API key.
- **Outcome:** Installed one Motion skill with its bundled React, Motion, Base UI, Vue, spring, transition, and performance references. Configured both hosted Motion MCP servers for this repository.
- **Verification:** The installer completed successfully; the Motion skill entrypoint and ten installed skill files are present. `.codex/config.toml` contains `https://mcp.motion.dev` and `https://mcp.motion.dev/plus`. `codex mcp list` reports both servers enabled. No application source or dependency changed, so the application gate was not rerun.
- **Limitations:** Motion+ features still require interactive sign-in, and the current Codex task may need to be restarted before newly installed MCP tools and the skill are loaded into its active tool catalog.
- **Next:** Restart or reload the Codex task, then invoke `/motion` or request a Motion animation task; authenticate `motion-plus` only if premium capabilities are needed.

## 2026-09-24 — Add an explicit empty demo workspace

- **Objective:** Let MVP visitors explore the product from a zero-project state without creating an account, loading static lead fixtures, or contacting Supabase.
- **Affected:** `lib/demo-mode.ts`, the dashboard data contract/loader, `app/page.tsx`, the sign-in and dashboard surfaces, demo-mode tests, README, and project context.
- **Decisions:** Use public `/?demo=empty` and `/?demo=sample` routes rather than pretending the visitor has an authenticated demo account. Explicit demo modes short-circuit before Supabase. Signed-out default visits now use the neutral sample-demo state instead of attempting the authenticated dashboard view and showing a misleading database error.
- **Outcome:** The login screen offers empty and sample demos. The empty route renders zero leads, a purposeful empty state, and a link to the sample gallery; it stores nothing and preserves the existing authenticated Supabase/RLS boundary.
- **Verification:** Implementation checks have not run yet; they will be recorded in the next verification unit.
- **Limitations:** Demo workspaces are intentionally read-only and sessionless. They cannot run discovery or persist projects, basket state, or review actions.
- **Next:** Run unit, type, lint, and production-build checks, then browser-test desktop and mobile demo flows.

## 2026-09-24 — Verify the empty and sample demo paths

- **Objective:** Confirm the public MVP demo choices behave clearly without authentication, fixture leakage into the empty state, or a misleading Supabase failure.
- **Affected:** Demo-mode unit coverage and the rendered `/login`, `/?demo=empty`, and `/?demo=sample` experiences.
- **Decisions:** Treat these routes as read-only demo workspaces rather than authenticated accounts. Keep the normal signed-out fallback on sample data, while making the zero-data experience an explicit visitor choice.
- **Outcome:** The sign-in page exposes both demo options. The empty route renders zero lead cards, a purposeful zero-project message, and a link to the sample set; the sample route restores all five representative opportunities. Neither explicit route queries Supabase.
- **Verification:** `pnpm test` passed all six test files; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. Browser verification passed the login links, direct empty state, empty-to-sample navigation, zero-versus-five lead counts, absence of the former Supabase error message, a clean browser console, and a 390px viewport with no horizontal overflow.
- **Limitations:** Demo workspaces remain non-persistent and cannot run authenticated discovery, create accounts, or save projects beyond existing client-session UI state.
- **Next:** Add account creation only when the MVP needs persistent personal workspaces; until then, keep the two public demo choices clearly separate from real authentication.

## 2026-09-24 — Add the browser-local discovery demo foundation

- **Objective:** Turn the empty demo into a safe end-to-end workflow that can be exercised without signup, Supabase records, or an OpenAI request.
- **Affected:** `lib/demo-workflow.ts`, the session-storage hook, `/sources?demo=empty`, dashboard demo hydration, Motion provider/dependency, login entry point, and the shared visual system.
- **Decisions:** Keep the simulation isolated to `sessionStorage`, label it as a simulation, start with no profile and no opportunities, preserve explicit query-pack enablement, create only `discovered`/Unassessed opportunities, deduplicate repeated runs by stable opportunity ID, and provide a complete reset. Do not reuse the authenticated server action or imply that simulated citations are live search results.
- **Outcome:** The demo now supports profile creation, query-pack enable/pause, a staged mock discovery run, run telemetry, three sourced Unassessed opportunities, repeat-run exact matching, gallery/drawer review, and reset. Motion 13.4.2 supplies restrained entry/layout feedback under a global user-reduced-motion policy, while the palette, borders, radii, surfaces, and controls have been softened into a more neutral professional system.
- **Verification:** `pnpm typecheck` passed after the first implementation unit. Unit, lint, build, and browser acceptance checks remain pending.
- **Limitations:** The simulated results are deterministic fixtures and never call the live agent. The state is scoped to one browser tab and intentionally disappears when that tab session ends.
- **Next:** Add pure reducer/idempotency coverage, finish responsive styles, then run the full gate and browser-test the complete demo journey.

## 2026-09-24 — Verify and document the interactive discovery demo

- **Objective:** Prove that an unauthenticated visitor can exercise the meaningful MVP workflow from a truly empty state and that the visual refinement remains readable, accessible, and isolated from live services.
- **Affected:** Demo state/reducer tests, public-route proxy rules, responsive dashboard and Sources UI, Motion transitions, `PRD.md` 1.5, README, project context, and this log.
- **Decisions:** Exempt `/login`, explicit gallery demos, and `/sources?demo=empty` from the Supabase session-refresh proxy; keep all other authenticated routes on the existing refresh path. Raise remaining visible 11px labels to 12px and expose Sources in the mobile dashboard header.
- **Outcome:** The interactive demo completes profile setup, enablement, staged discovery, three sourced Unassessed Opportunities, direct lead review, evidence tabs, basket save, repeat-run exact matching, and full reset. Styling now uses neutral surfaces, soft structural borders, restrained green/teal accents, and functional Motion feedback with reduced-motion support.
- **Verification:** `pnpm test` passed all eight test files; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. Browser acceptance passed desktop and 390px mobile zero-state/setup/run/results/gallery/drawer/sources/basket/reset flows, three-result repeat-run deduplication (`0 created · 3 exact matches`), 12px minimum visible main-content text, no horizontal overflow, and no browser warnings or errors. A final server-log check confirmed `/login`, `/?demo=empty`, and `/sources?demo=empty` completed without the earlier invalid-refresh-token error.
- **Limitations:** The demo is a deterministic product simulation, not a live OpenAI smoke test, and lasts only for the current browser tab. Review decisions beyond the existing session basket remain intentionally non-mutating.
- **Next:** Use this safe workflow for stakeholder validation, then implement First Assessment and Gap Analysis against real `discovered` Opportunities before adding persistent review or deep research.

## 2026-09-24 — Establish the autonomous workflow and worker contract

- **Objective:** Replace the manual query-pack execution contract with a durable, source-approved automation pipeline that can scout sources, monitor them repeatedly, assess Opportunities, research decision-relevant gaps, and route qualified Leads or exceptions.
- **Affected:** `20260924111240_autonomous_lead_workflow.sql`, generated Supabase types, `lib/automation/`, the protected automation route, discovery runtime integration, and new unit tests.
- **Decisions:** Preserve existing coverage-profile identifiers as Lead Strategy storage so historical runs remain attributable; archive the legacy manual query-pack job instead of deleting it; keep source approval as the only normal human gate; use service-only leased stage RPCs with bounded retries; keep external model calls outside transactions; do not activate hosted Cron or call OpenAI during implementation.
- **Outcome:** Added versioned Lead Strategy automation fields, source reputation evidence distinct from health, source approval-to-monitor setup, durable workflow/stage/exception records, atomic stage claiming/completion/failure RPCs, a protected Next.js dispatcher, specialized Source Scout/assessment/gap/research agents, deterministic scoring/routing, exact Signal/Opportunity resolution, and automatic review-ready Lead creation.
- **Verification:** Fresh `pnpm exec supabase db reset --local` passed all four migrations. Supabase types regenerated from the local database. `pnpm test` passed all 11 test files after the first unit; `pnpm typecheck` exposed JSON typing mismatches that are being corrected and is not yet recorded as passing.
- **Limitations:** Hosted Cron remains deliberately unconfigured because deployment URL and Vault secrets are environment-specific. No live OpenAI request ran. The authenticated Source Network UI and browser demo still reflect the legacy manual flow at this point.
- **Next:** Finish the type gate, then replace the Source Network and demo surfaces with Lead Strategy editing, individual source approval, and automatic qualification progress.

## 2026-09-24 — Replace manual discovery UI with the autonomous Source Network

- **Objective:** Make Lead Strategy editing and one-time source approval the only routine setup, then demonstrate automatic monitoring, assessment, focused research, qualification, exception routing, and deduplication without manual assessment controls.
- **Affected:** `/sources`, Source Network data/actions/components, the dashboard's default filters and language, `lib/demo-workflow.ts`, the browser-session workflow demo, responsive styles, and reducer tests.
- **Decisions:** Keep the demo deterministic and isolated to `sessionStorage`; auto-start Source Scout when the strategy is saved; auto-start the complete qualification simulation after the first source approval; show finished qualified leads by default; keep ambiguous results in Needs attention; preserve an explicit operator simulation of the next weekday solely to demonstrate repeat-run idempotency.
- **Outcome:** Coverage Profile and Query Pack concepts no longer appear in the new product UI. The authenticated page now exposes one editable Lead Strategy, individual source proposals with reputation evidence, approved recurring monitors, automation history, and exceptions. The public demo produces two fully assessed Qualified leads and one Needs-attention exception, with no Assess or Run discovery button.
- **Verification:** `pnpm test` passed all 11 test files, including automatic pipeline state and repeat-cycle exact matching. `pnpm typecheck` passed after narrowing database check-constraint fields and preserving selected-workspace narrowing across rendered callbacks.
- **Limitations:** Browser interaction, lint, and production build checks remain pending. Demo evidence remains explicitly simulated and no Supabase or OpenAI request is made by the public demo.
- **Next:** Harden strategy/source authorization and add transactional SQL acceptance tests for source approval, stage claiming, leases, and tenant isolation.

## 2026-09-24 — Harden autonomous scheduling, leases, authorization, and data integrity

- **Objective:** Make recurring source monitoring safely dispatchable and resumable while preserving tenant boundaries, local-time schedules, immutable health provenance, and the legacy discovery regression contract.
- **Affected:** Autonomous migration/RPCs, qualification same-workspace foreign keys, source health events, worker dispatch/health integration, schedule and suppression helpers, generated types, and all three Supabase SQL suites.
- **Decisions:** Use a frequent service-only dispatcher with idempotency keys derived from each scheduled timestamp; calculate the next run at 07:00 in the strategy timezone; convert expired running leases to reclaimable failures; keep external calls outside transactions; suppress only materially unchanged rejected proposals; retain legacy configuration health events that do not belong to a run.
- **Outcome:** Added due Source Scout/monitor dispatch, weekday/DST calculation, job/source next-run advancement, service-only worker grants, lease recovery, stricter owner/operator strategy RLS, same-workspace Assessment/Research/Lead references, source-monitor health evaluation, and one immutable health event per terminal monitor workflow.
- **Verification:** Fresh local Supabase reset passed all four migrations. `supabase/tests/autonomous_lead_workflow.sql` passed strategy roles, source approval, source/job creation, tenant isolation, service-only claims, lease-token rejection, expired-lease reclaim, dispatch deduplication, and spring/autumn Amsterdam DST checks. The existing coverage and manual-discovery SQL suites also passed after updating the obsolete reviewer-edit expectation. Supabase types were regenerated; `pnpm test` and `pnpm typecheck` passed.
- **Limitations:** Hosted Cron and Vault remain deliberately unconfigured. No live source or agent request ran. Production concurrency/load behavior still needs a deployed smoke test.
- **Next:** Align the PRD, diagram, README, context, and repository skills with the autonomous product contract, then run lint/build/database lint and browser acceptance.

## 2026-09-24 — Rebase product documentation and skills on autonomous qualification

- **Objective:** Remove the manual query-pack walkthrough as the primary product story and make the source-approved autonomous workflow the canonical contract for users and future agents.
- **Affected:** `PRD.md` 1.6, README, project context, `.env.example`, Excalidraw/SVG/PNG workflow artifacts and generator, plus source-discovery, assessment, data, frontend, and QA repository skills.
- **Decisions:** Keep Coverage Profile/Query Pack names only when explaining legacy storage/provenance; describe internal Search Plan snapshots instead. Mark code/schema/demo behavior as implemented while keeping hosted Cron activation and live/billable execution visibly pending. Preserve conditional deep research: only decision-relevant unknowns are searched, and unresolved `unknown`/`not_found` values remain valid final evidence.
- **Outcome:** Canonical docs now show Lead Strategy → Source Scout → one-time approval → weekday monitoring → validation/resolution → first assessment → material gap research → final assessment → deterministic qualification/exception routing. The editable Excalidraw and both previews were regenerated, and affected skills encode the same invariants.
- **Verification:** All six repository-local skills passed the bundled `quick_validate.py` validator. The regenerated PNG was inspected and clearly distinguishes verified code, deployment contracts, and future persistent review.
- **Limitations:** Documentation describes the full implemented vertical-slice contract, not proof of live provider quality. Browser and final application checks remain pending.
- **Next:** Run the complete local quality gate and exercise the autonomous browser demo at desktop and mobile widths.

## 2026-09-24 — Complete autonomous workflow verification

- **Objective:** Run the final local application and database gates for the autonomous Lead Strategy, Source Network, conditional research, and automatic qualification slice.
- **Affected:** Complete Next.js application, autonomous migration and SQL acceptance suites, generated Supabase types, and this log.
- **Decisions:** Keep deep research conditional on a Gap Analyst identifying an unknown or weakly supported value that can change qualification, rank, or route. Treat `unknown` and `not_found` as valid bounded Research Agent outcomes and retain them through final assessment. Add an explicit terminal return to `private.next_weekday_at` so PostgreSQL schema lint can prove every function path returns.
- **Outcome:** The autonomous pipeline remains `First Assessor → Gap Analyst → Research Agent when material → Final Assessor → Router`; sufficient evidence skips research, while unresolved material uncertainty routes safely instead of being fabricated. The final schema is clean, all transactional database assertions pass, and generated public-schema types exactly match the checked-in file.
- **Verification:** `pnpm test` passed 11 test files; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. A fresh `pnpm exec supabase db reset --local` applied all four migrations. `pnpm exec supabase db lint --local --level warning` reported no schema errors. `agent_opportunity_discovery.sql`, `intent_based_discovery_coverage.sql`, and `autonomous_lead_workflow.sql` each completed through `psql -v ON_ERROR_STOP=1` and rolled back their fixtures. Local migration listing showed all four versions aligned, and regenerated `--schema public` types matched `lib/supabase/database.types.ts` byte-for-byte after removing CLI status output. `git diff --check` could not run because the workspace's mounted `.git` directory contains no repository metadata. The in-app browser could not complete the final interactive pass because its retained connection-error tab was subsequently blocked by its URL security policy; no alternate browser-policy bypass was attempted.
- **Limitations:** No hosted Cron/Vault configuration, deployed migration, live OpenAI request, or billable search was performed. The final browser journey should be rerun in a fresh browser session even though the same demo path has unit coverage and the production build passes.
- **Next:** Open a fresh browser session and smoke-test `/sources?demo=empty` through strategy save, source approval, conditional research, qualified-lead appearance, exception routing, repeat-cycle deduplication, and the 390px responsive layout; then separately authorize hosted Cron and one controlled live provider smoke test when ready.

## 2026-09-24 — Add live operator and bounded continuation database controls

- **Objective:** Make the autonomous backend safely exercisable on demand before hosted Cron is activated, while closing workflow-versioning, duplicate-active-run, lease-recovery, and exception-research gaps.
- **Affected:** `20260924124107_live_operator_controls.sql` and the local Supabase schema.
- **Decisions:** Keep one stage per worker request; add an owner/operator source-monitor queue action and a service-only workspace-scoped claim rather than exposing the Cron bearer to the browser. Preserve human control over Needs-attention cases by allowing an authorized reviewer to request a new bounded qualification/research workflow. Carry approved sources and jobs onto each new Lead Strategy version while preserving completed workflow provenance on the old version.
- **Outcome:** Added operator-test and review-request triggers, active monitor/qualification uniqueness, explicit research pass identity, current-strategy source relinking, source-monitor queueing, qualification-exception review, service-only workspace claims, and corrected expired-lease retry accounting. The completion RPC can now enqueue another bounded pass of the same stage without colliding with stage history.
- **Verification:** `pnpm exec supabase db reset --local` successfully applied all five migrations to the local Supabase instance.
- **Limitations:** Application routes, live controls, research result validation, generated types, authorization acceptance coverage, and the live provider smoke test are still pending. Hosted Cron/Vault remains untouched.
- **Next:** Implement the authenticated operator endpoint and strict research/citation completion validation, then extend SQL and application tests.

## 2026-09-24 — Connect authenticated live processing and strict research evidence

- **Objective:** Make the durable automation pipeline usable on demand before hosted Cron, and ensure Source Scout and focused Research cannot persist unsupported model output.
- **Affected:** `app/api/automation/run/route.ts`, Source Network actions/components/styles, automation runtime/pipeline/worker, runtime configuration, discovery validation, `server-only` dependency, generated Supabase types, and unit tests.
- **Decisions:** Keep one durable stage per authenticated request and drain at most 40 stages from the operator UI; split worker readiness from hosted-Cron readiness; require a real hosted-search call; build citation allow-lists only from raw search sources or URL-citation annotations; allow two bounded research passes before recording explicit `unknown`; keep Needs-attention human-controlled while allowing reviewers to request a fresh automated qualification/research cycle.
- **Outcome:** Owners/operators can queue an approved source monitor and process their workspace queue. Reviewers can request missing-information research or dismiss an exception. Source Scout proposals and research findings are rejected when omitted, duplicated, uncited, unexpected, or not grounded in consulted URLs. Runtime telemetry now records queries, consulted URLs, and actual search-call counts.
- **Verification:** `pnpm test` and `pnpm typecheck` passed after the implementation unit. The generated types were refreshed from the local five-migration schema.
- **Limitations:** The local environment still lacked `SUPABASE_SERVICE_ROLE_KEY` and `AUTOMATION_ENABLED`, so the authenticated end-to-end worker was not run from the UI. Hosted Cron remained untouched.
- **Next:** Add workspace onboarding and finish database concurrency/authorization acceptance coverage.

## 2026-09-24 — Complete live-MVP backend controls and local verification

- **Objective:** Close onboarding, strategy-version rollover, retry atomicity, scheduling collision, and local usability gaps for the first live MVP.
- **Affected:** `20260924124107_live_operator_controls.sql`, SQL acceptance coverage, workspace onboarding UI/action, README, PRD 1.7, project context, and this log.
- **Decisions:** Create a workspace and its owner membership atomically through one authenticated security-definer RPC; preserve approved sources across Lead Strategy versions but detach the old proposal FK; cancel only superseded queued work while preserving running/completed provenance; represent expired leases as failed history plus a new incremented retry row; treat a scheduled/operator uniqueness collision as already covered rather than aborting dispatch; retry failed workflows through an atomic RPC that preserves the failed stage input.
- **Outcome:** A newly authenticated user can create the first private workspace, publish a Lead Strategy, approve proposed sources once, queue live monitoring, process durable stages, request bounded exception research, and inspect telemetry. Active source-scout, source-monitor, and qualification workflows are uniqueness-protected. The interactive worker needs only worker credentials; Cron-only secrets no longer block local execution.
- **Verification:** Fresh local reset applied all five migrations. Database lint reported no schema errors. All three transactional SQL suites completed with `ON_ERROR_STOP=1`; the autonomous suite now covers workspace onboarding, strategy carry-forward, superseded-work cancellation, role denial, idempotent operator queueing, reviewer research requests, lease-token enforcement, failed-history retry rows, dispatch deduplication, and DST scheduling. `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed before the final provider compatibility adjustment. The public Source Network demo rendered with no browser warnings/errors and no horizontal overflow. A disposable local Auth user used for setup verification was deleted afterward.
- **Limitations:** The configured custom `OPENAI_BASE_URL` accepts Responses calls but did not emit a verifiable hosted web-search call, including through the runtime's modern-to-preview compatibility fallback. Every smoke attempt was rejected before persistence; therefore live provider execution is **not verified**. The local `.env.local` also still requires `SUPABASE_SERVICE_ROLE_KEY` and `AUTOMATION_ENABLED=true` for the authenticated operator runner. No hosted Cron, Vault, deployment, source approval, or outreach action occurred.
- **Next:** Clear `OPENAI_BASE_URL` to use OpenAI directly or select a gateway with verified hosted-search/citation support, add the local service-role key and feature flag, create an Auth user, and run one end-to-end Source Scout cycle before approving any proposed source.

## 2026-09-24 — Reverify the application after hosted-search compatibility hardening

- **Objective:** Confirm the application remains release-clean after tightening search-call evidence and adding the modern-to-preview hosted-search compatibility fallback.
- **Affected:** Complete Next.js application, automation unit tests, TypeScript contracts, lint surface, production route bundle, and this log.
- **Decisions:** Preserve the mandatory-search safety gate: a provider response is rejected unless the runtime can observe a hosted web-search call and validate evidence URLs from returned search sources or URL citations. Do not weaken provenance checks to accommodate an incompatible gateway.
- **Outcome:** The local application and autonomous worker compile cleanly with the final provider compatibility behavior. The operator and protected automation routes are present in the production build.
- **Verification:** `pnpm test` passed all 11 test files; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The production build generated `/api/automation/run`, `/api/internal/automation/tick`, `/sources`, `/login`, and the lead gallery routes successfully. No live provider request ran during this verification unit.
- **Limitations:** A true live end-to-end cycle still requires `SUPABASE_SERVICE_ROLE_KEY`, `AUTOMATION_ENABLED=true`, and an OpenAI-compatible endpoint that actually performs and reports hosted web search. The previously configured custom base URL did not satisfy that contract and was rejected before persistence.
- **Next:** Configure the three worker requirements, create a local Auth user and workspace, then run one Source Scout cycle through Source Network with a strict cost limit before approving a source.

## 2026-09-24 — Make live agent execution visible and trustworthy

- **Objective:** Remove ambiguity after **Process live queue** is clicked so operators can tell whether work is queued, being claimed, actively searching, processing locally, complete, failed, or recoverable.
- **Affected:** authenticated automation status GET, operator runner, Source Network server data, stage-presentation helper and tests, responsive styles, README, project context, and this log.
- **Decisions:** Poll the durable database stage instead of presenting a cosmetic spinner as proof of activity; label web search active only when a leased search stage is confirmed running; keep the runner sticky while operators inspect the page; expose elapsed time, completed and queued counts, attempt/pass information, and expired-lease recovery. Use transform/opacity-only restrained Motion and preserve reduced-motion behavior.
- **Outcome:** The page now server-renders its initial queue state and refreshes the current stage every 1.25 seconds while work is active. Friendly descriptions cover Source Scout, monitoring, normalization, resolution, assessment, gap analysis, conditional research, final assessment, and routing. Recent server-rendered activity refreshes after every completed stage, and failure text remains visible instead of silently returning to idle.
- **Verification:** `pnpm test` passed all 12 test files, including the new stage-label/search-state and elapsed-time tests. `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The Source Network remained free of horizontal overflow at a 390px browser viewport and produced no browser warnings or errors. No OpenAI call was made.
- **Limitations:** The authenticated running-state animation was not exercised in the isolated in-app browser because that browser had no signed-in workspace session. The status contract, RLS-readable source tables, production compilation, pure mappings, and public responsive shell were verified locally; the operator should confirm the running transition during the next authorized live Source Scout test.
- **Next:** Reload the authenticated Source Network, click **Process live queue**, and confirm the sticky panel moves from claiming to **Web search active**, displays elapsed time, and ends with a clear success or provider error.

## 2026-09-24 — Diagnose zero Source Scout proposals in the live workspace

- **Objective:** Determine why a configured, authenticated Source Scout run created no source candidates.
- **Affected:** Local automation workflow/stage telemetry and non-sensitive environment-presence checks; no application, schema, configuration, or hosted data changes.
- **Decisions:** Treat the durable stage record as authoritative and preserve the required hosted-search/citation gate rather than accepting uncited model output. Do not retry billable calls or alter `.env.local` during diagnosis.
- **Outcome:** The current Source Scout workflow has a retry queued, but its first attempt received a transient provider `429` while the configured model was starting. Earlier attempts reached the configured custom Responses endpoint but completed without the required `web_search_call`, so validation rejected them. The database correctly contains zero source candidates and zero approved sources.
- **Verification:** Read-only local Postgres queries inspected the latest three workflows and eight stage attempts. Required worker environment variables were present. Official OpenAI documentation confirms a successful Responses web-search result includes a `web_search_call` output item and URL-citation annotations.
- **Limitations:** The configured custom provider has not demonstrated compatible hosted web search. Retrying it after warm-up may clear the `429`, but it does not resolve the earlier missing-search-call incompatibility. No provider call was made during diagnosis.
- **Next:** Use an OpenAI API key with the default OpenAI endpoint and a web-search-capable Responses model, restart the Next.js server, then process the already queued retry; alternatively implement a separate external search-provider adapter before continuing to use a model-only custom endpoint.

## 2026-09-24 — Fix strict-output rejection and surface retry failures

- **Objective:** Make the live Source Scout compatible with OpenAI strict structured outputs and show operators why a queued run has not produced source proposals.
- **Affected:** Source Scout, source-monitor, and research output contracts; durable operator status endpoint/server data; live runner; operator presentation tests; project context; and this log.
- **Decisions:** Represent agent-returned URLs as bounded strings because the provider rejects JSON Schema `format: "uri"`; retain all HTTPS, canonicalization, citation allow-list, and same-source-host enforcement in deterministic application validation. Surface the newest unrecovered stage failure even while its workflow is re-queued, and stop the operator loop at a failed attempt rather than calling the delayed retry a clear queue.
- **Outcome:** The strict schemas no longer emit the rejected URI format. The Source Network now displays the persisted provider error, attempt number, queued count, and Amsterdam-local retry time after a failure. The worker response also returns the non-sensitive stored failure reason to the authenticated owner/operator immediately. The project-local API model setting was restored to the documented pinned model without changing credentials.
- **Verification:** Read-only local Postgres inspection found the current `source_scout` attempt failed with an OpenAI 400 strict-schema error on `baseUrl`, followed by an automatic delayed retry. A schema regression test confirms neither search-agent output schema emits `format: "uri"`; invalid/non-HTTPS values remain rejected by deterministic validation. `pnpm test` passed all 13 test files; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The production build includes the authenticated automation and Source Network routes. The isolated in-app browser reached the sign-in boundary but had no authenticated workspace session, so the final signed-in visual state remains an operator check.
- **Limitations:** No additional billable provider request was made. A successful live Source Scout result still depends on reloading/restarting the running Next.js process so it reads the corrected environment and code, then processing the queued retry from an authenticated workspace.
- **Next:** Restart or reload the local app, refresh Source Network, process the queued retry once, and confirm either proposals appear or the new failure panel shows the exact next provider/runtime issue.

## 2026-09-24 — Expose server diagnostics and harden incomplete Responses handling

- **Objective:** Explain and correct why live provider failures were durable in Supabase and visible in the UI but absent from the Next.js terminal, then reduce avoidable `response.incomplete` results.
- **Affected:** Automation diagnostics, worker and operator route logging, agent token settings, discovery limits/instructions, tests, README, project context, and this log.
- **Decisions:** Keep the durable catch-and-retry boundary, but explicitly emit credential-redacted structured events to server stdout/stderr. Classify provider incomplete, failed, schema, rate-limit, timeout, and authentication failures without logging prompts, evidence, secrets, or stack traces. Raise the provider output ceiling from 1,200 to 4,000 because Responses counts hidden reasoning inside `max_output_tokens`, while retaining an approximately 1,200-token final JSON target and the existing monetary envelope.
- **Outcome:** A live stage now prints `[automation]` `stage.started`, `stage.completed`, or `stage.failed` JSON to the terminal running Next.js. `response.incomplete` is stored and displayed with `provider_incomplete`, while bounded database retry behavior remains unchanged. The active configuration uses the official OpenAI endpoint and pinned `gpt-5.4-mini-2026-03-17` model.
- **Verification:** Read-only stage history confirmed attempt 2 ended in `response.incomplete` and attempt 3 is queued. Official OpenAI documentation lists `max_output_tokens`, `max_messages`, `content_filter`, and `steered` as incomplete reasons; the Agents SDK documents unsuccessful terminal states as `ModelBehaviorError` and unsafe to replay automatically. `pnpm test` passed all 14 test files, including classification, redaction, and stderr-emission coverage; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed, and the sanitized environment check confirmed `api.openai.com`, the pinned model, and automation enabled. No billable retry was issued during this work.
- **Limitations:** The current non-streaming Agents SDK error does not expose the original `incomplete_details.reason`, so the durable message can identify `response.incomplete` but not distinguish its four provider reasons. Terminal lines appear only in the actual process running `pnpm dev` or `pnpm start`, not in the browser console or an unrelated IDE terminal.
- **Next:** Restart the Next.js process, wait until the queued retry is runnable, click **Process live queue**, and inspect the same terminal for `[automation]` lines while Source Network mirrors the durable result.

## 2026-09-24 — Correct the empty Source Scout approval state

- **Objective:** Explain why Source Network said it was waiting for approval while showing an empty inbox, then correct both the missing proposal evidence and the false terminal state.
- **Affected:** Automation agent runtime, Source Scout persistence and completion semantics, live operator feedback, Source Network empty-state telemetry, pipeline tests, local Supabase migration `20260924154613_correct_empty_source_scout_state.sql`, README, and project context.
- **Decisions:** Keep the deterministic citation allow-list strict; request `web_search_call.action.sources` from the Responses API rather than trusting model-returned URLs. Enter `waiting_approval` only when at least one validated proposal is actually persisted. Treat a valid zero-reviewable result as successful and retain generated, evidence-rejected, suppressed, and reviewable counts for operator explanation.
- **Outcome:** New Source Scout calls can collect the consulted source URLs needed by citation validation. Zero-proposal runs now finish as `succeeded / no_reviewable_proposals`, the operator runner stops with a specific empty-result message, and the approval inbox explains the latest result. The migration repaired all three historical local workflows that had `proposalCount: 0` but were incorrectly marked `waiting_approval`.
- **Verification:** `pnpm test` passed all 14 test files, including the new Source Scout terminal-state regression. `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. The migration applied through `pnpm exec supabase migration up --local`; `pnpm exec supabase db lint --local --level warning` reported no schema errors. A direct read-only Postgres query confirmed the three affected workflows now have `status = succeeded` and `stop_reason = no_reviewable_proposals`.
- **Limitations:** Previously discarded agent proposals cannot be reconstructed because complete provider output is intentionally not retained. No new billable Source Scout call was issued, so proposal creation with the corrected source inclusion still requires one controlled live rerun after restarting the Next.js process.
- **Next:** Restart the app, save a new Lead Strategy version to queue a fresh Source Scout, process the live queue once, and confirm cited source cards appear or an explicit validated zero result is shown.

## 2026-09-24 — Diagnose the first live Source Monitor timeout

- **Objective:** Determine whether the reported `source_monitor` abort represented a provider failure, worker bug, or expected bounded retry.
- **Affected:** Read-only local automation workflow, stage, approved-source, and discovery-job telemetry; official OpenAI web-search/background guidance; project context.
- **Decisions:** Do not issue another billable request or change the timeout after one transient latency failure. Treat the durable database record as authoritative and preserve the bounded retry policy.
- **Outcome:** Attempt 1 started at 15:54:55 UTC and failed at 15:55:56 UTC when YipYip's explicit 60-second `AbortController` fired. The workflow remains queued, and attempt 2 became runnable at 15:57:56 UTC. The approved source is Officiële bekendmakingen / Gemeentebladen; no provider usage or cost was returned before cancellation.
- **Verification:** A direct read-only Postgres query confirmed the failed attempt, `timeout` error code, empty usage, queued attempt 2, and unchanged €0 workflow estimate. Current code confirms a 60-second discovery abort, 60-second route duration declaration, and 90-second database lease. Official OpenAI documentation notes that agentic web search can take longer and recommends Responses background mode for long-running multi-search tasks.
- **Limitations:** One timeout does not establish that every request will exceed the limit. Foreground retry attempt 2 has not been executed, and background-mode persistence/polling is not implemented.
- **Next:** Process attempt 2 once. If it also times out, stop retrying and implement a coordinated timeout/route/lease increase or a resumable background Responses stage before further live tests.

## 2026-09-24 — Increase the coordinated live-agent timeout

- **Objective:** Prevent approved-source monitoring from failing repeatedly at the former 60-second foreground boundary while keeping execution bounded and lease-safe.
- **Affected:** Automation runtime configuration, Source Scout and Source Monitor abort handling, durable stage claims, authenticated and Cron route duration declarations, environment examples, runtime tests, README, and project context.
- **Decisions:** Default live agent stages to 150 seconds, allow a server-only override from 30 through 240 seconds, and derive the database lease as the agent deadline plus 30 seconds. Declare a 300-second route ceiling for provider work plus persistence/cleanup. Keep Responses background mode as the future path for tasks that genuinely need several minutes.
- **Outcome:** `AUTOMATION_AGENT_TIMEOUT_SECONDS` now controls both search runtimes, defaults to 150, and fails readiness on invalid values. Stage claims receive a 180-second default lease, both automation routes advertise 300 seconds, and aborts now preserve an explicit deadline message instead of the generic `Request was aborted` text.
- **Verification:** `pnpm test` passed all 14 test files, including lower/upper timeout bounds and lease derivation. `pnpm lint` and `pnpm build` passed. An initially parallel `pnpm typecheck` collided with the production build rewriting `.next/types` and failed on a transient missing generated `routes.js`; the required sequential rerun passed after the build completed.
- **Limitations:** No billable retry was issued. Deployment platforms may impose a plan-specific ceiling lower than the declared 300 seconds; longer multi-search work should move to durable Responses background polling.
- **Next:** Restart `pnpm dev`, process the queued monitor retry once, and verify its running stage has a lease approximately 180 seconds ahead and completes within the new deadline.

## 2026-09-24 — Correct the Research Agent strict-output schema

- **Objective:** Fix the live Research stage's provider rejection while preserving citation validation, explicit unknowns, and automatic final reassessment.
- **Affected:** Research output contract, historical ResearchFinding normalization in the worker, agent-contract regression tests, project context, and this log.
- **Decisions:** Replace unconstrained `z.unknown().nullable()` with a bounded nullable string. Qualification gaps such as budget, timing, contact, scope, and route can be represented concisely as text, and OpenAI requires every nested `anyOf` branch to be a valid typed schema. Preserve existing JSON-valued database rows by serializing them to bounded text only when supplying the final assessor. Classify provider-schema and authentication errors as non-retryable because replaying identical code cannot repair them.
- **Outcome:** The emitted Research schema now contains explicit `string` and `null` branches, so the provider can accept it. The failed attempt persisted no finding and its already-queued attempt 2 can reuse the corrected contract after the app restarts. Future schema failures stop immediately instead of consuming repeated vendor calls.
- **Verification:** Read-only local Postgres inspection confirmed the Research workflow remains queued, attempt 1 failed with `provider_schema`, and attempt 2 was scheduled without partial ResearchFinding persistence. `pnpm test` passed all 14 test files, including an assertion over the exact generated `value.anyOf` types. `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed.
- **Limitations:** No billable retry was issued. The provider has not yet accepted the corrected schema in a live call, and the complete qualification path still needs to finish through final assessment and routing.
- **Next:** Restart `pnpm dev`, process the existing queued Research retry, and confirm the terminal shows `stage.completed` before the workflow advances to final assessment.

## 2026-09-24 — Begin commercial-fit calibration and persistent Lead review

- **Objective:** Recalibrate qualification around YipYip's €30k minimum and €50k–€100k preferred project range, add attributable persistent Lead decisions, and finish with one explicitly authorized local live smoke test bounded by a €1 configured envelope.
- **Affected:** Scoring and assessment contracts, Lead Strategy, autonomous worker, Supabase review/versioning contract, lead drawer and basket review flow, tests, and canonical documentation.
- **Decisions:** Treat total procurement value separately from YipYip-addressable scope; large opportunities remain eligible but unresolved commercial scope becomes a human exception. Preserve historical Assessments and Lead versions. Keep the basket session-only while persisting authoritative review decisions. Do not enable hosted Cron or outreach.
- **Outcome:** Implementation started after checking the current policy, worker, review schema, RLS model, application data path, current Supabase guidance, and repository assessment/frontend/data/QA skills.
- **Verification:** No implementation checks have run yet. The local Supabase stack is running; required interactive-worker secrets are present without recording their values. The workspace contains an empty `.git` directory rather than usable repository metadata, so Git diff/status cannot be used as a change-safety check.
- **Limitations:** The authorized billable smoke test will not run until all non-billable application and database checks pass.
- **Next:** Implement and unit-test the versioned commercial-fit policy and structured evidence gate before changing review persistence.

## 2026-09-25 — Implement commercial-fit policy and evidence gates

- **Objective:** Prevent technical strength from hiding unsupported, undersized, or operationally unclear commercial fit.
- **Affected:** `lib/scoring.ts`, assessment agent contract/prompts, deterministic qualification pipeline, worker persistence, Lead Strategy form/action/data mapping, scoring/pipeline tests, and policy migrations.
- **Decisions:** Publish base policy `2026-09-24.2` with 12/16/16/13/10/16/10/7 percent weights. Apply a €30k floor, €50k–€100k maximum-fit range, gradual decline above €100k, and €250k review boundary. Require Budget and Delivery at 6/10 and 0.65 confidence. Keep total procurement and YipYip-addressable value separate; downgrade unsupported commercial claims to unknown. Persist an immutable strategy-specific policy version so each Assessment points to the exact thresholds the worker used.
- **Outcome:** Initial unknowns trigger focused gap research; bounded final unknowns enter Needs attention. A confirmed sub-€30k addressable scope is rejected. A €7m total with no bounded YipYip package cannot qualify, while a cited €75k package may. Overview and Evaluation use the same persisted commercial snapshot.
- **Verification:** Commercial boundary/routing tests pass for €29,999, €30k, €50k, €100k, €100k+, €250k+, proxy/unknown states, and total-versus-addressable scope. `pnpm test` ultimately passed all 14 files; database verification is recorded below.
- **Limitations:** The policy is an MVP hypothesis and has not yet been calibrated against a labeled YipYip benchmark set.
- **Next:** Measure false positives/negatives and review volume before changing the immutable base policy.

## 2026-09-25 — Implement persistent Lead review and sequential versions

- **Objective:** Add attributable Pursue, Pass, Request research, and route-change actions without rewriting Assessment evidence.
- **Affected:** Lead/review schema and RPCs, grants/RLS, generated types, dashboard view/data loader, Review tab, basket sequencing, browser demo reducer, responsive styles, and SQL acceptance tests.
- **Decisions:** Route all ordinary Lead decisions through one atomic `review_lead` RPC. Lock and verify the current Lead version, enforce workspace roles, stable reason codes, Other-note requirements, idempotency, and one active research workflow. Allocate Lead versions monotonically per Opportunity through a service-only function. Keep the basket session-only and demo review state in `sessionStorage`.
- **Outcome:** Owners/reviewers can pursue, pass, and change route; owners/operators/reviewers can request a fresh bounded workflow beginning at First Assessment; viewers are read-only. Review events are immutable and history is batched into the artifact drawer. Direct authenticated Lead inserts/updates are revoked.
- **Verification:** The rollback-only autonomous SQL suite passed sequential versions, idempotent replay, stale-version rejection, direct-write denial, reviewer actions, viewer/cross-workspace denial, and a single active research workflow. Its first run exposed an ambiguous replay-column bug; migrations `20260924193400` and the canonical function fixed it before the passing rerun.
- **Limitations:** Reviewer field correction and entity merge/split UI remain future; Request research can validly end unknown.
- **Next:** Use review feedback and stable reasons as evaluation data, without treating sparse feedback as automatic training.

## 2026-09-25 — Update product contract and workflow artifacts

- **Objective:** Make the PRD, workflow diagram, repository context, README, and skills match the implemented commercial/review behavior.
- **Affected:** `PRD.md` v1.8, README, project context, assessment/frontend/QA skills, workflow generator, editable Excalidraw, SVG, and PNG preview.
- **Decisions:** Mark persistent review and commercial-fit snapshots implemented while leaving field correction, export, CRM, outreach, and hosted Cron future. Keep Source Scout approval as the only routine human gate before monitoring.
- **Outcome:** The diagram now includes the Review tab and atomic version-checked Pursue/Pass/Research/Route history path; the durable data plane names commercial snapshots, versioned Leads, and review events.
- **Verification:** The generator recreated the Excalidraw and SVG; ImageMagick rendered a 1920×1260 PNG, which was visually inspected for readable labels and complete arrows.
- **Limitations:** The PNG renderer emitted only an ImageMagick deprecation warning; the output itself is valid RGBA PNG.
- **Next:** Keep the generated previews synchronized through `scripts/generate-yipyip-workflow.mjs` for future workflow changes.

## 2026-09-25 — Complete non-billable release gate

- **Objective:** Verify application, migration, authorization, browser behavior, and generated contracts before any vendor call.
- **Affected:** Entire application gate, fresh local Supabase schema, three SQL suites, generated types, and isolated headless-browser demo.
- **Decisions:** Preserve current local workspace data before the required reset while excluding sessions and refresh tokens. Restore only the user/identity records and public workspace data; the operator must sign in again if using the browser account. Run browser checks against an isolated production server with reduced motion and a 390px viewport.
- **Outcome:** Fresh reset applied all nine migrations and restored the pre-existing local workspace/source/Lead data. The browser demo completed strategy → source approval → automatic qualification → Review/Pursue, retained one history event after reload, and kept the full-screen mobile drawer within 390px with 44px action targets and no horizontal overflow.
- **Verification:** `pnpm test` passed 14/14; `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed. Fresh `supabase db reset --local`, migration listing, public-schema lint, all three rollback-only SQL suites, and regenerated-type byte comparison passed. The final headless browser result reported selected Review tab, open modal, success announcement, approved session state, one stored history event, reload persistence, reduced motion, no overflow, and 390px drawer width.
- **Limitations:** Browser auth sessions were intentionally not restored; live review persistence was verified at the RPC/database boundary and demo review was verified in Chrome.
- **Next:** Run exactly one approved-source monitor with the authorized downward-only limits.

## 2026-09-25 — Run controlled local live smoke test

- **Objective:** Exercise one real approved-source monitor within the authorized €1 combined configured envelope, then verify persistent review behavior without enabling Cron.
- **Affected:** Local workspace `b949b495-65d3-4e41-b97b-a893a1d26671`, approved source `cd422d79-03e2-4a38-b7e1-400ac2c3ee05`, workflow `1ed98f14-098e-45a9-a411-e42ebafe1f8d`, and existing qualified Lead `e85f3193-9b9e-49ad-9a0c-0e3b5b11ad7f`.
- **Decisions:** Limit the monitor to one candidate and €0.25; retain the built-in €0.75 qualification envelope only if a valid candidate reaches that workflow. Accept a valid zero-result run and do not issue another vendor stage. Use the existing qualified Opportunity’s current in-review Lead for the planned fallback Pursue persistence check.
- **Outcome:** Source Monitor succeeded in 15.895 seconds with one hosted-search call, 25,834 input tokens, 1,494 output tokens, and estimated cost €0.076098. Normalize rejected the sole candidate for `uncited_url` and `outside_lookback`; Resolve completed with zero accepted Opportunities. No qualification workflow or second vendor request ran. The fallback Pursue action created immutable event `773251b9-546b-43db-8f2b-d4f26d982a94`, changed Lead status to approved, and persisted the local-smoke note across a separate read.
- **Verification:** Search Plan snapshot recorded result limit 1 and cost limit €0.25. Workflow status is `succeeded/completed`, cost €0.076098, and stage outcomes are Source Monitor Passed, Normalize Passed with zero accepted, Resolve Passed with zero created/matched, Qualification/Research Not run, persistent Lead review Passed. Counts changed from 13→14 workflows and 0→1 review events; Opportunities and Leads remained 1; cumulative historical estimate changed from €1.042221 to €1.118319. No cost overrun, Cron activation, outreach, or production mutation occurred.
- **Limitations:** This run did not exercise live commercial assessment because the candidate was stale and its canonical HTML URL was not identical to the provider-cited source variant. The strict rejection is correct under the current policy but reveals a calibration question for official PDF/HTML aliases.
- **Next:** Build a labeled official-publication fixture and decide deterministic same-publication URL equivalence before another bounded live run; then target one recent candidate that can reach First Assessment and commercial routing.

## 2026-09-25 — Correct the Next.js Server Action export boundary

- **Objective:** Fix the development runtime error reporting that a `"use server"` file exported a non-async object.
- **Affected:** `app/actions/lead-review.ts`, `lib/lead-review-action-state.ts`, and the dashboard import boundary.
- **Decisions:** Keep the mutation in a dedicated `"use server"` module whose only export is the async Server Action. Move the serializable `useActionState` initial value and its TypeScript contract into a framework-neutral shared module that both the action and client dashboard may import.
- **Outcome:** Next.js no longer interprets `initialLeadReviewActionState` as an invalid Server Function, while the review form's state shape and behavior remain unchanged.
- **Verification:** `pnpm test` passed all 14 test files; `pnpm typecheck`, `pnpm lint`, and the Next.js 16.2.9 Turbopack `pnpm build` passed.
- **Limitations:** A currently running development process may need one restart if Turbopack retained the pre-fix module graph.
- **Next:** Reload the lead drawer and submit a review action; restart `pnpm dev` only if the old overlay remains cached.

## 2026-09-25 — Stabilize Lead review completion and empty-gallery motion

- **Objective:** Remove the fatal React update loop after Pursue and smooth the empty-result card when changing gallery filters.
- **Affected:** `components/dashboard.tsx`, shared Lead review action state, Server Action response metadata, Motion presence/layout wiring, and Lead review regression tests.
- **Decisions:** Give each successful Server Action response a stable request identity and consume it once in the Review panel. Pass the parent's memoized completion callback directly instead of recreating it inline, return the existing basket array when no removal is needed, and keep navigation side effects outside React state updater functions. Place the empty state inside the same `AnimatePresence` as cards and forward the article DOM ref required by `popLayout`.
- **Outcome:** Pursue/Pass/Request research completion can update basket and sequential-review state once without retriggering itself. Populated-to-empty filter changes now have one coordinated exit/entry transition rather than an independently mounted empty card competing with exiting cards.
- **Verification:** `pnpm test` passed all 15 test files, including stable review-result consumption and referentially stable queue removal. `pnpm typecheck`, `pnpm lint`, and the Next.js 16.2.9 Turbopack `pnpm build` passed. The in-app browser could initially reach the local server only through its network address; a subsequent reload was denied by browser URL policy, so no post-fix interactive browser result is claimed.
- **Limitations:** Final visual confirmation in the user's ordinary localhost browser remains appropriate because the isolated browser policy prevented completing the interaction pass.
- **Next:** Reload `localhost:3000`, switch Qualified leads → Monitoring → All activity, then open a Lead's Review tab and select Pursue once; confirm the drawer advances/closes once with no console error.

## 2026-09-25 — Enforce autonomous contact-route research and add the review workspace

- **Objective:** Remove routine human contact research from qualification and give users a dedicated place to track saved and reviewed projects.
- **Affected:** Deterministic gap/routing policy, assessor and researcher prompts, worker stage orchestration, dashboard contact projection, session basket storage, `/reviewed`, navigation, responsive styles, and pure regression tests.
- **Decisions:** Define a qualification-ready contact as an evidence-backed named person, responsible team, procurement desk, or official tender channel. Application code injects this high-impact question even when Gap Analyst omits it. A citation-valid supported answer may qualify; bounded unknown or unsupported output becomes `contact_route_unresolved` in Needs attention. Keep existing Assessments historical. Persist authoritative review status/events in Supabase while keeping the shortlist itself in scoped `sessionStorage`.
- **Outcome:** New qualification workflows automatically research commercial access before final routing. Accepted research findings can replace the dashboard's inferred contact hint and expose their supporting URL. “Review saved leads” now navigates to a dedicated pursuit workspace grouping projects into working on, research running, awaiting decision, and passed.
- **Verification:** Implementation unit completed; checks have not run yet.
- **Limitations:** Historical qualified Leads are not silently rescored. They can be explicitly re-evaluated through Request research. The new review page relies on the existing Lead and immutable review-event contracts and therefore requires no schema mutation.
- **Next:** Resolve TypeScript/lint feedback, run focused tests, verify the authenticated Supabase projection, then complete browser and full application gates.
