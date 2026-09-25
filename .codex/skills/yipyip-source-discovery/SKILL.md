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
- Source Scout may propose evidence-backed sources but never approve or enable them. Preserve one-time owner/operator approval and unchanged-rejection suppression.
- Treat source reputation (trust/relevance) and source health (monitor reliability) as separate versioned facts.
- Create independent bounded weekday jobs per approved source with checkpoints, timezone-aware due times, stage leases, bounded retries, and isolated failure.
- Preserve raw source representation, canonical identity, capture metadata, relevant evidence, and content fingerprints.
- Run deterministic duplicate checks before probabilistic matching. Never merge opportunities solely because they share an organization.
- Separate observed facts from labeled inferences and retain reversible merge or split history.
- Make reruns idempotent and avoid reprocessing unchanged source items.

Do not manually reintroduce routine Run discovery controls or assessment clicks. Do not enable hosted Cron/production adapters, bypass access controls, scrape restricted platforms, or collect unnecessary personal data without explicit authorization and recorded policy review.
