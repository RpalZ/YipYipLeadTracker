-- Focused multi-source research and explicit terminal monitoring.

alter type public.lifecycle_status add value if not exists 'monitoring' after 'ready_for_final_assessment';

alter table public.automation_stage_runs
  drop constraint automation_stage_runs_pass_check,
  add constraint automation_stage_runs_pass_check check (pass between 1 and 8);

alter table public.research_findings
  drop constraint research_findings_check,
  add constraint research_findings_supported_sources_check check (
    status in ('unknown', 'not_found')
    or jsonb_array_length(source_refs) > 0
  );

comment on constraint automation_stage_runs_pass_check on public.automation_stage_runs is
  'Allows up to eight focused research bundles; workflow cost and per-question attempt limits remain independently enforced.';

comment on constraint research_findings_supported_sources_check on public.research_findings is
  'Confirmed, inferred, and contradicted findings require cited sources. Unknown and not-found attempts retain consulted URLs in attempt_summary.';
