-- Separate qualification-exception resolution from Lead pursuit decisions.
-- This RPC keeps the Opportunity lifecycle, exception resolution, optional
-- reassessment queue, and immutable human event in one short transaction.

create function public.resolve_opportunity_attention(
  p_opportunity_id uuid,
  p_exception_id uuid,
  p_action text,
  p_reason_code text,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target public.opportunities%rowtype;
  target_exception public.automation_exceptions%rowtype;
  profile_id uuid;
  workflow_id uuid;
  event_id uuid := gen_random_uuid();
  event_key text := nullif(trim(p_idempotency_key), '');
  normalized_reason text := nullif(trim(p_reason_code), '');
  normalized_notes text := nullif(trim(p_notes), '');
  changes jsonb;
begin
  select * into target
  from public.opportunities
  where id = p_opportunity_id
  for update;

  if target.id is null then
    raise exception 'Opportunity not found' using errcode = 'P0002';
  end if;

  select * into target_exception
  from public.automation_exceptions
  where id = p_exception_id
    and workspace_id = target.workspace_id
    and opportunity_id = target.id
  for update;

  if target_exception.id is null then
    raise exception 'Opportunity exception not found' using errcode = 'P0002';
  end if;
  if event_key is null then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.review_events
    where workspace_id = target.workspace_id and idempotency_key = event_key
  ) then
    select jsonb_build_object(
      'eventId', event.id,
      'opportunityId', target.id,
      'action', event.decision,
      'workflowId', event.changes ->> 'workflowId',
      'lifecycleStatus', event.changes ->> 'currentLifecycleStatus',
      'replayed', true
    ) into changes
    from public.review_events as event
    where event.workspace_id = target.workspace_id
      and event.idempotency_key = event_key;
    return changes;
  end if;

  if target_exception.status <> 'open' then
    raise exception 'open Opportunity exception not found' using errcode = 'P0002';
  end if;

  if p_action not in ('request_research', 'pass') then
    raise exception 'unsupported Opportunity resolution action' using errcode = '22023';
  end if;
  if normalized_reason is null then
    raise exception 'reason code required' using errcode = '22023';
  end if;
  if normalized_reason not in (
    'poor_fit','budget','timing','no_access','scope','contact','delivery_route',
    'partner_fit','capacity','conflicting_evidence','stale','duplicate','smoke_test','other'
  ) then
    raise exception 'unsupported reason code' using errcode = '22023';
  end if;
  if normalized_reason = 'other' and normalized_notes is null then
    raise exception 'notes are required for the other reason' using errcode = '22023';
  end if;

  if p_action = 'request_research' then
    if actor_id is null or not (
      select private.has_workspace_role(
        target.workspace_id,
        array['owner','operator','reviewer']::public.workspace_role[]
      )
    ) then
      raise exception 'review role required' using errcode = '42501';
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
    where workspace_id = target.workspace_id
      and opportunity_id = target.id
      and kind = 'opportunity_qualification'
      and status in ('queued', 'running')
    order by created_at
    limit 1;

    if workflow_id is null then
      insert into public.automation_workflow_runs (
        workspace_id, kind, coverage_profile_id, opportunity_id, trigger_kind,
        idempotency_key, current_stage, search_plan_snapshot, cost_limit
      ) values (
        target.workspace_id, 'opportunity_qualification', profile_id, target.id,
        'review_request', 'attention-research:' || target_exception.id || ':' || event_key,
        'first_assessment', jsonb_build_object(
          'exceptionId', target_exception.id,
          'requestedBy', actor_id,
          'requestedAt', now(),
          'reasonCode', normalized_reason
        ), 0.75
      ) returning id into workflow_id;

      insert into public.automation_stage_runs (
        workspace_id, workflow_run_id, stage, input_snapshot
      ) values (
        target.workspace_id, workflow_id, 'first_assessment',
        jsonb_build_object(
          'opportunityId', target.id,
          'exceptionId', target_exception.id
        )
      );
    end if;

    update public.opportunities
    set lifecycle_status = 'needs_research'
    where id = target.id;

    update public.automation_exceptions
    set status = 'resolved',
        resolved_by = actor_id,
        resolved_at = now(),
        resolution_note = normalized_notes
    where id = target_exception.id;
  else
    if actor_id is null or not (
      select private.has_workspace_role(
        target.workspace_id,
        array['owner','reviewer']::public.workspace_role[]
      )
    ) then
      raise exception 'owner or reviewer role required' using errcode = '42501';
    end if;

    update public.opportunities
    set lifecycle_status = 'rejected'
    where id = target.id;

    update public.automation_exceptions
    set status = 'dismissed',
        resolved_by = actor_id,
        resolved_at = now(),
        resolution_note = normalized_notes
    where id = target_exception.id;
  end if;

  changes := jsonb_build_object(
    'exceptionId', target_exception.id,
    'exceptionKind', target_exception.exception_kind,
    'previousLifecycleStatus', target.lifecycle_status,
    'currentLifecycleStatus', case
      when p_action = 'request_research' then 'needs_research'
      else 'rejected'
    end,
    'workflowId', workflow_id
  );

  insert into public.review_events (
    id, workspace_id, opportunity_id, reviewer_id, decision,
    reason_code, notes, changes, idempotency_key
  ) values (
    event_id, target.workspace_id, target.id, actor_id, p_action,
    normalized_reason, normalized_notes, changes, event_key
  );

  return jsonb_build_object(
    'eventId', event_id,
    'opportunityId', target.id,
    'action', p_action,
    'workflowId', workflow_id,
    'lifecycleStatus', changes ->> 'currentLifecycleStatus',
    'replayed', false
  );
end;
$$;

revoke all on function public.resolve_opportunity_attention(uuid, uuid, text, text, text, text)
from public, anon;
grant execute on function public.resolve_opportunity_attention(uuid, uuid, text, text, text, text)
to authenticated;

comment on function public.resolve_opportunity_attention(uuid, uuid, text, text, text, text)
is 'Atomically resolves an open Opportunity qualification exception by queuing reassessment or recording a human pass.';
