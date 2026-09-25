---
name: yipyip-context-librarian
description: Maintain accurate YipYip repository context, PRD traceability, implementation logs, decisions, and handoffs. Use when resuming work, documenting progress, explaining current architecture, or updating project status; do not use for unrelated repositories.
---

# YipYip Context Librarian

Keep future work grounded in current repository evidence.

## Establish truth

Read `AGENTS.md`, `PRD.md`, `README.md`, `docs/PROJECT_CONTEXT.md`, and the relevant recent entries in `docs/IMPLEMENTATION_LOG.md`. Inspect affected code, migrations, tests, and package versions before repeating a claim that may have changed.

Prefer current code and executable checks over historical prose. Clearly distinguish implemented, partial, intended, and post-MVP behavior.

## Maintain context

After every meaningful implementation or verification unit, append a concise log entry with objective, affected area, decisions, outcome, limitations, exact checks, and next action. Update `docs/PROJECT_CONTEXT.md` only for material changes to architecture, behavior, data contracts, environment requirements, limitations, or recommended next work.

Keep the context document compact and link to the PRD or log instead of duplicating them. Never record secrets, private source content, or an unrun check as passing. Documentation work does not authorize feature implementation, deployment, or hosted changes.
