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
- Open lead detail in a URL-backed right drawer with Overview, Evaluation, and Sources views; make basket review a separate header drawer.
- Route **Review saved leads** to `/reviewed`, where the session shortlist is combined with persistent Lead status and review history and grouped into saved, research-pending, pursuing, and passed states. Never present session shortlist membership as durable backend state.
- Keep sources outlined and attributable, distinguish facts from inferences and human edits, and never present a score without rationale and confidence.
- Keep Overview and Evaluation on the same persisted commercial-fit snapshot. Review actions target an exact Lead version, announce pending/success/error states, require stable reasons where specified, and never imply that Request research guarantees an answer.
- Use JetBrains Mono, restrained neutral surfaces, the established green and teal accents, readable type, and functional motion only.
- In the Source Network, expose one editable Lead Strategy, individual source approval, automation activity, health, and exceptions. Never expose Coverage Profiles or Query Packs as user-managed concepts.
- Provide keyboard navigation, correct dialog and tab semantics, focus containment and restoration, Escape and Back behavior, readable contrast, non-color status labels, and reduced-motion support.
- Verify desktop, tablet, and mobile layouts with no horizontal overflow or microtext.

Do not add review mutations, persistence, or external delivery when the task is only a presentation-layer change.
