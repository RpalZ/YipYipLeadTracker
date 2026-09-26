---
name: yipyip-qa-reliability
description: Test, review, or report YipYip PRD acceptance, evaluation quality, accessibility, observability, idempotency, retries, privacy, cost controls, and release readiness. Use for YipYip QA or production-readiness work.
---

# YipYip QA and Reliability

Provide independent evidence about product behavior and release risk.

## Build the test surface

Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, the relevant PRD acceptance criteria, changed code, migrations, and existing tests. Derive checks from user-visible outcomes and product invariants rather than implementation wording.

Cover layers proportionate to the change:

- source checkpoints, independent failure, duplicate prevention, and reversible entity resolution;
- editable Lead Strategy, automatic Source Scout queueing, one-time approval, rejected-proposal suppression, weekday/DST scheduling, leases, concurrent dispatch, and exception routing;
- scoring versions, hard rules, confidence gating, research-potential gating, focused bundle order, one diversified unknown continuation, corroboration, consulted-versus-cited provenance, and stop limits;
- commercial-fit boundaries, total-versus-addressable value, immutable score snapshots, Lead version sequencing, stale review rejection, review idempotency, stable reason codes, and role-scoped research requests;
- manual-promotion role denial, latest-Assessment locking, hard-sector/actionability blocks, immutable attribution, retry idempotency, unchanged automated routing, visible origin/caveats, and demo/live isolation;
- distinct Opportunity Resolve versus Lead Decision language and actions; exception research/pass atomicity, role denial, idempotent replay, lifecycle routing, visible pending state, and immutable Opportunity-level history;
- final `qualify`-only routing, every hard/sensitive sector, either-fit-axis rules, capability/actionability/capacity gates and expiry, whole-procurement scope rejection, outreach length/provenance, Lead-creation guards, and idempotent historical quarantine;
- RLS, grants, workspace isolation, atomic transitions, and idempotent Lead delivery;
- lead review readability, source inspection, responsive layout, keyboard access, focus behavior, contrast, and screen-reader labels;
- stage latency, errors, retries, costs, stop reasons, evaluation regressions, privacy, retention, and environment contracts.
- a mocked end-to-end path from approved source through Signal, Opportunity, initial/final Assessments, bounded Research, qualification checks, evidence-grounded outreach, and qualified Lead, proving that no routine Assess click is required;
- programme-only source results remaining Signals, proven poor fit rejecting, exhausted promising unknowns monitoring, and conflicting/sensitive evidence becoming exceptions;

Classify checks as Passed, Failed, Not run, or Blocked with exact commands or observations. Separate defects from known limitations. Do not run billable vendors, mutate hosted data, deploy, or enable source adapters solely to finish a checklist.
