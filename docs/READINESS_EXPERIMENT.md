# Conversation-readiness shadow evaluation

Status: implemented locally, live flag **off by default**. This is a comparison tool, not a new Lead-qualification path.

## Try the interface

Open `/?demo=sample&view=readiness` for simulated comparisons. Labels stay in that browser tab's `sessionStorage`; no Supabase or OpenAI call is made by demo labeling. Label first is enabled initially. An explicit opt-out reveals the automation; previously seen cases are not genuinely blinded. Existing live workspaces expose the view only when the server flag `CONVERSATION_READINESS_ENABLED` is deliberately enabled. This task does not enable it.

Owners/reviewers can label exact current evaluations. Operators/viewers inspect. Labels mean **Worth contacting / Monitor / Pass / Insufficient evidence**, not Pursue/Pass workflow mutations. Reasons are stable codes; Other requires a note. Correction creates another immutable label with `replaces_id`; stale assessment/evaluation/prior-label submissions fail. Current latest label per reviewer is used for metrics, so repeated corrections do not inflate agreement.

## Offline comparison

```bash
node --env-file=.env.local --import tsx scripts/evaluate-opportunity-policy.mjs --shadow <workspace-uuid>
```

Supply one or more explicit workspace UUIDs. This makes only paginated database reads and deterministic local calculations. It replays each latest final Assessment using its stored policy/evidence and separately marks current, superseded or expired applicability. No new research, score-policy activation or workflow progression occurs.

To explicitly persist local shadow snapshots only:

```bash
node --env-file=.env.local --import tsx scripts/evaluate-opportunity-policy.mjs --shadow --persist-local <workspace-uuid>
```

Persistence refuses non-loopback Supabase URLs. It uses a server credential and writes only `conversation_readiness_evaluations`, deduplicated by Assessment, input/context fingerprint and policy version. Do not paste credentials into commands or reports. Omit `--persist-local` for the default read-only report. The command reports attempted persistence; duplicate snapshots are intentionally ignored.

Legacy mapping is explicit: supported capability can map to transferable fit; current/expired actionability maps only where semantics are known; confirmed bounded dedicated packages/lots retain their addressable value. Legacy “unsupported” is not assumed to mean a mandatory capability failure. Free-text findings, broad grant totals and organization size are not guessed into favorable classifications. Partial maps stay in provenance/report coverage, not fabricated complete inputs.

## Evidence and metrics

The evaluator requires concrete software need, transferable fit, current enquiry reason, legitimate contact and a supported commercial case. Unknown supplier demand requires planning/engagement evidence. Whole-programme funding can support a plausible spending proxy but cannot become an addressable package value. Every factual claim retains rationale and citations at ≥0.65 confidence; allow-listing does not independently verify that claim.

Explicit exclusions/closed scopes/no-software/assigned internal scopes/unsupported mandatory requirements/subminimum packages are not suitable. Material uncertainty, sensitive sectors and conflict mean monitor. Invalid citations or missing schema mean not evaluated. No delivery-capacity commitment follows from readiness.

The view reports coverage, labels, comparable judgments, disagreements and possible delivery false negatives. Unlabeled cases and abstentions are excluded from agreement; expired/superseded results are not current recommendations. Counts are reviewer judgments, not statistically independent experiments. The UI loads at most 1,000 evaluation/history rows with an explicit truncation notice. Source-authored text remains in its original language.

## Local result and rollout limits

The read-only 27 September run found 16 Opportunities, 88 Assessments and 523 findings. All 16 were **not evaluated**: 13 latest finals lacked the new complete structured input; three lacked a final Assessment. One legacy final also lacked the budget policy. This is a schema-coverage finding, not evidence that none deserve conversation. Existing scores, statuses and Leads were not changed; no GPT judgments were imported as human labels.

Tests use synthetic data and rollback. Fresh migration validation uses a separate disposable Supabase project, never a reset of the populated evaluation database. No paid calls, hosted deployment, Cron, outreach or CRM action are part of this slice. The extra output fields share existing provider budgets; provider behavior and resulting business quality still need controlled validation after explicit activation.

Verified locally: 23 test files, typecheck, lint, production build, fresh disposable migrations, all six SQL suites, database lint and generated-type comparison. Demo browser checks covered label-first reveal, keyboard/validation/success, reload persistence, EN/NL, themes and desktop/tablet/mobile overflow. Authenticated browser error handling and OS-level reduced-motion emulation remain unverified; SQL authorization/versioning passed and the new view adds no animation. The four affected repository skills were updated and validated.
