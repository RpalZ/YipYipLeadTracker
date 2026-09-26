---
name: yipyip-assessment-research
description: Build, debug, or review YipYip scoring, gap analysis, OpenAI Agents SDK research, web search, structured findings, provenance, bounded continuation, and final reassessment. Do not use for generic AI features.
---

# YipYip Assessment and Research

Turn evidence into explainable qualification without fabricating certainty.

## Ground the work

Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, and the PRD sections on First Assessment, Gap Analysis, Optional Deep Research, Scoring, Provenance, the Two Level Research Loop, and Acceptance Criteria. Inspect the scoring policy, data contracts, and current OpenAI documentation before library-specific changes.

## Preserve assessment and research invariants

- Apply hard exclusions before weighted scoring and record dimension score, confidence, rationale, profile version, policy version, evidence snapshot, model, and prompt version.
- Generate focused questions only for missing, weak, stale, inferred, or conflicting facts that could change a decision. Execute commercial, buyer-access, capability, timing, and other questions as separate bundles of at most three questions.
- Prefer primary sources. Every new researched claim becomes a sourced ResearchFinding; copied Signal facts retain Signal provenance.
- Accept only terminal statuses defined by the PRD. A first semantic unknown or not-found answer on a material question receives one diversified continuation; unknown is complete after the bounded attempt standard.
- Keep consulted search URLs separate from cited claim evidence. One authoritative primary source may confirm a direct fact; strongly inferred claims require at least two allow-listed citations.
- Validate question coverage, provenance, confidence, and explanations outside the agent run.
- Continue only unresolved questions and stop on configured pass, time, tool, cost, exhaustion, or no-progress limits.
- Recalculate final dimensions from the current evidence snapshot rather than adding an opaque research bonus.
- Keep routine qualification autonomous: First Assessment, material Gap Analysis, focused Research, Final Assessment, and routing proceed through durable bounded stages without a user Assess button.
- Let deterministic application code calculate the score and route proven poor fit to rejected, promising but publicly unresolved fit to monitoring, passing cases to qualified, and conflict/risk to exceptions. Missing evidence must not block initial research merely because it depressed the provisional weighted score. Agents cannot qualify their own output.
- Treat total procurement value and the YipYip-addressable package as separate claims. Validate commercial evidence references, apply the active versioned budget curve and Budget/Delivery gates in application code, and send an otherwise promising case with still-unavailable public commercial evidence to Monitoring. Conflicting or unusually large scope remains Needs attention.
- Propagate the exact Lead Strategy version into every assessor run. Enforce hard-excluded versus sensitive sectors, YipYip capability support, current actionability or a separately cited follow-on, and effective-dated delivery capacity as distinct deterministic gates.
- Never infer technical capability from an `available` delivery-capacity setting. Capability evidence must retain matched configured services, concrete unsupported or unresolved project requirements, confidence, rationale, and allow-listed references; capacity only expresses staffing availability and its effective date.
- Require either Social impact or Technical fit at 6/10 with 0.65 confidence. A confident failure on both axes rejects; a promising but unresolved fit is researched initially and becomes Monitoring if public facts remain unavailable.
- Treat an actionable contact route as a deterministic final-qualification gate. Application orchestration must inject the canonical contact question when no confirmed route exists instead of relying on Gap Analyst discretion. Accept a named person, responsible team, procurement desk, or official tender channel only with citation-valid evidence and sufficient confidence; route otherwise promising bounded unknowns to Monitoring and conflicting evidence to Needs attention.
- Create a review-ready Lead automatically only when the final score decision is exactly `qualify` and persisted qualification checks all passed. Borderline/research decisions, partner dependency, sensitive sectors, unusual budgets, ambiguity, invalid outreach, and conflicting evidence become Needs-attention exceptions.
- If product work introduces manual pursuit, do not weaken or reuse the automatic qualification gate. Preserve the final Assessment and unresolved evidence as truth, distinguish the Lead origin, and prevent manual action from overriding hard-sector or expired-actionability rejection.
- Treat a Needs-attention resolution request as orchestration input, not human assessment: restart the bounded qualification workflow at First Assessment and let the normal gap/research/final-routing stages run. Keep an Opportunity pass distinct from a finished-Lead pursuit decision.
- Keep active workflow progress distinct from terminal exception state. A queued/running automatic or requested qualification workflow means research is pending/in progress even when no `automation_exception` exists; only deterministic terminal routing should create the human-resolution surface.
- Generate immutable email and cold-call drafts only from the final validated evidence snapshot. Enforce word limits and evidence references deterministically; never send the drafts.

Keep OpenAI credentials and privileged clients server-only. Do not run billable research or send lead data to a vendor without explicit authorization.
