---
name: yipyip-data-guardian
description: Design, change, debug, or audit YipYip Supabase schemas, migrations, grants, RLS, functions, generated types, provenance integrity, and workspace isolation. Use for YipYip data or authorization work, not generic database questions.
---

# YipYip Data Guardian

Keep the Opportunity-centered data model secure, attributable, and reconstructable.

## Establish truth

Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, the PRD data schemas and provenance rules, existing migrations, affected query paths, and generated types when present. Load current Supabase and Postgres guidance before database changes.

## Data and authorization invariants

- Preserve Signal, Opportunity, Assessment, ResearchFinding, and Lead boundaries; Leads reference canonical truth rather than duplicating it.
- Scope all workspace data through explicit grants and RLS. Views exposed to application roles must enforce underlying RLS.
- Keep privileged keys and clients server-only and use the narrowest deliberate function privileges.
- Preserve immutable assessment inputs and versions, attributable human corrections, reversible resolution history, and stable idempotency keys.
- Persist qualification checks on each Assessment and outreach on each Lead version. Service-only Lead creation must independently verify a final `qualify` decision, no hard rejection, `allPassed = true`, and a valid outreach object.
- Preserve technical-capability evidence and operator-owned delivery capacity as separate immutable qualification-check fields and exception kinds. Historical relabeling is allowed only when stored final checks unambiguously prove capability passed while capacity did not; never rewrite the Assessment itself.
- Keep manual pursuit separate from service-only automatic Lead creation: require owner/reviewer authorization, an exact latest final Assessment, citation-valid Signal evidence, stable reason, attribution, idempotency, and immutable review event. Preserve the automated Opportunity/Assessment state and block hard-sector or expired-actionability overrides.
- Keep qualification-exception resolution separate from Lead decisions. Opportunity research/pass must atomically lock the open exception, change lifecycle, append an immutable Opportunity-level event, and optionally queue one idempotent qualification workflow; operators may research, but only owners/reviewers may pass.
- Quarantine historical qualification-policy mismatches idempotently by changing only Opportunity routing and appending an exception; preserve Lead status, Assessment, outreach, and review history. A later passing version may resolve the exception.
- Make multi-table state transitions atomic when partial writes would corrupt provenance or workflow state.
- Model automation as resumable workflow/stage records with one active lease, idempotent schedule keys, bounded attempts, and external agent calls outside transactions.
- Serialize Signal revision allocation at the database boundary. Preserve canonical URL provenance separately from logical source-item identity, make unchanged retries return the existing Signal, and keep service-only persistence narrow and workspace-checked.
- Keep service credentials inside the protected worker, ordinary workspace roles out of claim/completion RPCs, and same-workspace composite references across qualification records.
- Retain explicit unknown, contradiction, source, model, prompt, policy, and profile metadata required for audit.
- Preserve the distinction between consulted URLs in research attempt telemetry and cited URLs supporting a finding. Allow citation-free `unknown`/`not_found` rows only when the bounded attempt summary is retained, and represent terminal promising uncertainty with the explicit `monitoring` lifecycle state.

Create imperative migration names through the Supabase CLI, regenerate types after schema changes, and test owner, stranger, anonymous, and privileged access as applicable. Do not reset hosted data, weaken RLS, or push migrations without explicit authorization.
