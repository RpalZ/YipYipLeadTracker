-- Live operator controls and bounded research continuation for the autonomous MVP.

alter table public.automation_workflow_runs
  drop constraint automation_workflow_runs_trigger_kind_check,
  add constraint automation_workflow_runs_trigger_kind_check
    check (trigger_kind in (
      'strategy_activation', 'strategy_change', 'scheduled', 'source_approval',
      'signal_created', 'retry', 'operator_test', 'review_request'
    ));

alter table public.automation_stage_runs
  add column pass smallint not null default 1 check (pass between 1 and 3),
  drop constraint automation_stage_runs_workflow_run_id_stage_attempt_key,
  add constraint automation_stage_runs_workflow_stage_pass_attempt_key
    unique (workflow_run_id, stage, pass, attempt);

create unique index automation_workflow_runs_one_active_source_monitor_idx
  on public.automation_workflow_runs (source_id)
  where kind = 'source_monitor' and status in ('queued', 'running');

create unique index automation_workflow_runs_one_active_qualification_idx
  on public.automation_workflow_runs (opportunity_id)
  where kind = 'opportunity_qualification' and status in ('queued', 'running');

create unique index automation_workflow_runs_one_active_source_scout_idx
  on public.automation_workflow_runs (coverage_profile_id)
  where kind = 'source_scout' and status in ('queued', 'running');

create or replace function public.create_workspace_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_name text := trim(p_name);
  workspace_id uuid;
  workspace_slug text;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if clean_name = '' or length(clean_name) > 80 then
    raise exception 'workspace name must contain 1 to 80 characters' using errcode = '22023';
  end if;
  workspace_slug := trim(both '-' from regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g'));
  if workspace_slug = '' then workspace_slug := 'workspace'; end if;
  workspace_slug := left(workspace_slug, 48) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  insert into public.workspaces (name, slug)
  values (clean_name, workspace_slug)
  returning id into workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (workspace_id, actor_id, 'owner');

  return workspace_id;
end;
$$;

revoke all on function public.create_workspace_with_owner(text) from public, anon;
grant execute on function public.create_workspace_with_owner(text) to authenticated;

create or replace function private.relink_sources_to_current_strategy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_key <> 'lead-strategy' or new.status <> 'active' then
    return new;
  end if;

  update public.discovery_coverage_profiles
  set automation_enabled = false
  where workspace_id = new.workspace_id
    and id <> new.id
    and profile_key = 'lead-strategy'
    and status = 'archived';

  update public.automation_stage_runs as stage
  set status = 'skipped', stop_reason = 'strategy_superseded', finished_at = now()
  from public.automation_workflow_runs as workflow
  where stage.workflow_run_id = workflow.id
    and workflow.workspace_id = new.workspace_id
    and workflow.coverage_profile_id <> new.id
    and workflow.status = 'queued'
    and stage.status = 'queued';

  update public.automation_workflow_runs
  set status = 'cancelled', stop_reason = 'strategy_superseded', finished_at = now()
  where workspace_id = new.workspace_id
    and coverage_profile_id <> new.id
    and status = 'queued';

  insert into public.coverage_profile_sources (
    workspace_id, coverage_profile_id, source_id, source_candidate_id,
    signal_areas, link_rationale, linked_by
  )
  select distinct on (mapping.source_id)
    new.workspace_id, new.id, mapping.source_id, null,
    new.signal_areas, 'Carried forward to Lead Strategy version ' || new.version,
    new.changed_by
  from public.coverage_profile_sources as mapping
  join public.source_registry as source on source.id = mapping.source_id
  where mapping.workspace_id = new.workspace_id
    and mapping.coverage_profile_id <> new.id
    and source.approved_at is not null
  order by mapping.source_id, mapping.created_at desc
  on conflict (coverage_profile_id, source_id) do nothing;

  update public.discovery_jobs
  set coverage_profile_id = new.id,
      changed_by = new.changed_by,
      version = version + 1,
      search_plan_template = jsonb_build_object(
        'strategyId', new.id,
        'strategyVersion', new.version,
        'signalAreas', new.signal_areas,
        'regions', new.regions,
        'languages', new.languages,
        'projectTypes', new.project_types
      )
  where workspace_id = new.workspace_id
    and source_id is not null
    and archived_at is null;

  return new;
end;
$$;

create trigger discovery_coverage_profiles_relink_sources
after insert on public.discovery_coverage_profiles
for each row execute function private.relink_sources_to_current_strategy();

revoke all on function private.relink_sources_to_current_strategy() from public, anon, authenticated;

create or replace function public.queue_source_monitor_now(p_source_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_workspace uuid;
  target record;
  existing_id uuid;
  workflow_id uuid;
begin
  select workspace_id into target_workspace
  from public.source_registry
  where id = p_source_id;

  if target_workspace is null then
    raise exception 'enabled approved source monitor not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not (select private.has_workspace_role(target_workspace, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;

  select source.workspace_id, source.id as source_id, job.id as job_id,
         job.coverage_profile_id, job.estimated_cost_limit,
         profile.version as strategy_version
  into target
  from public.source_registry as source
  join public.discovery_jobs as job
    on job.workspace_id = source.workspace_id and job.source_id = source.id
  join public.discovery_coverage_profiles as profile
    on profile.workspace_id = job.workspace_id and profile.id = job.coverage_profile_id
  where source.id = p_source_id
    and source.enabled and source.schedule_enabled and source.approved_at is not null
    and job.enabled and job.archived_at is null
    and profile.status = 'active' and profile.automation_enabled
  order by job.version desc
  limit 1
  for update of source, job;

  if target.source_id is null then
    raise exception 'enabled approved source monitor not found' using errcode = 'P0002';
  end if;

  select id into existing_id
  from public.automation_workflow_runs
  where source_id = p_source_id and kind = 'source_monitor' and status in ('queued', 'running')
  order by created_at
  limit 1;
  if existing_id is not null then return existing_id; end if;

  insert into public.automation_workflow_runs (
    workspace_id, kind, coverage_profile_id, source_id, trigger_kind,
    idempotency_key, current_stage, search_plan_snapshot, cost_limit
  ) values (
    target.workspace_id, 'source_monitor', target.coverage_profile_id,
    target.source_id, 'operator_test',
    'operator-test:' || target.source_id || ':' || gen_random_uuid(),
    'source_monitor', jsonb_build_object(
      'jobId', target.job_id,
      'sourceId', target.source_id,
      'strategyVersion', target.strategy_version,
      'requestedBy', actor_id,
      'requestedAt', now()
    ), target.estimated_cost_limit
  ) returning id into workflow_id;

  insert into public.automation_stage_runs (
    workspace_id, workflow_run_id, stage, input_snapshot
  ) values (
    target.workspace_id, workflow_id, 'source_monitor',
    jsonb_build_object('jobId', target.job_id, 'sourceId', target.source_id)
  );
  return workflow_id;
end;
$$;

create or replace function public.review_automation_exception(
  p_exception_id uuid,
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
  target public.automation_exceptions%rowtype;
  profile_id uuid;
  workflow_id uuid;
begin
  select * into target
  from public.automation_exceptions
  where id = p_exception_id
  for update;

  if target.id is null or target.status <> 'open' then
    raise exception 'open automation exception not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not (select private.has_workspace_role(target.workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])) then
    raise exception 'reviewer role required' using errcode = '42501';
  end if;
  if p_decision not in ('research', 'resolved', 'dismissed') then
    raise exception 'unsupported exception decision' using errcode = '22023';
  end if;

  if p_decision = 'research' then
    if target.opportunity_id is null then
      raise exception 'this exception is not linked to an opportunity' using errcode = '22023';
    end if;
    select id into profile_id
    from public.discovery_coverage_profiles
    where workspace_id = target.workspace_id
      and profile_key = 'lead-strategy'
      and status = 'active'
      and automation_enabled
    order by version desc
    limit 1;
    if profile_id is null then
      raise exception 'active Lead Strategy required' using errcode = 'P0002';
    end if;

    select id into workflow_id
    from public.automation_workflow_runs
    where opportunity_id = target.opportunity_id
      and kind = 'opportunity_qualification'
      and status in ('queued', 'running')
    order by created_at
    limit 1;

    if workflow_id is null then
      insert into public.automation_workflow_runs (
        workspace_id, kind, coverage_profile_id, opportunity_id, trigger_kind,
        idempotency_key, current_stage, search_plan_snapshot, cost_limit
      ) values (
        target.workspace_id, 'opportunity_qualification', profile_id,
        target.opportunity_id, 'review_request',
        'exception-research:' || target.id,
        'first_assessment', jsonb_build_object(
          'exceptionId', target.id,
          'requestedBy', actor_id,
          'requestedAt', now()
        ), 0.75
      ) returning id into workflow_id;

      insert into public.automation_stage_runs (
        workspace_id, workflow_run_id, stage, input_snapshot
      ) values (
        target.workspace_id, workflow_id, 'first_assessment',
        jsonb_build_object('opportunityId', target.opportunity_id, 'exceptionId', target.id)
      );
    end if;
  end if;

  update public.automation_exceptions
  set status = case when p_decision = 'dismissed' then 'dismissed' else 'resolved' end,
      resolved_by = actor_id,
      resolved_at = now(),
      resolution_note = nullif(trim(p_note), '')
  where id = target.id;

  return workflow_id;
end;
$$;

create or replace function public.retry_automation_workflow(p_workflow_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target public.automation_workflow_runs%rowtype;
  failed_stage public.automation_stage_runs%rowtype;
  workflow_id uuid;
begin
  select * into target
  from public.automation_workflow_runs
  where id = p_workflow_id
  for update;

  if target.id is null or target.status <> 'failed' then
    raise exception 'failed automation workflow not found' using errcode = 'P0002';
  end if;
  if actor_id is null or not (select private.has_workspace_role(target.workspace_id, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;

  select * into failed_stage
  from public.automation_stage_runs
  where workflow_run_id = target.id
    and stage = target.current_stage
  order by pass desc, attempt desc, created_at desc
  limit 1;

  insert into public.automation_workflow_runs (
    workspace_id, kind, coverage_profile_id, source_id, opportunity_id,
    trigger_kind, idempotency_key, current_stage, search_plan_snapshot, cost_limit
  ) values (
    target.workspace_id, target.kind, target.coverage_profile_id, target.source_id,
    target.opportunity_id, 'retry',
    'retry:' || target.id || ':' || gen_random_uuid(), target.current_stage,
    target.search_plan_snapshot || jsonb_build_object(
      'retriedWorkflowId', target.id,
      'requestedBy', actor_id,
      'requestedAt', now()
    ), target.cost_limit
  ) returning id into workflow_id;

  insert into public.automation_stage_runs (
    workspace_id, workflow_run_id, stage, input_snapshot
  ) values (
    target.workspace_id, workflow_id, target.current_stage,
    coalesce(failed_stage.input_snapshot, '{}'::jsonb)
      || jsonb_build_object('retriedWorkflowId', target.id)
  );
  return workflow_id;
end;
$$;

create policy "reviewers can enqueue requested qualification workflows"
on public.automation_workflow_runs for insert to authenticated
with check (
  trigger_kind = 'review_request'
  and kind = 'opportunity_qualification'
  and (select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[]))
);

create policy "reviewers can enqueue requested qualification stages"
on public.automation_stage_runs for insert to authenticated
with check (
  stage = 'first_assessment'
  and (select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[]))
  and exists (
    select 1 from public.automation_workflow_runs as workflow
    where workflow.id = workflow_run_id
      and workflow.workspace_id = automation_stage_runs.workspace_id
      and workflow.trigger_kind = 'review_request'
  )
);

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
    workflow_id := null;
    begin
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
    exception when unique_violation then
      workflow_id := null;
    end;
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
    workflow_id := null;
    scheduled_for := due_job.next_run_at;
    begin
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
    exception when unique_violation then
      workflow_id := null;
    end;
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

create or replace function public.claim_automation_stage(
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns setof public.automation_stage_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expired public.automation_stage_runs%rowtype;
  claimed public.automation_stage_runs%rowtype;
begin
  for expired in
    select * from public.automation_stage_runs
    where status = 'running' and leased_until < now()
    for update skip locked
  loop
    update public.automation_stage_runs
    set status = 'failed', stop_reason = 'lease_expired', error_code = 'lease_expired',
        failure_reason = 'The worker lease expired before completion.', finished_at = now(),
        lease_token = null, leased_by = null, leased_until = null
    where id = expired.id;
    if expired.attempt < 4 then
      insert into public.automation_stage_runs (
        workspace_id, workflow_run_id, stage, status, attempt, pass, available_at, input_snapshot
      ) values (
        expired.workspace_id, expired.workflow_run_id, expired.stage, 'queued',
        expired.attempt + 1, expired.pass, now(), expired.input_snapshot
      ) on conflict do nothing;
      update public.automation_workflow_runs set status = 'queued' where id = expired.workflow_run_id;
    else
      update public.automation_workflow_runs
      set status = 'failed', error_code = 'lease_expired',
          failure_reason = 'The worker lease expired repeatedly.',
          stop_reason = 'terminal_error', finished_at = now()
      where id = expired.workflow_run_id;
      insert into public.automation_exceptions (
        workspace_id, workflow_run_id, opportunity_id, source_id,
        exception_kind, summary, details
      ) select workspace_id, id, opportunity_id, source_id,
        'repeated_failure', 'Automation needs operator attention',
        jsonb_build_object('stage', expired.stage, 'errorCode', 'lease_expired')
      from public.automation_workflow_runs where id = expired.workflow_run_id;
    end if;
  end loop;

  select stage.* into claimed
  from public.automation_stage_runs as stage
  join public.automation_workflow_runs as workflow on workflow.id = stage.workflow_run_id
  join public.discovery_coverage_profiles as strategy on strategy.id = workflow.coverage_profile_id
  where stage.status = 'queued'
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

create or replace function public.claim_workspace_automation_stage(
  p_workspace_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 90
)
returns setof public.automation_stage_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expired public.automation_stage_runs%rowtype;
  claimed public.automation_stage_runs%rowtype;
begin
  for expired in
    select * from public.automation_stage_runs
    where workspace_id = p_workspace_id
      and status = 'running'
      and leased_until < now()
    for update skip locked
  loop
    update public.automation_stage_runs
    set status = 'failed', stop_reason = 'lease_expired', error_code = 'lease_expired',
        failure_reason = 'The worker lease expired before completion.', finished_at = now(),
        lease_token = null, leased_by = null, leased_until = null
    where id = expired.id;
    if expired.attempt < 4 then
      insert into public.automation_stage_runs (
        workspace_id, workflow_run_id, stage, status, attempt, pass, available_at, input_snapshot
      ) values (
        expired.workspace_id, expired.workflow_run_id, expired.stage, 'queued',
        expired.attempt + 1, expired.pass, now(), expired.input_snapshot
      ) on conflict do nothing;
      update public.automation_workflow_runs set status = 'queued' where id = expired.workflow_run_id;
    else
      update public.automation_workflow_runs
      set status = 'failed', error_code = 'lease_expired',
          failure_reason = 'The worker lease expired repeatedly.',
          stop_reason = 'terminal_error', finished_at = now()
      where id = expired.workflow_run_id;
      insert into public.automation_exceptions (
        workspace_id, workflow_run_id, opportunity_id, source_id,
        exception_kind, summary, details
      ) select workspace_id, id, opportunity_id, source_id,
        'repeated_failure', 'Automation needs operator attention',
        jsonb_build_object('stage', expired.stage, 'errorCode', 'lease_expired')
      from public.automation_workflow_runs where id = expired.workflow_run_id;
    end if;
  end loop;

  select stage.* into claimed
  from public.automation_stage_runs as stage
  join public.automation_workflow_runs as workflow on workflow.id = stage.workflow_run_id
  join public.discovery_coverage_profiles as strategy on strategy.id = workflow.coverage_profile_id
  where stage.workspace_id = p_workspace_id
    and stage.status = 'queued'
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
  next_pass smallint;
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
    next_pass := case when p_next_stage = target.stage then target.pass + 1 else 1 end;
    insert into public.automation_stage_runs (
      workspace_id, workflow_run_id, stage, pass, input_snapshot
    ) values (
      target.workspace_id, target.workflow_run_id, p_next_stage, next_pass,
      coalesce(p_output, '{}'::jsonb)
    );
  end if;
end;
$$;

revoke all on function public.queue_source_monitor_now(uuid) from public, anon;
grant execute on function public.queue_source_monitor_now(uuid) to authenticated;
revoke all on function public.review_automation_exception(uuid, text, text) from public, anon;
grant execute on function public.review_automation_exception(uuid, text, text) to authenticated;
revoke all on function public.retry_automation_workflow(uuid) from public, anon;
grant execute on function public.retry_automation_workflow(uuid) to authenticated;
revoke all on function public.claim_workspace_automation_stage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.claim_workspace_automation_stage(uuid, text, integer) to service_role;
