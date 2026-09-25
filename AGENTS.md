# YipYip Repository Instructions

These instructions apply to the entire repository.

## Establish context before material work

1. Read `PRD.md`, `README.md`, and `docs/PROJECT_CONTEXT.md` completely.
2. Read the most recent entries in `docs/IMPLEMENTATION_LOG.md` that relate to the request.
3. Inspect the affected implementation, tests, migrations, and package manifest before relying on a documented claim.
4. Load the smallest relevant repository skill from `.codex/skills/` and any required current vendor documentation.

Prefer truth in this order: current code and migrations, current executable checks, maintained project context, then conversation history. Distinguish implemented, partial, intended, and post-MVP behavior.

## Document meaningful work as it happens

After each meaningful implementation or verification unit, append an entry to `docs/IMPLEMENTATION_LOG.md` with:

- date and objective;
- affected subsystem or files;
- decisions and assumptions;
- outcome and current limitations;
- exact checks run and their results;
- safest next action.

A meaningful unit is a coherent implementation, migration, documentation, or verification step. Do not log every shell command or duplicate tool output.

Update `docs/PROJECT_CONTEXT.md` whenever a material feature, architecture decision, data contract, environment requirement, limitation, or recommended next step changes. Keep it concise and point to `PRD.md` or the implementation log instead of copying them.

Never record secrets, credentials, private source content, or `.env.local` values. Never claim a check passed unless it ran successfully in the current environment.

## Preserve scope and safety

- Preserve user-owned changes and avoid unrelated rewrites.
- A documentation, review, or diagnosis request does not authorize feature implementation or external mutations.
- Do not deploy, push hosted migrations, enable production source adapters, run billable vendor workflows, or send lead data externally without explicit authorization.
- Use source evidence for product claims, retain unknowns, and never invent qualification data.

## Required completion checks

Choose checks proportional to the change. For application changes, the default local gate is:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

For database work, also use the repository Supabase workflow and verify grants, RLS, and affected queries. For interface work, verify keyboard behavior, responsive layouts, focus handling, overflow, and browser console errors.
