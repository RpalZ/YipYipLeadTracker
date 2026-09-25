-- Recalibrate commercial fit and add persistent, attributable Lead review.

alter table public.discovery_coverage_profiles
  add column minimum_project_budget_eur numeric(12,2) not null default 30000 check (minimum_project_budget_eur >= 0),
  add column preferred_budget_min_eur numeric(12,2) not null default 50000 check (preferred_budget_min_eur >= minimum_project_budget_eur),
  add column preferred_budget_max_eur numeric(12,2) not null default 100000 check (preferred_budget_max_eur >= preferred_budget_min_eur),
  add column large_project_review_eur numeric(12,2) not null default 250000 check (large_project_review_eur >= preferred_budget_max_eur);

alter table public.assessments
  add column commercial_fit jsonb not null default jsonb_build_object(
    'budgetEvidenceStatus', 'unknown',
    'totalProjectValueEur', null,
    'addressableScopeValueEur', null,
    'addressableScopeStatus', 'unknown',
    'confidence', 0,
    'evidenceRefs', jsonb_build_array(),
    'explanation', 'Commercial fit was not captured by this historical assessment.'
  ) check (jsonb_typeof(commercial_fit) = 'object');

alter table public.automation_exceptions
  drop constraint automation_exceptions_exception_kind_check,
  add constraint automation_exceptions_exception_kind_check check (exception_kind in (
    'ambiguous_entity', 'low_confidence', 'borderline_score', 'sensitive_sector',
    'unusual_budget', 'partner_required', 'conflicting_evidence', 'commercial_fit_uncertain',
    'policy_failure', 'cost_limit', 'repeated_failure'
  ));

update public.score_policies set status = 'retired' where status = 'active';
insert into public.score_policies (
  workspace_id, version, status, weights, thresholds, hard_rules,
  tie_breakers, effective_at
)
select workspace.id, '2026-09-24.2', 'active',
  '{"Social impact":0.12,"Technical fit":0.16,"Budget fit":0.16,"Timing fit":0.13,"Availability":0.10,"Delivery fit":0.16,"Commercial access":0.10,"Evidence confidence":0.07}'::jsonb,
  '{"firstThreshold":58,"finalThreshold":72,"reviewBand":[66,76],"confidenceFloor":0.62,"minimumDimensionScore":{"Budget fit":6,"Delivery fit":6},"minimumDimensionConfidence":{"Budget fit":0.65,"Delivery fit":0.65},"commercialThresholdsSource":"lead_strategy"}'::jsonb,
  '[{"code":"below_minimum_budget","source":"lead_strategy"}]'::jsonb,
  '["freshness","confidence","commercial_access","delivery_fit"]'::jsonb,
  now()
from public.workspaces as workspace
on conflict (workspace_id, version) do update
set status = 'active';

create unique index score_policies_one_active_idx
  on public.score_policies (workspace_id) where status = 'active';

alter table public.leads
  add constraint leads_workspace_id_id_key unique (workspace_id, id),
  add constraint leads_workspace_opportunity_version_key unique (workspace_id, opportunity_id, version);

alter table public.review_events
  add column idempotency_key text not null default gen_random_uuid()::text,
  drop constraint review_events_opportunity_id_fkey,
  drop constraint review_events_lead_id_fkey,
  add constraint review_events_workspace_opportunity_fkey
    foreign key (workspace_id, opportunity_id) references public.opportunities(workspace_id, id) on delete cascade,
  add constraint review_events_workspace_lead_fkey
    foreign key (workspace_id, lead_id) references public.leads(workspace_id, id) on delete cascade,
  add constraint review_events_decision_check check (decision in ('pursue','pass','request_research','route_changed')),
  add constraint review_events_workspace_idempotency_key unique (workspace_id, idempotency_key);

drop policy "reviewers can insert review events" on public.review_events;
create policy "authorized reviewers can insert review events" on public.review_events
for insert to authenticated with check (
  reviewer_id = (select auth.uid())
  and (
    (select private.has_workspace_role(workspace_id, array['owner', 'reviewer']::public.workspace_role[]))
    or (
      decision = 'request_research'
      and (select private.has_workspace_role(workspace_id, array['operator']::public.workspace_role[]))
    )
  )
);

create or replace function public.ensure_current_score_policy(
  p_workspace_id uuid,
  p_version text,
  p_weights jsonb,
  p_thresholds jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  policy_id uuid;
begin
  update public.score_policies
  set status = 'retired'
  where workspace_id = p_workspace_id and status = 'active' and version <> p_version;

  insert into public.score_policies (
    workspace_id, version, status, weights, thresholds, hard_rules,
    tie_breakers, effective_at
  ) values (
    p_workspace_id, p_version, 'active', p_weights, p_thresholds,
    '[{"code":"below_minimum_budget","source":"lead_strategy"}]'::jsonb,
    '["freshness","confidence","commercial_access","delivery_fit"]'::jsonb,
    now()
  )
  on conflict (workspace_id, version) do nothing
  returning id into policy_id;
  if policy_id is null then
    select id into policy_id from public.score_policies
    where workspace_id = p_workspace_id and version = p_version
      and weights = p_weights and thresholds = p_thresholds;
    if policy_id is null then
      raise exception 'score policy version already exists with different immutable content' using errcode = '23505';
    end if;
    update public.score_policies set status = 'active' where id = policy_id;
  end if;
  return policy_id;
end;
$$;

create or replace function public.create_qualified_lead_version(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_final_assessment_id uuid,
  p_why_now text,
  p_suggested_next_action text,
  p_route public.lead_route,
  p_review_record jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_id uuid;
  next_version integer;
  lead_id uuid;
begin
  select id into existing_id
  from public.leads
  where workspace_id = p_workspace_id and opportunity_id = p_opportunity_id
    and final_assessment_id = p_final_assessment_id
  order by version desc limit 1;
  if existing_id is not null then return existing_id; end if;

  perform 1 from public.opportunities
  where workspace_id = p_workspace_id and id = p_opportunity_id
  for update;
  if not found then raise exception 'workspace Opportunity not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.assessments
    where workspace_id = p_workspace_id and id = p_final_assessment_id
      and opportunity_id = p_opportunity_id and assessment_type = 'final'
  ) then
    raise exception 'matching final Assessment required' using errcode = '23503';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.leads
  where workspace_id = p_workspace_id and opportunity_id = p_opportunity_id;

  insert into public.leads (
    workspace_id, opportunity_id, final_assessment_id, why_now,
    suggested_next_action, route, status, review_record, version
  ) values (
    p_workspace_id, p_opportunity_id, p_final_assessment_id, p_why_now,
    p_suggested_next_action, p_route, 'in_review', coalesce(p_review_record, '{}'::jsonb), next_version
  ) returning id into lead_id;
  return lead_id;
end;
$$;

create or replace function public.review_lead(
  p_lead_id uuid,
  p_expected_version integer,
  p_action text,
  p_reason_code text default null,
  p_notes text default null,
  p_route public.lead_route default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target public.leads%rowtype;
  current_version integer;
  event_id uuid := gen_random_uuid();
  workflow_id uuid;
  profile_id uuid;
  event_key text := coalesce(nullif(trim(p_idempotency_key), ''), gen_random_uuid()::text);
  normalized_reason text := nullif(trim(p_reason_code), '');
  normalized_notes text := nullif(trim(p_notes), '');
  changes jsonb;
begin
  select * into target from public.leads where id = p_lead_id for update;
  if target.id is null then raise exception 'Lead not found' using errcode = 'P0002'; end if;

  if exists (
    select 1 from public.review_events
    where workspace_id = target.workspace_id and idempotency_key = event_key
  ) then
    select jsonb_build_object(
      'eventId', id,
      'leadId', target.id,
      'status', target.status,
      'route', target.route,
      'workflowId', public.review_events.changes ->> 'workflowId'
    ) into changes
    from public.review_events
    where workspace_id = target.workspace_id and idempotency_key = event_key;
    return changes;
  end if;

  select max(version) into current_version from public.leads
  where workspace_id = target.workspace_id and opportunity_id = target.opportunity_id;
  if target.version <> p_expected_version or target.version <> current_version then
    raise exception 'Lead version is stale' using errcode = '40001';
  end if;
  if p_action not in ('pursue','pass','request_research','route_changed') then
    raise exception 'unsupported Lead review action' using errcode = '22023';
  end if;
  if p_action = 'request_research' then
    if actor_id is null or not (select private.has_workspace_role(target.workspace_id, array['owner','operator','reviewer']::public.workspace_role[])) then
      raise exception 'review role required' using errcode = '42501';
    end if;
  elsif actor_id is null or not (select private.has_workspace_role(target.workspace_id, array['owner','reviewer']::public.workspace_role[])) then
    raise exception 'owner or reviewer role required' using errcode = '42501';
  end if;
  if p_action in ('pass','request_research','route_changed') and normalized_reason is null then
    raise exception 'reason code required' using errcode = '22023';
  end if;
  if normalized_reason is not null and normalized_reason not in (
    'poor_fit','budget','timing','no_access','scope','contact','delivery_route',
    'partner_fit','capacity','conflicting_evidence','stale','duplicate','smoke_test','other'
  ) then
    raise exception 'unsupported reason code' using errcode = '22023';
  end if;
  if normalized_reason = 'other' and normalized_notes is null then
    raise exception 'notes are required for the other reason' using errcode = '22023';
  end if;
  if p_action = 'route_changed' and p_route is null then
    raise exception 'route required' using errcode = '22023';
  end if;

  if p_action = 'pursue' then
    update public.leads set status = 'approved', updated_at = now() where id = target.id;
  elsif p_action = 'pass' then
    update public.leads set status = 'rejected', updated_at = now() where id = target.id;
  elsif p_action = 'route_changed' then
    update public.leads set route = p_route, updated_at = now() where id = target.id;
  else
    select id into profile_id
    from public.discovery_coverage_profiles
    where workspace_id = target.workspace_id and profile_key = 'lead-strategy'
      and status = 'active' and automation_enabled
    order by version desc limit 1;
    if profile_id is null then raise exception 'active Lead Strategy required' using errcode = 'P0002'; end if;

    select id into workflow_id
    from public.automation_workflow_runs
    where workspace_id = target.workspace_id and opportunity_id = target.opportunity_id
      and kind = 'opportunity_qualification' and status in ('queued','running')
    order by created_at limit 1;
    if workflow_id is null then
      insert into public.automation_workflow_runs (
        workspace_id, kind, coverage_profile_id, opportunity_id, trigger_kind,
        idempotency_key, current_stage, search_plan_snapshot, cost_limit
      ) values (
        target.workspace_id, 'opportunity_qualification', profile_id, target.opportunity_id,
        'review_request', 'lead-research:' || target.id || ':' || event_key,
        'first_assessment', jsonb_build_object(
          'leadId', target.id, 'leadVersion', target.version,
          'requestedBy', actor_id, 'requestedAt', now(), 'reasonCode', normalized_reason
        ), 0.75
      ) returning id into workflow_id;
      insert into public.automation_stage_runs (workspace_id, workflow_run_id, stage, input_snapshot)
      values (
        target.workspace_id, workflow_id, 'first_assessment',
        jsonb_build_object('opportunityId', target.opportunity_id, 'leadId', target.id)
      );
    end if;
  end if;

  select jsonb_build_object(
    'previousStatus', target.status,
    'currentStatus', case when p_action = 'pursue' then 'approved' when p_action = 'pass' then 'rejected' else target.status::text end,
    'previousRoute', target.route,
    'currentRoute', coalesce(p_route, target.route),
    'workflowId', workflow_id
  ) into changes;

  insert into public.review_events (
    id, workspace_id, opportunity_id, lead_id, reviewer_id,
    decision, reason_code, notes, changes, idempotency_key
  ) values (
    event_id, target.workspace_id, target.opportunity_id, target.id, actor_id,
    p_action, normalized_reason, normalized_notes, changes, event_key
  );

  update public.leads
  set review_record = jsonb_build_object(
    'lastDecision', p_action, 'reasonCode', normalized_reason, 'notes', normalized_notes,
    'reviewedBy', actor_id, 'reviewedAt', now(), 'workflowId', workflow_id
  ), updated_at = now()
  where id = target.id;

  return jsonb_build_object(
    'eventId', event_id, 'leadId', target.id,
    'status', case when p_action = 'pursue' then 'approved' when p_action = 'pass' then 'rejected' else target.status::text end,
    'route', coalesce(p_route, target.route), 'workflowId', workflow_id
  );
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
  minimum_budget numeric := greatest(0, coalesce((p_strategy ->> 'minimumProjectBudgetEur')::numeric, 30000));
  preferred_min numeric := greatest(0, coalesce((p_strategy ->> 'preferredBudgetMinEur')::numeric, 50000));
  preferred_max numeric := greatest(0, coalesce((p_strategy ->> 'preferredBudgetMaxEur')::numeric, 100000));
  large_review numeric := greatest(0, coalesce((p_strategy ->> 'largeProjectReviewEur')::numeric, 250000));
begin
  if actor_id is null or not (select private.has_workspace_role(target_workspace, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;
  if preferred_min < minimum_budget or preferred_max < preferred_min or large_review < preferred_max then
    raise exception 'budget limits must increase from minimum through preferred and large-project review thresholds' using errcode = '22023';
  end if;

  select * into previous from public.discovery_coverage_profiles
  where workspace_id = target_workspace and profile_key = 'lead-strategy' and status = 'active' for update;
  select coalesce(max(version), 0) + 1 into next_version from public.discovery_coverage_profiles
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
    activated_at, next_scout_at, created_by, changed_by, change_note,
    minimum_project_budget_eur, preferred_budget_min_eur, preferred_budget_max_eur,
    large_project_review_eur
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
    next_version, now(), now(), now() + interval '30 days', actor_id, actor_id,
    'Lead Strategy saved and Source Scout queued', minimum_budget, preferred_min,
    preferred_max, large_review
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

drop function public.queue_source_monitor_now(uuid);
create function public.queue_source_monitor_now(
  p_source_id uuid,
  p_result_limit_override integer default null,
  p_cost_limit_override numeric default null
)
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
  effective_result_limit integer;
  effective_cost_limit numeric;
begin
  select workspace_id into target_workspace from public.source_registry where id = p_source_id;
  if target_workspace is null then raise exception 'enabled approved source monitor not found' using errcode = 'P0002'; end if;
  if actor_id is null or not (select private.has_workspace_role(target_workspace, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;
  select source.workspace_id, source.id as source_id, job.id as job_id,
         job.coverage_profile_id, job.estimated_cost_limit, job.result_limit,
         profile.version as strategy_version
  into target
  from public.source_registry as source
  join public.discovery_jobs as job on job.workspace_id = source.workspace_id and job.source_id = source.id
  join public.discovery_coverage_profiles as profile on profile.workspace_id = job.workspace_id and profile.id = job.coverage_profile_id
  where source.id = p_source_id and source.enabled and source.schedule_enabled and source.approved_at is not null
    and job.enabled and job.archived_at is null and profile.status = 'active' and profile.automation_enabled
  order by job.version desc limit 1 for update of source, job;
  if target.source_id is null then raise exception 'enabled approved source monitor not found' using errcode = 'P0002'; end if;

  effective_result_limit := coalesce(p_result_limit_override, target.result_limit);
  effective_cost_limit := coalesce(p_cost_limit_override, target.estimated_cost_limit);
  if effective_result_limit < 1 or effective_result_limit > target.result_limit then
    raise exception 'result override may only reduce the configured limit' using errcode = '22023';
  end if;
  if effective_cost_limit <= 0 or effective_cost_limit > target.estimated_cost_limit then
    raise exception 'cost override may only reduce the configured limit' using errcode = '22023';
  end if;
  select id into existing_id from public.automation_workflow_runs
  where source_id = p_source_id and kind = 'source_monitor' and status in ('queued', 'running')
  order by created_at limit 1;
  if existing_id is not null then return existing_id; end if;

  insert into public.automation_workflow_runs (
    workspace_id, kind, coverage_profile_id, source_id, trigger_kind,
    idempotency_key, current_stage, search_plan_snapshot, cost_limit
  ) values (
    target.workspace_id, 'source_monitor', target.coverage_profile_id, target.source_id,
    'operator_test', 'operator-test:' || target.source_id || ':' || gen_random_uuid(),
    'source_monitor', jsonb_build_object(
      'jobId', target.job_id, 'sourceId', target.source_id,
      'strategyVersion', target.strategy_version, 'requestedBy', actor_id,
      'requestedAt', now(), 'resultLimitOverride', effective_result_limit,
      'costLimitOverride', effective_cost_limit
    ), effective_cost_limit
  ) returning id into workflow_id;
  insert into public.automation_stage_runs (workspace_id, workflow_run_id, stage, input_snapshot)
  values (
    target.workspace_id, workflow_id, 'source_monitor',
    jsonb_build_object('jobId', target.job_id, 'sourceId', target.source_id, 'resultLimitOverride', effective_result_limit)
  );
  return workflow_id;
end;
$$;

create or replace view public.opportunity_dashboard
with (security_invoker = true)
as
select
  opportunity.id, opportunity.workspace_id, organization.name as organization,
  opportunity.title, opportunity.description, opportunity.maturity_stage,
  opportunity.lifecycle_status, opportunity.technical_scope, opportunity.budget,
  opportunity.missing_fields, organization.metadata ->> 'location' as location,
  opportunity.resolution_metadata ->> 'contact_hint' as contact_hint,
  coalesce(signal_summary.first_seen_at, opportunity.created_at) as first_seen_at,
  coalesce(signal_summary.signal_count, 0)::integer as signal_count,
  signal_summary.primary_signal_type, assessment.overall_score as score,
  assessment.overall_confidence as confidence, assessment.assessed_at as last_assessed_at,
  assessment.dimension_results as dimensions,
  coalesce(lead.route::text,
    case assessment.delivery_route when 'direct' then 'direct' when 'partner' then 'partner'
      when 'consortium' then 'partner' when 'unsuitable' then 'unsuitable' else 'monitor' end) as route,
  coalesce(lead.why_now, opportunity.resolution_metadata ->> 'why_now') as why_now,
  lead.suggested_next_action, opportunity.updated_at,
  coalesce(signal_summary.evidence, '[]'::jsonb) as evidence,
  assessment.commercial_fit,
  lead.id as lead_id, lead.version as lead_version, lead.status as lead_status,
  lead.review_record,
  exists (
    select 1 from public.automation_workflow_runs as workflow
    where workflow.workspace_id = opportunity.workspace_id
      and workflow.opportunity_id = opportunity.id
      and workflow.kind = 'opportunity_qualification'
      and workflow.trigger_kind = 'review_request'
      and workflow.status in ('queued','running')
  ) as lead_research_pending
from public.opportunities as opportunity
join public.organizations as organization
  on organization.id = opportunity.organization_id and organization.workspace_id = opportunity.workspace_id
left join lateral (
  select count(*) as signal_count, min(signal.captured_at) as first_seen_at,
    (array_agg(signal.signal_type::text order by coalesce(signal.published_at, signal.captured_at) desc))[1] as primary_signal_type,
    jsonb_agg(jsonb_build_object(
      'id',signal.id,'title',signal.title,'publisher',coalesce(signal.publisher,'Unknown publisher'),
      'url',signal.canonical_url,'publishedAt',coalesce(signal.published_at,signal.captured_at),
      'type',signal.signal_type::text,'status',coalesce(signal.processing_metadata ->> 'provenance_status','unknown'),
      'excerpt',signal.raw_text
    ) order by coalesce(signal.published_at,signal.captured_at) desc) as evidence
  from public.opportunity_signals as link
  join public.signals as signal on signal.id = link.signal_id and signal.workspace_id = link.workspace_id
  where link.opportunity_id = opportunity.id and link.workspace_id = opportunity.workspace_id
) as signal_summary on true
left join lateral (
  select candidate.overall_score, candidate.overall_confidence, candidate.assessed_at,
    candidate.dimension_results, candidate.delivery_route, candidate.commercial_fit
  from public.assessments as candidate
  where candidate.opportunity_id = opportunity.id and candidate.workspace_id = opportunity.workspace_id
  order by candidate.assessed_at desc limit 1
) as assessment on true
left join lateral (
  select candidate.id, candidate.version, candidate.status, candidate.route,
    candidate.why_now, candidate.suggested_next_action, candidate.review_record
  from public.leads as candidate
  where candidate.opportunity_id = opportunity.id and candidate.workspace_id = opportunity.workspace_id
  order by candidate.version desc, candidate.created_at desc limit 1
) as lead on true;

revoke insert, update on public.leads from authenticated;
revoke all on function public.ensure_current_score_policy(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ensure_current_score_policy(uuid, text, jsonb, jsonb) to service_role;
revoke all on function public.create_qualified_lead_version(uuid, uuid, uuid, text, text, public.lead_route, jsonb) from public, anon, authenticated;
grant execute on function public.create_qualified_lead_version(uuid, uuid, uuid, text, text, public.lead_route, jsonb) to service_role;
revoke all on function public.review_lead(uuid, integer, text, text, text, public.lead_route, text) from public, anon;
grant execute on function public.review_lead(uuid, integer, text, text, text, public.lead_route, text) to authenticated;
revoke all on function public.queue_source_monitor_now(uuid, integer, numeric) from public, anon;
grant execute on function public.queue_source_monitor_now(uuid, integer, numeric) to authenticated;
grant select on public.opportunity_dashboard to authenticated;
