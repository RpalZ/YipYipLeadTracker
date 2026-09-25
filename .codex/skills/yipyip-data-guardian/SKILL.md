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
- Make multi-table state transitions atomic when partial writes would corrupt provenance or workflow state.
- Model automation as resumable workflow/stage records with one active lease, idempotent schedule keys, bounded attempts, and external agent calls outside transactions.
- Keep service credentials inside the protected worker, ordinary workspace roles out of claim/completion RPCs, and same-workspace composite references across qualification records.
- Retain explicit unknown, contradiction, source, model, prompt, policy, and profile metadata required for audit.

Create imperative migration names through the Supabase CLI, regenerate types after schema changes, and test owner, stranger, anonymous, and privileged access as applicable. Do not reset hosted data, weaken RLS, or push migrations without explicit authorization.
