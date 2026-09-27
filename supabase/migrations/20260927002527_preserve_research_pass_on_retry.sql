-- Keep pass (research iteration) independent from attempt (failure retry).
-- Do not swallow uniqueness failures: they protect completed work from duplication.
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
      workspace_id, workflow_run_id, stage, status, attempt, pass, available_at, input_snapshot
    ) values (
      target.workspace_id, target.workflow_run_id, target.stage, 'queued', next_attempt, target.pass,
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
revoke all on function public.fail_automation_stage(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.fail_automation_stage(uuid, uuid, text, text, boolean) to service_role;

-- Repair only unstarted queued retries with one unambiguous original input.
-- Completed/failed rows remain historical evidence. Running workflows, ambiguous
-- origins and occupied identities are deliberately left untouched. This never
-- runs a worker, changes a budget, or resets attempts/backoff.
do $$
declare repair record;
begin
  -- The CLI may submit statements separately; keep this lock inside the DO
  -- transaction so it covers the entire repair on every migration runner.
  lock table public.automation_stage_runs in share row exclusive mode;
  for repair in
    select queued.id, min(origin.pass) as correct_pass
    from public.automation_stage_runs queued
    join public.automation_workflow_runs workflow on workflow.id = queued.workflow_run_id
    join public.automation_stage_runs origin
      on origin.workflow_run_id = queued.workflow_run_id
      and origin.stage = queued.stage and origin.attempt = 1
      and origin.input_snapshot = queued.input_snapshot
      and origin.created_at <= queued.created_at
    where queued.status = 'queued' and queued.pass = 1 and queued.attempt > 1
      and queued.started_at is null and workflow.status = 'queued'
      and not exists (
        select 1 from public.automation_stage_runs running
        where running.workflow_run_id = queued.workflow_run_id and running.status = 'running'
      )
    group by queued.id
    having count(*) = 1
      and bool_and(origin.pass > 1 and origin.status = 'failed' and origin.stop_reason = 'retry_scheduled')
  loop
    update public.automation_stage_runs queued set pass = repair.correct_pass
    where queued.id = repair.id and not exists (
      select 1 from public.automation_stage_runs occupied
      where occupied.workflow_run_id = queued.workflow_run_id
        and occupied.stage = queued.stage and occupied.pass = repair.correct_pass
        and occupied.attempt = queued.attempt
    );
    if found then
      raise notice 'Corrected queued retry % to pass %; history and attempt retained', repair.id, repair.correct_pass;
    end if;
  end loop;
end;
$$;
