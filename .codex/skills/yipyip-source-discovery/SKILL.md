---
name: yipyip-source-discovery
description: Build, debug, or review YipYip source registry, discovery jobs, source adapters, signal normalization, deduplication, and organization or opportunity resolution. Use only for YipYip discovery-pipeline work.
---

# YipYip Source Discovery

Build the autonomous Lead Strategy → Source Scout → approved recurring monitor path for coverage, traceability, and safe repeatability.

## Ground the work

Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, and the PRD sections on Lead Strategy and Source Network, Source Scoped Discovery Jobs, Normalization and Deduplication, Provenance, and Acceptance Criteria. Inspect the current schema, durable workflow stages, and affected ingestion paths before proposing a contract.

## Preserve discovery invariants

- Treat Lead Strategy as the editable business intent. Query/search plans are immutable internal run snapshots, never user-managed Query Packs.
- Carry sectors, organization types, YipYip software capabilities, impact themes, keywords, project clues, search exclusions, hard/sensitive sector policy, commercial thresholds, and effective-dated capacity into each Search Plan snapshot and relevant agent prompt.
- Source Scout may propose evidence-backed sources but never approve or enable them. Preserve one-time owner/operator approval and unchanged-rejection suppression.
- Before Source Scout runs, inventory approved, pending, and rejected domains plus configured signal-area coverage. Prefer uncovered or least-covered areas, require each proposal to identify its primary coverage gap and novelty, and enforce domain/family/gap diversity deterministically after agent output. Persist the policy and rejection telemetry with the run rather than trusting the agent to police its own variety.
- Treat source reputation (trust/relevance) and source health (monitor reliability) as separate versioned facts.
- Create independent bounded weekday jobs per approved source with checkpoints, timezone-aware due times, stage leases, bounded retries, and isolated failure.
- Preserve raw source representation, canonical identity, capture metadata, relevant evidence, and content fingerprints.
- Run deterministic duplicate checks before probabilistic matching. Never merge opportunities solely because they share an organization.
- Separate observed facts from labeled inferences and retain reversible merge or split history.
- Capture sector categories and current/upcoming/expired/unknown actionability with a supported deadline or follow-on clue. Do not treat an expired project or whole-procurement value as a current addressable opportunity.
- Classify whether a result identifies a commissioning organization/concrete applicant or only a programme/funding call. Programme-only results remain Signals for coverage monitoring and must not synthesize an Organization, Opportunity, Assessment, or Lead.
- Make reruns idempotent and avoid reprocessing unchanged source items.
- Treat a canonical page URL as provenance, not necessarily as one source item. Give each logical candidate on a roundup/newsletter page a stable item identity, reuse unchanged URL/fingerprint matches, and create a new atomic revision only when that logical item's content changes.
- Keep demo onboarding structurally aligned with the live Source Network: complete strategy criteria, Source Scout status, individual proposal evidence, approved monitors, and activity remain visible in their normal sections. Simulated agents and data must be labelled rather than hidden behind a separate wizard.

Do not manually reintroduce routine Run discovery controls or assessment clicks. Do not enable hosted Cron/production adapters, bypass access controls, scrape restricted platforms, or collect unnecessary personal data without explicit authorization and recorded policy review.
