---
name: yipyip-lead-review-frontend
description: Build or review YipYip's lead gallery, artifact-style lead drawer, basket, filters, evidence views, review states, responsive behavior, and accessible interactions. Do not use for unrelated frontend projects.
---

# YipYip Lead Review Frontend

Create a calm review surface that makes a small ranked set of leads understandable before exposing deep evidence.

## Ground implementation

Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, and the PRD sections on Users and Jobs, Lead Delivery, Human Review, Accessibility, and Lead Delivery Acceptance Criteria. Inspect installed dependencies and current framework documentation before importing or changing library APIs.

## Product language and interaction

- Make automatically qualified Leads the initial primary surface. Keep Monitoring and Needs attention as explicit secondary views; routine rejected/in-progress Opportunities belong in operational history.
- Keep what, why or fit, budget, location, contact, confidence, and source count legible without hiding uncertainty.
- Open Opportunity detail in a URL-backed right drawer with Overview, Evaluation, Sources, Outreach, and a contextual final view: **Resolve** for non-Lead qualification exceptions and **Decision** for Leads. Keep the shortlist as a separate header drawer.
- Treat a queued or running qualification workflow as **Progress**, whether automation started it from a Signal or a person requested reassessment. Do not require an exception record, offer duplicate research controls, or describe active automatic work as unavailable; reserve **Resolve** for a persisted open exception.
- Route **Open pursuit workspace** to `/reviewed`, where the session shortlist is combined with persistent Lead status and decision history and grouped into requalification, saved, research-pending, pursuing, and passed states. Never present session shortlist membership as durable backend state.
- Keep sources outlined and attributable, distinguish facts from inferences and human edits, and never present a score without rationale and confidence. Show research breadth (consulted URLs/passes) separately from the smaller cited evidence set; never imply that every consulted page supports a stored claim.
- Keep Overview and Evaluation on the same persisted commercial-fit snapshot. Review actions target an exact Lead version, announce pending/success/error states, require stable reasons where specified, and never imply that Request research guarantees an answer.
- In Evaluation and Resolve, label technical capability fit separately from delivery capacity. Show matched services and unresolved project requirements when the Assessment stored them, show capacity status/valid-through date independently, and identify historical snapshots that lack the newer evidence detail.
- Present manually promoted Leads as human commercial overrides, never as automatically qualified. Show their unchanged automated status and gaps, expose **Create manual Lead** through Resolve only for eligible completed Opportunities, state that creation is not pursuit approval, and keep their outreach caveats and immutable origin visible in the drawer and pursuit workspace.
- Show immutable outreach drafts with language, channel, caveats, evidence links, and separate copy announcements. Historical/no-draft versions must say so explicitly, and no UI control may imply sending.
- Use JetBrains Mono at a 16px+ body scale, restrained neutral surfaces, semantic light/dark tokens, the established green and teal accents, readable type, and functional motion only.
- Keep product chrome and workflow actions complete in both English and Dutch. Persist locale/theme preferences without a mismatched first paint, and preserve source-authored evidence rather than silently translating it.
- In the Source Network, expose one editable Lead Strategy, individual source approval, automation activity, health, and exceptions. Never expose Coverage Profiles or Query Packs as user-managed concepts.
- Keep the deterministic demo's Source Network information architecture aligned with the live slice and reuse shared fields/components where practical. Distinguish simulation through labels and data boundaries, not a simplified wizard that teaches a different workflow.
- Provide keyboard navigation, correct dialog and tab semantics, focus containment and restoration, Escape and Back behavior, readable contrast, non-color status labels, and reduced-motion support.
- Verify desktop, tablet, and mobile layouts with no horizontal overflow or microtext.

Do not add review mutations, persistence, or external delivery when the task is only a presentation-layer change.
