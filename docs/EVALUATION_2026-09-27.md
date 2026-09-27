# Retrospective policy A/B — 27 September 2026

## Scope and hypothesis

Read-only analysis of the three local YipYip workspaces. No database writes, provider calls, queue processing, new research, or production changes. This is a paired policy-sensitivity comparison, not a randomized experiment or a human-labeled quality evaluation.

- **A:** Recalculate the persisted weighted score with its own persisted policy, retaining every frozen final qualification gate.
- **B:** Same evidence, dimensions, weights, confidence floor, exclusions, and non-score gates. Only end the review band below the final threshold, allowing 72+ instead of effectively 77+ when all other gates pass.
- Use the latest final Assessment per Opportunity, not every repeated assessment as an independent case. Preserve the original recorded route separately from the recalculated score decision.
- Do not manufacture missing historical gate snapshots or reassess old deadlines as though the cases were new today.

## Inventory and results

| Workspace ID prefix | Opportunities | Assessments | Research findings | Comparable latest finals | A qualifies | B qualifies |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| b949b495 | 5 | 12 | 49 | 1 | 0 | 0 |
| 46869940 | 10 | 72 | 454 | 10 | 0 | 0 |
| 504a506e | 1 | 4 | 20 | 1 | 0 | 0 |
| Total | 16 | 88 | 523 | 12 | 0 | 0 |

Three Opportunities have no final Assessment. One historical final lacks the complete modern policy/gate snapshot and is excluded. That historical case has an automated Lead; the other two stored Leads are manual promotions. Therefore, zero qualifications in the comparison does **not** mean the database contains zero Leads.

All 12 recalculated scores match their persisted scores. Scores range from 44 to 62; none enters the band altered by B. There are zero score-decision changes and zero additional qualifications.

Non-score gates overlap and must not be added as independent cases:

| Blocking gate | Latest finals affected |
| --- | ---: |
| Commercial unresolved | 12/12 |
| Capability unresolved or review | 11/12 |
| Delivery review or rejected | 10/12 |
| Actionability unresolved | 3/12 |
| Fit axis unresolved | 2/12 |
| Contact unresolved | 1/12 |
| Timing unresolved | 1/12 |
| Capacity not passed | 0/12 |

The commercial gate includes minimum Budget **and Delivery** dimension checks; it cannot be interpreted as twelve cases simply missing a numerical budget.

## Representative diagnostics

These are interpretations of stored assessments, not newly verified source facts.

- **Website and digital archive access** (`94dfdcc3-5f59-4757-b541-fee6abecb269`): paired score 65 → 62. Technical fit is 7, but addressable budget and work-package boundaries remain unknown; Delivery fit is 5. Eight distinct research-cited URLs across its history. Worth a human relevance check before deciding whether qualification is too strict.
- **NotifyNL integration** (`e8161356-855b-47f2-8dc7-9ef8d3baedc5`): latest paired score 52 → 52. Ninety-eight finding rows and 31 distinct research-cited URLs across all runs. Technical fit is 7, but no priced external package is established. Capability rationale also asks for project-specific NotifyNL experience and detailed security/operational requirements. That may be too demanding for an early conversation, but relaxing capability alone would not solve its budget/delivery blockers.
- **IX for Kids** (`bd6ccf64-28e3-4264-b3a8-947b99855153`): paired score 58 → 50, with 16 distinct research-cited URLs across history. Stored evidence distinguishes a €50k programme-development grant from a software contract; Budget fit is 2 and Technical fit is 3. Treating the whole grant as agency revenue would be an unsupported change, not an evaluation improvement.

URL counts measure stored breadth, not independent publishers, factual correctness, or fresh evidence. Findings include repeated passes and workflows, so 523 rows do not mean 523 independent facts. Historical cost estimates use historical estimators and are not provider invoices.

## Conclusion and next experiment

This sample provides no support for loosening the score review band. It points toward a combination of programme-heavy discovery, unclear purchasable scope, and potentially over-demanding capability judgments—not merely too few searches or unavailable staffing capacity.

Next, human-label a small representative set for **worth an exploratory conversation** versus **qualified for a supported delivery opportunity**. These are different product targets. Inspect where capability checks demand proof of named-platform experience that YipYip does not actually require. Only then compare a revised capability interpretation against the frozen evidence, retaining commercial and safety gates.

A separate discovery-agent A/B could compare the existing broad signal prompt against one focused on identified buyers, external supplier demand, and bounded software work. This has **not** run; it requires explicit provider budget and the same source/time envelopes for both variants. Current snapshots cannot establish whether a new search/research prompt would find better evidence.

## Reproduction and checks

```bash
node --env-file=.env.local --import tsx scripts/evaluate-opportunity-policy.mjs \
  b949b495-65d3-4e41-b97b-a893a1d26671 \
  46869940-e7cd-4f3f-a0cf-6675463cd9bb \
  504a506e-7434-4d36-a175-1997481448b9
```

The script requires explicitly scoped workspace IDs, paginates reads, writes no raw data files, and uses only Supabase SELECT operations plus the existing pure score function. Running it again reflects then-current data; this report records the observed snapshot, not a frozen full evidence export. Queries are not a transactionally consistent database snapshot. The captured UTC timestamp was 2026-09-26T22:39:58Z (27 September in Europe/Amsterdam).

- Passed: comparison query; all 12 score replays matched.
- Passed: `pnpm exec eslint scripts/evaluate-opportunity-policy.mjs` and `node --check scripts/evaluate-opportunity-policy.mjs`.
- Passed: `node --import tsx --test tests/scoring.test.ts`.
- Blocked then recovered: `pnpm exec tsx --test tests/scoring.test.ts` hit sandbox IPC restrictions; Node's import-based runner above succeeded.
- Not run: full application/build/browser gate, live agent comparison, external citation verification, human quality labels, hosted configuration checks.
