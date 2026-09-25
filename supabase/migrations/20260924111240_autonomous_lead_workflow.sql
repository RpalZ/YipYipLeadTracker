-- Autonomous lead discovery and qualification.
-- Existing coverage profile identifiers are retained as the storage identity for
-- user-facing Lead Strategies so historical discovery runs remain attributable.

create type public.automation_workflow_kind as enum (
  'source_scout',
  'source_monitor',
  'opportunity_qualification'
);
create type public.automation_workflow_status as enum (
  'queued',
  'running',
  'waiting_approval',
  'succeeded',
  'failed',
  'cancelled'
);
create type public.automation_stage as enum (
  'source_scout',
  'source_monitor',
  'normalize',
  'resolve',
  'first_assessment',
  'gap_analysis',
  'research',
  'final_assessment',
  'route'
);
create type public.automation_stage_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'waiting'
);

alter table public.discovery_coverage_profiles
  add column automation_enabled boolean not null default false,
  add column timezone text not null default 'Europe/Amsterdam',
  add column monitor_hour smallint not null default 7 check (monitor_hour between 0 and 23),
  add column scout_interval interval not null default interval '30 days'
    check (scout_interval >= interval '1 day'),
  add column daily_cost_limit numeric(10,2) not null default 2.50
    check (daily_cost_limit >= 0),
  add column activated_at timestamptz,
  add column last_scouted_at timestamptz,
  add column next_scout_at timestamptz;

drop policy "coverage editors can insert discovery coverage profiles" on public.discovery_coverage_profiles;
drop policy "coverage editors can update discovery coverage profiles" on public.discovery_coverage_profiles;
create policy "operators can insert discovery coverage profiles"
on public.discovery_coverage_profiles for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "operators can update discovery coverage profiles"
on public.discovery_coverage_profiles for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));

update public.discovery_coverage_profiles
set profile_key = 'lead-strategy',
    name = case when name = 'Dutch Agency Pitches' then 'Dutch agency opportunities' else name end,
    cadence = 'weekdays',
    automation_enabled = false,
    change_note = concat_ws('; ', nullif(change_note, ''), 'Migrated to Lead Strategy; automation remains off until saved')
where profile_key = 'dutch-agency-pitches';

alter table public.discovery_source_candidates
  add column reputation_score numeric(5,4) check (reputation_score between 0 and 1),
  add column source_classification text
    check (source_classification is null or source_classification in ('primary', 'secondary', 'aggregator')),
  add column public_access boolean not null default true,
  add column observed_update_frequency text,
  add column reputation_evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reputation_evidence) = 'array'),
  add column policy_checks jsonb not null default '{}'::jsonb
    check (jsonb_typeof(policy_checks) = 'object'),
  add column suppression_fingerprint text;

create unique index discovery_source_candidates_suppression_idx
  on public.discovery_source_candidates (workspace_id, suppression_fingerprint)
  where suppression_fingerprint is not null and status in ('proposed', 'in_review', 'approved');

alter table public.source_registry
  add column reputation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(reputation) = 'object'),
  add column approved_by uuid references auth.users(id) on delete set null,
  add column approved_at timestamptz,
  add column schedule_enabled boolean not null default false,
  add column next_run_at timestamptz,
  add column last_run_at timestamptz;

alter table public.assessments
  add constraint assessments_workspace_id_id_key unique (workspace_id, id),
  drop constraint assessments_opportunity_id_fkey,
  add constraint assessments_workspace_opportunity_fkey
    foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id) on delete cascade;
alter table public.research_questions
  add constraint research_questions_workspace_id_id_key unique (workspace_id, id),
  drop constraint research_questions_opportunity_id_fkey,
  add constraint research_questions_workspace_opportunity_fkey
    foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id) on delete cascade;
alter table public.research_findings
  drop constraint research_findings_opportunity_id_fkey,
  drop constraint research_findings_question_id_fkey,
  add constraint research_findings_workspace_opportunity_fkey
    foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id) on delete cascade,
  add constraint research_findings_workspace_question_fkey
    foreign key (workspace_id, question_id) references public.research_questions(workspace_id, id) on delete restrict;
alter table public.leads
  drop constraint leads_opportunity_id_fkey,
  drop constraint leads_final_assessment_id_fkey,
  add constraint leads_workspace_opportunity_fkey
    foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id) on delete restrict,
  add constraint leads_workspace_assessment_fkey
    foreign key (workspace_id, final_assessment_id) references public.assessments(workspace_id, id) on delete restrict;

alter table public.discovery_jobs drop constraint discovery_jobs_cadence_check;
alter table public.discovery_jobs
  add column timezone text not null default 'Europe/Amsterdam',
  add column next_run_at timestamptz,
  add column last_run_at timestamptz,
  add column checkpoint jsonb not null default '{}'::jsonb
    check (jsonb_typeof(checkpoint) = 'object'),
  add column search_plan_template jsonb not null default '{}'::jsonb
    check (jsonb_typeof(search_plan_template) = 'object'),
  add column archived_at timestamptz,
  add constraint discovery_jobs_cadence_check
    check (cadence in ('manual', 'weekdays'));

update public.discovery_jobs
set enabled = false,
    archived_at = now(),
    changed_by = null
where job_key = 'dutch-agency-pitches-manual';

update public.source_registry
set enabled = false,
    schedule_enabled = false,
    health = 'paused',
    change_note = concat_ws('; ', nullif(change_note, ''), 'Archived legacy user-managed query pack')
where adapter_type = 'hosted_web_search'
  and name = 'Dutch agency pitches query pack';

create table public.automation_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind public.automation_workflow_kind not null,
  status public.automation_workflow_status not null default 'queued',
  coverage_profile_id uuid not null,
  source_id uuid,
  opportunity_id uuid,
  trigger_kind text not null check (trigger_kind in ('strategy_activation', 'strategy_change', 'scheduled', 'source_approval', 'signal_created', 'retry')),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  current_stage public.automation_stage not null,
  search_plan_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(search_plan_snapshot) = 'object'),
  cost_limit numeric(10,4) not null default 0.50 check (cost_limit >= 0),
  estimated_cost numeric(10,6) not null default 0 check (estimated_cost >= 0),
  cost_currency text not null default 'EUR' check (cost_currency = 'EUR'),
  stop_reason text,
  error_code text,
  failure_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, coverage_profile_id)
    references public.discovery_coverage_profiles(workspace_id, id) on delete restrict,
  foreign key (workspace_id, source_id)
    references public.source_registry(workspace_id, id) on delete restrict,
  foreign key (workspace_id, opportunity_id)
    references public.opportunities(workspace_id, id) on delete restrict
);
create index automation_workflow_runs_workspace_idx
  on public.automation_workflow_runs (workspace_id, created_at desc);
create index automation_workflow_runs_source_idx
  on public.automation_workflow_runs (source_id, created_at desc) where source_id is not null;
create index automation_workflow_runs_opportunity_idx
  on public.automation_workflow_runs (opportunity_id, created_at desc) where opportunity_id is not null;
create index automation_workflow_runs_active_idx
  on public.automation_workflow_runs (workspace_id, status, updated_at)
  where status in ('queued', 'running', 'waiting_approval');

create table public.automation_stage_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_run_id uuid not null,
  stage public.automation_stage not null,
  status public.automation_stage_status not null default 'queued',
  attempt integer not null default 1 check (attempt between 1 and 4),
  available_at timestamptz not null default now(),
  lease_token uuid,
  leased_by text,
  leased_until timestamptz,
  input_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(input_snapshot) = 'object'),
  output_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(output_snapshot) = 'object'),
  usage jsonb not null default '{}'::jsonb check (jsonb_typeof(usage) = 'object'),
  estimated_cost numeric(10,6) not null default 0 check (estimated_cost >= 0),
  stop_reason text,
  error_code text,
  failure_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workflow_run_id, stage, attempt),
  foreign key (workspace_id, workflow_run_id)
    references public.automation_workflow_runs(workspace_id, id) on delete cascade,
  check (
    (status = 'running' and lease_token is not null and leased_by is not null and leased_until is not null)
    or status <> 'running'
  )
);
create unique index automation_stage_runs_one_running_idx
  on public.automation_stage_runs (workflow_run_id) where status = 'running';
create index automation_stage_runs_claim_idx
  on public.automation_stage_runs (available_at, created_at)
  where status in ('queued', 'failed');

create table public.automation_exceptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_run_id uuid not null,
  opportunity_id uuid,
  source_id uuid,
  exception_kind text not null check (exception_kind in (
    'ambiguous_entity', 'low_confidence', 'borderline_score', 'sensitive_sector',
    'unusual_budget', 'partner_required', 'conflicting_evidence', 'policy_failure',
    'cost_limit', 'repeated_failure'
  )),
  summary text not null check (length(trim(summary)) > 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, workflow_run_id)
    references public.automation_workflow_runs(workspace_id, id) on delete cascade,
  foreign key (workspace_id, opportunity_id)
    references public.opportunities(workspace_id, id) on delete restrict,
  foreign key (workspace_id, source_id)
    references public.source_registry(workspace_id, id) on delete restrict
);
create index automation_exceptions_workspace_open_idx
  on public.automation_exceptions (workspace_id, created_at desc) where status = 'open';

alter table public.source_health_events
  alter column evaluated_by drop not null,
  add column automation_workflow_run_id uuid,
  add constraint source_health_events_automation_workflow_fkey
    foreign key (workspace_id, automation_workflow_run_id)
    references public.automation_workflow_runs(workspace_id, id) on delete restrict;
create unique index source_health_events_one_automation_evaluation_idx
  on public.source_health_events (automation_workflow_run_id)
  where automation_workflow_run_id is not null;

create trigger automation_workflow_runs_set_updated_at
before update on public.automation_workflow_runs
for each row execute function private.set_updated_at();

alter table public.automation_workflow_runs enable row level security;
alter table public.automation_stage_runs enable row level security;
alter table public.automation_exceptions enable row level security;

create policy "members can read automation workflows"
on public.automation_workflow_runs for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy "operators can enqueue automation workflows"
on public.automation_workflow_runs for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "members can read automation stages"
on public.automation_stage_runs for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy "operators can enqueue automation stages"
on public.automation_stage_runs for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "members can read automation exceptions"
on public.automation_exceptions for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy "reviewers can resolve automation exceptions"
on public.automation_exceptions for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

grant select, insert on public.automation_workflow_runs, public.automation_stage_runs to authenticated;
grant select on public.automation_exceptions to authenticated;
grant update (status, resolved_by, resolved_at, resolution_note) on public.automation_exceptions to authenticated;
revoke all on public.automation_workflow_runs, public.automation_stage_runs, public.automation_exceptions from anon;

create or replace function private.next_weekday_at(
  p_after timestamptz,
  p_timezone text,
  p_hour integer
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  local_date date := (p_after at time zone p_timezone)::date;
  candidate timestamptz;
begin
  loop
    candidate := (local_date + make_interval(hours => greatest(0, least(23, p_hour)))) at time zone p_timezone;
    if candidate > p_after and extract(isodow from local_date) < 6 then
      return candidate;
    end if;
    local_date := local_date + 1;
  end loop;
  return candidate;
end;
$$;

create or replace function public.save_lead_strategy(p_strategy jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_workspace uuid := (p_strategy ->> 'workspaceId')::uuid;
  actor_id uuid := (select auth.uid());
  previous public.discovery_coverage_profiles%rowtype;
  created public.discovery_coverage_profiles%rowtype;
  next_version integer;
  scout_workflow_id uuid;
begin
  if actor_id is null or not (select private.has_workspace_role(target_workspace, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;

  select * into previous
  from public.discovery_coverage_profiles
  where workspace_id = target_workspace and profile_key = 'lead-strategy' and status = 'active'
  for update;

  select coalesce(max(version), 0) + 1 into next_version
  from public.discovery_coverage_profiles
  where workspace_id = target_workspace and profile_key = 'lead-strategy';

  update public.discovery_coverage_profiles
  set status = 'archived', is_default = false, changed_by = actor_id,
      change_note = case when id = previous.id then 'Superseded by Lead Strategy version ' || next_version else change_note end
  where workspace_id = target_workspace and status = 'active';

  insert into public.discovery_coverage_profiles (
    workspace_id, profile_key, name, description, status, is_default,
    signal_areas, sectors, organization_types, regions, languages, project_types,
    technical_themes, impact_themes, keywords, negative_terms, project_clues,
    lookback, cadence, result_limit, cost_limit, daily_cost_limit,
    automation_enabled, timezone, monitor_hour, version, effective_at,
    activated_at, next_scout_at, created_by, changed_by, change_note
  ) values (
    target_workspace, 'lead-strategy', coalesce(nullif(trim(p_strategy ->> 'name'), ''), 'Dutch agency opportunities'),
    nullif(trim(p_strategy ->> 'description'), ''), 'active', true,
    case when jsonb_array_length(coalesce(p_strategy -> 'signalAreas', '[]'::jsonb)) > 0
      then array(select jsonb_array_elements_text(p_strategy -> 'signalAreas'))::public.discovery_signal_area[]
      else array['pitching','newsletters','strategy','hiring','announcements']::public.discovery_signal_area[] end,
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'sectors')), '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'organizationTypes')), '{}'::text[]),
    case when jsonb_array_length(coalesce(p_strategy -> 'regions', '[]'::jsonb)) > 0 then array(select jsonb_array_elements_text(p_strategy -> 'regions')) else array['Netherlands']::text[] end,
    case when jsonb_array_length(coalesce(p_strategy -> 'languages', '[]'::jsonb)) > 0 then array(select jsonb_array_elements_text(p_strategy -> 'languages')) else array['nl','en']::text[] end,
    case when jsonb_array_length(coalesce(p_strategy -> 'projectTypes', '[]'::jsonb)) > 0 then array(select jsonb_array_elements_text(p_strategy -> 'projectTypes')) else array['websites','digital products','platforms','apps','redesigns','campaigns']::text[] end,
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'services')), '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'impactThemes')), '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'keywords')), '{}'::text[]),
    case when jsonb_array_length(coalesce(p_strategy -> 'exclusions', '[]'::jsonb)) > 0 then array(select jsonb_array_elements_text(p_strategy -> 'exclusions')) else array['completed','awarded','closed']::text[] end,
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'projectClues')), '{}'::text[]),
    make_interval(days => greatest(1, least(365, coalesce((p_strategy ->> 'lookbackDays')::integer, 90)))),
    'weekdays', greatest(1, least(25, coalesce((p_strategy ->> 'resultLimit')::integer, 5))),
    greatest(0, coalesce((p_strategy ->> 'runCostLimit')::numeric, 0.50)),
    greatest(0, coalesce((p_strategy ->> 'dailyCostLimit')::numeric, 2.50)), true,
    coalesce(nullif(p_strategy ->> 'timezone', ''), 'Europe/Amsterdam'),
    greatest(0, least(23, coalesce((p_strategy ->> 'monitorHour')::integer, 7))),
    next_version, now(), now(), now() + interval '30 days', actor_id, actor_id, 'Lead Strategy saved and Source Scout queued'
  ) returning * into created;

  insert into public.automation_workflow_runs (
    workspace_id, kind, coverage_profile_id, trigger_kind, idempotency_key,
    current_stage, search_plan_snapshot, cost_limit
  ) values (
    target_workspace, 'source_scout', created.id,
    case when previous.id is null then 'strategy_activation' else 'strategy_change' end,
    'source-scout:' || created.id || ':v' || created.version,
    'source_scout', jsonb_build_object('strategyVersion', created.version, 'criteria', p_strategy),
    least(created.cost_limit, created.daily_cost_limit)
  ) returning id into scout_workflow_id;

  insert into public.automation_stage_runs (workspace_id, workflow_run_id, stage, input_snapshot)
  values (target_workspace, scout_workflow_id, 'source_scout', jsonb_build_object('strategyId', created.id));

  return created.id;
end;
$$;

create or replace function public.review_source_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  candidate public.discovery_source_candidates%rowtype;
  source_id uuid;
  job_id uuid;
  workflow_id uuid;
begin
  select * into candidate from public.discovery_source_candidates where id = p_candidate_id for update;
  if not found or actor_id is null or not (select private.has_workspace_role(candidate.workspace_id, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;
  if candidate.status not in ('proposed', 'in_review') or p_decision not in ('approved', 'rejected') then
    raise exception 'candidate is not reviewable';
  end if;

  if p_decision = 'rejected' then
    update public.discovery_source_candidates
    set status = 'rejected', reviewed_by = actor_id, reviewed_at = now(), review_note = p_note
    where id = candidate.id;
    return null;
  end if;

  insert into public.source_registry (
    workspace_id, name, source_family, owner, jurisdiction, base_url,
    adapter_type, permitted_method, terms_note, privacy_class, retention_policy,
    enabled, schedule_enabled, cadence, lookback, timezone, search_config, controls,
    health, alert_owner, approved_by, approved_at, reputation, next_run_at,
    version, changed_by, change_note
  ) values (
    candidate.workspace_id, candidate.name, candidate.source_family, 'YipYip source operations',
    candidate.jurisdiction, candidate.base_url, 'hosted_web_search', 'public_web_search',
    coalesce(candidate.policy_checks ->> 'termsNote', 'Public search only; review if access terms change'),
    'public', jsonb_build_object('storeFullBody', false, 'evidenceExcerptOnly', true),
    true, true, 'weekdays', interval '90 days', 'Europe/Amsterdam',
    candidate.proposed_config, jsonb_build_object('resultLimit', 5, 'costLimit', 0.50, 'maxAttempts', 4),
    'healthy', 'YipYip operators', actor_id, now(),
    jsonb_build_object('score', candidate.reputation_score, 'classification', candidate.source_classification,
      'evidence', candidate.reputation_evidence, 'policyChecks', candidate.policy_checks),
    private.next_weekday_at(now(), 'Europe/Amsterdam', 7), 1, actor_id, 'Approved from Source Scout proposal'
  ) returning id into source_id;

  update public.discovery_source_candidates
  set status = 'approved', resolved_source_id = source_id, reviewed_by = actor_id,
      reviewed_at = now(), review_note = p_note
  where id = candidate.id;

  insert into public.coverage_profile_sources (
    workspace_id, coverage_profile_id, source_id, source_candidate_id,
    signal_areas, link_rationale, linked_by
  ) values (
    candidate.workspace_id, candidate.coverage_profile_id, source_id, candidate.id,
    (select signal_areas from public.discovery_coverage_profiles where id = candidate.coverage_profile_id),
    candidate.coverage_rationale, actor_id
  );

  insert into public.discovery_jobs (
    workspace_id, coverage_profile_id, source_id, job_key, name, enabled, cadence,
    result_limit, max_turns, timeout_seconds, max_output_tokens, estimated_cost_limit,
    model, prompt_version, version, created_by, changed_by, timezone, next_run_at,
    search_plan_template
  ) values (
    candidate.workspace_id, candidate.coverage_profile_id, source_id,
    'source-' || replace(source_id::text, '-', ''), 'Monitor ' || candidate.name,
    true, 'weekdays', 5, 5, 60, 1200, 0.50,
    'gpt-5.4-mini-2026-03-17', 'source-monitor-v1', 1, actor_id, actor_id,
    'Europe/Amsterdam', private.next_weekday_at(now(), 'Europe/Amsterdam', 7), candidate.proposed_config
  ) returning id into job_id;

  insert into public.automation_workflow_runs (
    workspace_id, kind, coverage_profile_id, source_id, trigger_kind,
    idempotency_key, current_stage, search_plan_snapshot, cost_limit
  ) values (
    candidate.workspace_id, 'source_monitor', candidate.coverage_profile_id, source_id,
    'source_approval', 'source-monitor:' || source_id || ':approval', 'source_monitor',
    jsonb_build_object('sourceId', source_id, 'candidateId', candidate.id, 'jobId', job_id), 0.50
  ) returning id into workflow_id;

  insert into public.automation_stage_runs (workspace_id, workflow_run_id, stage, input_snapshot)
  values (candidate.workspace_id, workflow_id, 'source_monitor', jsonb_build_object('sourceId', source_id, 'jobId', job_id));

  return source_id;
end;
$$;

create or replace function public.set_lead_automation_enabled(p_workspace_id uuid, p_enabled boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.has_workspace_role(p_workspace_id, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;
  update public.discovery_coverage_profiles
  set automation_enabled = p_enabled, changed_by = (select auth.uid()),
      change_note = case when p_enabled then 'Automation resumed' else 'Automation paused' end
  where workspace_id = p_workspace_id and profile_key = 'lead-strategy' and status = 'active';
  update public.source_registry
  set schedule_enabled = p_enabled,
      health = case when p_enabled then health else 'paused'::public.source_health end,
      changed_by = (select auth.uid())
  where workspace_id = p_workspace_id and approved_at is not null;
end;
$$;

create or replace function public.dispatch_due_automation(p_limit integer default 10)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  due_job record;
  due_strategy record;
  workflow_id uuid;
  dispatched integer := 0;
  scheduled_for timestamptz;
begin
  for due_strategy in
    select profile.*
    from public.discovery_coverage_profiles as profile
    where profile.profile_key = 'lead-strategy'
      and profile.status = 'active'
      and profile.automation_enabled
      and profile.next_scout_at <= now()
    order by profile.next_scout_at
    for update skip locked
    limit greatest(0, least(p_limit, 50))
  loop
    insert into public.automation_workflow_runs (
      workspace_id, kind, coverage_profile_id, trigger_kind, idempotency_key,
      current_stage, search_plan_snapshot, cost_limit
    ) values (
      due_strategy.workspace_id, 'source_scout', due_strategy.id, 'scheduled',
      'source-scout:' || due_strategy.id || ':' || extract(epoch from due_strategy.next_scout_at)::bigint,
      'source_scout', jsonb_build_object('strategyVersion', due_strategy.version, 'scheduledFor', due_strategy.next_scout_at),
      least(due_strategy.cost_limit, due_strategy.daily_cost_limit)
    ) on conflict (workspace_id, idempotency_key) do nothing
    returning id into workflow_id;
    if workflow_id is not null then
      insert into public.automation_stage_runs (workspace_id, workflow_run_id, stage, input_snapshot)
      values (due_strategy.workspace_id, workflow_id, 'source_scout', jsonb_build_object('strategyId', due_strategy.id));
      dispatched := dispatched + 1;
    end if;
    update public.discovery_coverage_profiles
    set next_scout_at = now() + scout_interval
    where id = due_strategy.id;
    exit when dispatched >= greatest(0, least(p_limit, 50));
  end loop;

  for due_job in
    select job.*, source.name as source_name, strategy.daily_cost_limit,
      strategy.monitor_hour, strategy.timezone as strategy_timezone
    from public.discovery_jobs as job
    join public.source_registry as source
      on source.workspace_id = job.workspace_id and source.id = job.source_id
    join public.discovery_coverage_profiles as strategy
      on strategy.workspace_id = job.workspace_id and strategy.id = job.coverage_profile_id
    where job.archived_at is null and job.enabled and job.cadence = 'weekdays'
      and job.next_run_at <= now()
      and source.enabled and source.schedule_enabled
      and strategy.status = 'active' and strategy.automation_enabled
    order by job.next_run_at
    for update of job skip locked
    limit greatest(0, least(p_limit - dispatched, 50))
  loop
    scheduled_for := due_job.next_run_at;
    insert into public.automation_workflow_runs (
      workspace_id, kind, coverage_profile_id, source_id, trigger_kind,
      idempotency_key, current_stage, search_plan_snapshot, cost_limit
    ) values (
      due_job.workspace_id, 'source_monitor', due_job.coverage_profile_id, due_job.source_id,
      'scheduled', 'source-monitor:' || due_job.id || ':' || extract(epoch from scheduled_for)::bigint,
      'source_monitor', jsonb_build_object('jobId', due_job.id, 'sourceId', due_job.source_id, 'scheduledFor', scheduled_for),
      least(due_job.estimated_cost_limit, due_job.daily_cost_limit)
    ) on conflict (workspace_id, idempotency_key) do nothing
    returning id into workflow_id;
    if workflow_id is not null then
      insert into public.automation_stage_runs (workspace_id, workflow_run_id, stage, input_snapshot)
      values (due_job.workspace_id, workflow_id, 'source_monitor', jsonb_build_object('jobId', due_job.id, 'sourceId', due_job.source_id));
      dispatched := dispatched + 1;
    end if;
    scheduled_for := private.next_weekday_at(now(), due_job.strategy_timezone, due_job.monitor_hour);
    update public.discovery_jobs set last_run_at = now(), next_run_at = scheduled_for where id = due_job.id;
    update public.source_registry set last_run_at = now(), next_run_at = scheduled_for where id = due_job.source_id;
    exit when dispatched >= greatest(0, least(p_limit, 50));
  end loop;
  return dispatched;
end;
$$;

create or replace function public.claim_automation_stage(p_worker_id text, p_lease_seconds integer default 90)
returns setof public.automation_stage_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed public.automation_stage_runs%rowtype;
begin
  update public.automation_stage_runs
  set status = 'failed', stop_reason = 'lease_expired', error_code = 'lease_expired',
      failure_reason = 'The worker lease expired before completion.', finished_at = now(),
      lease_token = null, leased_by = null, leased_until = null
  where status = 'running' and leased_until < now();

  select stage.* into claimed
  from public.automation_stage_runs as stage
  join public.automation_workflow_runs as workflow on workflow.id = stage.workflow_run_id
  join public.discovery_coverage_profiles as strategy on strategy.id = workflow.coverage_profile_id
  where stage.status in ('queued', 'failed')
    and stage.available_at <= now()
    and stage.attempt <= 4
    and workflow.status in ('queued', 'running')
    and strategy.automation_enabled
  order by stage.available_at, stage.created_at
  for update of stage skip locked
  limit 1;

  if claimed.id is null then return; end if;

  update public.automation_stage_runs
  set status = 'running', lease_token = gen_random_uuid(), leased_by = left(p_worker_id, 120),
      leased_until = now() + make_interval(secs => greatest(15, least(300, p_lease_seconds))),
      started_at = coalesce(started_at, now())
  where id = claimed.id returning * into claimed;
  update public.automation_workflow_runs
  set status = 'running', current_stage = claimed.stage, started_at = coalesce(started_at, now())
  where id = claimed.workflow_run_id;
  return next claimed;
end;
$$;

create or replace function public.complete_automation_stage(
  p_stage_run_id uuid,
  p_lease_token uuid,
  p_output jsonb,
  p_usage jsonb,
  p_estimated_cost numeric,
  p_next_stage public.automation_stage default null,
  p_terminal_status public.automation_workflow_status default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.automation_stage_runs%rowtype;
begin
  select * into target from public.automation_stage_runs where id = p_stage_run_id for update;
  if not found or target.status <> 'running' or target.lease_token <> p_lease_token or target.leased_until < now() then
    raise exception 'active stage lease required' using errcode = '40001';
  end if;
  update public.automation_stage_runs
  set status = 'succeeded', output_snapshot = coalesce(p_output, '{}'::jsonb),
      usage = coalesce(p_usage, '{}'::jsonb), estimated_cost = greatest(0, coalesce(p_estimated_cost, 0)),
      stop_reason = 'completed', finished_at = now(), lease_token = null, leased_by = null, leased_until = null
  where id = target.id;
  update public.automation_workflow_runs
  set estimated_cost = estimated_cost + greatest(0, coalesce(p_estimated_cost, 0)),
      status = coalesce(p_terminal_status, case when p_next_stage is null then 'succeeded'::public.automation_workflow_status else 'running'::public.automation_workflow_status end),
      current_stage = coalesce(p_next_stage, current_stage),
      stop_reason = case when coalesce(p_terminal_status, 'running') = 'succeeded' then 'completed' else stop_reason end,
      finished_at = case when p_terminal_status is not null then now() else null end
  where id = target.workflow_run_id;
  if p_next_stage is not null then
    insert into public.automation_stage_runs (workspace_id, workflow_run_id, stage, input_snapshot)
    values (target.workspace_id, target.workflow_run_id, p_next_stage, coalesce(p_output, '{}'::jsonb));
  end if;
end;
$$;

create or replace function public.fail_automation_stage(
  p_stage_run_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_failure_reason text,
  p_retryable boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.automation_stage_runs%rowtype;
  next_attempt integer;
begin
  select * into target from public.automation_stage_runs where id = p_stage_run_id for update;
  if not found or target.status <> 'running' or target.lease_token <> p_lease_token then
    raise exception 'active stage lease required' using errcode = '40001';
  end if;
  update public.automation_stage_runs
  set status = 'failed', error_code = left(p_error_code, 80), failure_reason = left(p_failure_reason, 500),
      stop_reason = case when p_retryable then 'retry_scheduled' else 'terminal_error' end,
      finished_at = now(), lease_token = null, leased_by = null, leased_until = null
  where id = target.id;
  next_attempt := target.attempt + 1;
  if p_retryable and next_attempt <= 4 then
    insert into public.automation_stage_runs (
      workspace_id, workflow_run_id, stage, status, attempt, available_at, input_snapshot
    ) values (
      target.workspace_id, target.workflow_run_id, target.stage, 'queued', next_attempt,
      now() + make_interval(secs => power(2, target.attempt)::integer * 60), target.input_snapshot
    );
    update public.automation_workflow_runs set status = 'queued' where id = target.workflow_run_id;
  else
    update public.automation_workflow_runs
    set status = 'failed', error_code = left(p_error_code,80), failure_reason = left(p_failure_reason,500),
        stop_reason = 'terminal_error', finished_at = now()
    where id = target.workflow_run_id;
    insert into public.automation_exceptions (
      workspace_id, workflow_run_id, opportunity_id, source_id, exception_kind, summary, details
    ) select workspace_id, id, opportunity_id, source_id,
      case
        when p_error_code = 'cost_limit' then 'cost_limit'
        when p_error_code in ('authentication','access_denied','policy') then 'policy_failure'
        else 'repeated_failure'
      end,
      'Automation needs operator attention',
      jsonb_build_object('stage', target.stage, 'errorCode', left(p_error_code,80), 'reason', left(p_failure_reason,500))
    from public.automation_workflow_runs where id = target.workflow_run_id;
  end if;
end;
$$;

revoke all on function public.save_lead_strategy(jsonb) from public, anon;
revoke all on function public.review_source_candidate(uuid, text, text) from public, anon;
revoke all on function public.set_lead_automation_enabled(uuid, boolean) from public, anon;
grant execute on function public.save_lead_strategy(jsonb) to authenticated;
grant execute on function public.review_source_candidate(uuid, text, text) to authenticated;
grant execute on function public.set_lead_automation_enabled(uuid, boolean) to authenticated;

revoke all on function public.dispatch_due_automation(integer) from public, anon, authenticated;
revoke all on function public.claim_automation_stage(text, integer) from public, anon, authenticated;
revoke all on function public.complete_automation_stage(uuid, uuid, jsonb, jsonb, numeric, public.automation_stage, public.automation_workflow_status) from public, anon, authenticated;
revoke all on function public.fail_automation_stage(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.dispatch_due_automation(integer) to service_role;
grant usage on schema private to service_role;
grant execute on function private.next_weekday_at(timestamptz, text, integer) to service_role;
grant execute on function public.claim_automation_stage(text, integer) to service_role;
grant execute on function public.complete_automation_stage(uuid, uuid, jsonb, jsonb, numeric, public.automation_stage, public.automation_workflow_status) to service_role;
grant execute on function public.fail_automation_stage(uuid, uuid, text, text, boolean) to service_role;

-- Scheduling is deliberately not activated by this migration. Operators create
-- `app_base_url` and `automation_cron_secret` in Vault, then enable this job in a
-- deployment-specific migration or the Supabase Cron UI:
-- select cron.schedule('yipyip-automation-dispatch', '*/5 * * * *', $$
--   select net.http_post(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/internal/automation/tick',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'automation_cron_secret')),
--     body := jsonb_build_object('triggeredAt', now()), timeout_milliseconds := 5000
--   );
-- $$);
