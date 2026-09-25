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
- Generate focused questions only for missing, weak, stale, inferred, or conflicting facts that could change a decision.
- Prefer primary sources. Every new researched claim becomes a sourced ResearchFinding; copied Signal facts retain Signal provenance.
- Accept only terminal statuses defined by the PRD. Unknown is a valid completed result after reasonable attempts.
- Validate question coverage, provenance, confidence, and explanations outside the agent run.
- Continue only unresolved questions and stop on configured pass, time, tool, cost, exhaustion, or no-progress limits.
- Recalculate final dimensions from the current evidence snapshot rather than adding an opaque research bonus.
- Keep routine qualification autonomous: First Assessment, material Gap Analysis, focused Research, Final Assessment, and routing proceed through durable bounded stages without a user Assess button.
- Let deterministic application code calculate the score and route rejected, monitoring, qualified, or exceptional outcomes. Agents cannot qualify their own output.
- Treat total procurement value and the YipYip-addressable package as separate claims. Validate commercial evidence references, apply the active versioned budget curve and Budget/Delivery gates in application code, and send a still-unknown final commercial fit to Needs attention.
- Treat an actionable contact route as a deterministic final-qualification gate. Application orchestration must inject the canonical contact question when no confirmed route exists instead of relying on Gap Analyst discretion. Accept a named person, responsible team, procurement desk, or official tender channel only with citation-valid evidence and sufficient confidence; route bounded unknowns to Needs attention.
- Create a review-ready Lead automatically only from a qualifying final Assessment. Borderline confidence, partner dependency, sensitive sectors, unusual budgets, ambiguity, and conflicting evidence become Needs-attention exceptions.

Keep OpenAI credentials and privileged clients server-only. Do not run billable research or send lead data to a vendor without explicit authorization.
