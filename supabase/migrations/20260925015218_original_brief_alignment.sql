-- Align qualification with the original YipYip brief, preserve evidence-backed
-- outreach on each Lead version, and quarantine historical policy mismatches.

alter table public.discovery_coverage_profiles
  add column hard_excluded_sectors text[] not null default array['gambling','video games','retail/e-commerce','heavy-polluting industry']::text[],
  add column sensitive_sectors text[] not null default array['pharma','unresolved ethical concerns']::text[],
  add column capacity_status text not null default 'unknown'
    check (capacity_status in ('available','limited','unavailable','unknown')),
  add column capacity_effective_until date,
  add column capacity_note text;

alter table public.assessments
  add column qualification_checks jsonb not null default jsonb_build_object(
    'policyVersion', 'historical',
    'allPassed', false,
    'hardRejection', null,
    'checks', '{}'::jsonb,
    'reasons', jsonb_build_array('Not evaluated under original-brief alignment policy.')
  ) check (jsonb_typeof(qualification_checks) = 'object');

alter table public.leads
  add column outreach_draft jsonb
    check (outreach_draft is null or jsonb_typeof(outreach_draft) = 'object');

alter table public.automation_exceptions
  drop constraint automation_exceptions_exception_kind_check,
  add constraint automation_exceptions_exception_kind_check check (exception_kind in (
    'ambiguous_entity', 'low_confidence', 'borderline_score', 'sensitive_sector',
    'unusual_budget', 'partner_required', 'conflicting_evidence', 'commercial_fit_uncertain',
    'contact_route_unresolved', 'qualification_policy_mismatch', 'capability_fit_uncertain',
    'actionability_uncertain', 'outreach_draft_invalid', 'policy_failure', 'cost_limit',
    'repeated_failure'
  ));

create unique index automation_exceptions_one_open_qualification_mismatch_idx
  on public.automation_exceptions (workspace_id, opportunity_id, exception_kind)
  where status = 'open' and exception_kind = 'qualification_policy_mismatch';

update public.score_policies set status = 'retired' where status = 'active';
insert into public.score_policies (
  workspace_id, version, status, weights, thresholds, hard_rules, tie_breakers, effective_at
)
select workspace.id, '2026-09-25.1', 'active',
  '{"Social impact":0.12,"Technical fit":0.16,"Budget fit":0.16,"Timing fit":0.13,"Availability":0.10,"Delivery fit":0.16,"Commercial access":0.10,"Evidence confidence":0.07}'::jsonb,
  '{"firstThreshold":58,"finalThreshold":72,"reviewBand":[66,76],"confidenceFloor":0.62,"minimumDimensionScore":{"Budget fit":6,"Delivery fit":6},"minimumDimensionConfidence":{"Budget fit":0.65,"Delivery fit":0.65},"fitAxis":{"minimumScore":6,"minimumConfidence":0.65},"commercialThresholdsSource":"lead_strategy"}'::jsonb,
  '[{"code":"hard_excluded_sector"},{"code":"expired_without_follow_on"},{"code":"below_minimum_budget"},{"code":"unsupported_capability"}]'::jsonb,
  '["freshness","confidence","commercial_access","delivery_fit"]'::jsonb,
  now()
from public.workspaces as workspace
on conflict (workspace_id, version) do update set status = 'active';

drop function public.create_qualified_lead_version(uuid, uuid, uuid, text, text, public.lead_route, jsonb);
create function public.create_qualified_lead_version(
  p_workspace_id uuid,
  p_opportunity_id uuid,
  p_final_assessment_id uuid,
  p_why_now text,
  p_suggested_next_action text,
  p_route public.lead_route,
  p_outreach_draft jsonb,
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
  final_assessment public.assessments%rowtype;
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

  select * into final_assessment
  from public.assessments
  where workspace_id = p_workspace_id and id = p_final_assessment_id
    and opportunity_id = p_opportunity_id and assessment_type = 'final';
  if final_assessment.id is null then
    raise exception 'matching final Assessment required' using errcode = '23503';
  end if;
  if final_assessment.decision <> 'qualify'
    or final_assessment.rejection_reason is not null
    or coalesce((final_assessment.qualification_checks ->> 'allPassed')::boolean, false) is not true then
    raise exception 'final Assessment did not pass every qualification gate' using errcode = '23514';
  end if;
  if p_outreach_draft is null or jsonb_typeof(p_outreach_draft) <> 'object' then
    raise exception 'citation-valid outreach draft required' using errcode = '23514';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.leads
  where workspace_id = p_workspace_id and opportunity_id = p_opportunity_id;

  insert into public.leads (
    workspace_id, opportunity_id, final_assessment_id, why_now,
    suggested_next_action, route, status, outreach_draft, review_record, version
  ) values (
    p_workspace_id, p_opportunity_id, p_final_assessment_id, p_why_now,
    p_suggested_next_action, p_route, 'in_review', p_outreach_draft,
    coalesce(p_review_record, '{}'::jsonb), next_version
  ) returning id into lead_id;

  update public.automation_exceptions
  set status = 'resolved', resolved_at = now(),
      resolution_note = 'Resolved by a later Assessment that passed the active qualification policy.'
  where workspace_id = p_workspace_id and opportunity_id = p_opportunity_id
    and exception_kind = 'qualification_policy_mismatch' and status = 'open';
  return lead_id;
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
  capacity text := coalesce(nullif(p_strategy ->> 'capacityStatus', ''), 'unknown');
begin
  if actor_id is null or not (select private.has_workspace_role(target_workspace, array['owner','operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;
  if preferred_min < minimum_budget or preferred_max < preferred_min or large_review < preferred_max then
    raise exception 'budget limits must increase from minimum through preferred and large-project review thresholds' using errcode = '22023';
  end if;
  if capacity not in ('available','limited','unavailable','unknown') then
    raise exception 'unsupported capacity status' using errcode = '22023';
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
    hard_excluded_sectors, sensitive_sectors, capacity_status, capacity_effective_until, capacity_note,
    lookback, cadence, result_limit, cost_limit, daily_cost_limit,
    automation_enabled, timezone, monitor_hour, version, effective_at,
    activated_at, next_scout_at, created_by, changed_by, change_note,
    minimum_project_budget_eur, preferred_budget_min_eur, preferred_budget_max_eur, large_project_review_eur
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
    case when jsonb_array_length(coalesce(p_strategy -> 'services', '[]'::jsonb)) > 0 then array(select jsonb_array_elements_text(p_strategy -> 'services')) else array['custom web applications','custom mobile applications','back-end systems','digital platforms','APIs and integrations','high-volume engineering']::text[] end,
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'impactThemes')), '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'keywords')), '{}'::text[]),
    case when jsonb_array_length(coalesce(p_strategy -> 'exclusions', '[]'::jsonb)) > 0 then array(select jsonb_array_elements_text(p_strategy -> 'exclusions')) else array['completed','awarded','closed pitch','unrelated vacancy']::text[] end,
    coalesce(array(select jsonb_array_elements_text(p_strategy -> 'projectClues')), '{}'::text[]),
    case when jsonb_array_length(coalesce(p_strategy -> 'hardExcludedSectors', '[]'::jsonb)) > 0 then array(select jsonb_array_elements_text(p_strategy -> 'hardExcludedSectors')) else array['gambling','video games','retail/e-commerce','heavy-polluting industry']::text[] end,
    case when jsonb_array_length(coalesce(p_strategy -> 'sensitiveSectors', '[]'::jsonb)) > 0 then array(select jsonb_array_elements_text(p_strategy -> 'sensitiveSectors')) else array['pharma','unresolved ethical concerns']::text[] end,
    capacity,
    nullif(p_strategy ->> 'capacityEffectiveUntil', '')::date,
    nullif(trim(p_strategy ->> 'capacityNote'), ''),
    make_interval(days => greatest(1, least(365, coalesce((p_strategy ->> 'lookbackDays')::integer, 90)))),
    'weekdays', greatest(1, least(25, coalesce((p_strategy ->> 'resultLimit')::integer, 5))),
    greatest(0, coalesce((p_strategy ->> 'runCostLimit')::numeric, 0.50)),
    greatest(0, coalesce((p_strategy ->> 'dailyCostLimit')::numeric, 2.50)), true,
    coalesce(nullif(p_strategy ->> 'timezone', ''), 'Europe/Amsterdam'),
    greatest(0, least(23, coalesce((p_strategy ->> 'monitorHour')::integer, 7))),
    next_version, now(), now(), now() + interval '30 days', actor_id, actor_id,
    'Lead Strategy saved and Source Scout queued', minimum_budget, preferred_min, preferred_max, large_review
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

create function public.quarantine_qualification_policy_mismatches()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with current_leads as (
    select distinct on (lead.workspace_id, lead.opportunity_id)
      lead.workspace_id, lead.opportunity_id, lead.final_assessment_id
    from public.leads as lead
    order by lead.workspace_id, lead.opportunity_id, lead.version desc, lead.created_at desc
  ), mismatches as (
    select current_lead.workspace_id, current_lead.opportunity_id,
      workflow.id as workflow_run_id, assessment.decision
    from current_leads as current_lead
    join public.assessments as assessment
      on assessment.workspace_id = current_lead.workspace_id
     and assessment.id = current_lead.final_assessment_id
    join lateral (
      select candidate.id
      from public.automation_workflow_runs as candidate
      where candidate.workspace_id = current_lead.workspace_id
        and candidate.opportunity_id = current_lead.opportunity_id
        and candidate.kind = 'opportunity_qualification'
      order by candidate.created_at desc limit 1
    ) as workflow on true
    where assessment.decision <> 'qualify'
  )
  insert into public.automation_exceptions (
    workspace_id, workflow_run_id, opportunity_id, exception_kind, summary, details
  )
  select mismatch.workspace_id, mismatch.workflow_run_id, mismatch.opportunity_id,
    'qualification_policy_mismatch',
    'Existing Lead requires requalification under the corrected final-routing policy.',
    jsonb_build_object('historicalDecision', mismatch.decision, 'quarantinedAt', now())
  from mismatches as mismatch
  where not exists (
    select 1 from public.automation_exceptions as existing
    where existing.workspace_id = mismatch.workspace_id
      and existing.opportunity_id = mismatch.opportunity_id
      and existing.exception_kind = 'qualification_policy_mismatch'
      and existing.status = 'open'
  );
  get diagnostics inserted_count = row_count;

  update public.opportunities as opportunity
  set lifecycle_status = 'needs_review', updated_at = now()
  where exists (
    select 1 from public.automation_exceptions as exception
    where exception.workspace_id = opportunity.workspace_id
      and exception.opportunity_id = opportunity.id
      and exception.exception_kind = 'qualification_policy_mismatch'
      and exception.status = 'open'
  );
  return inserted_count;
end;
$$;

select public.quarantine_qualification_policy_mismatches();

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
  ) as lead_research_pending,
  assessment.qualification_checks,
  lead.outreach_draft,
  qualification_exception.value as qualification_exception
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
    candidate.dimension_results, candidate.delivery_route, candidate.commercial_fit,
    candidate.qualification_checks
  from public.assessments as candidate
  where candidate.opportunity_id = opportunity.id and candidate.workspace_id = opportunity.workspace_id
  order by candidate.assessed_at desc limit 1
) as assessment on true
left join lateral (
  select candidate.id, candidate.version, candidate.status, candidate.route,
    candidate.why_now, candidate.suggested_next_action, candidate.review_record,
    candidate.outreach_draft
  from public.leads as candidate
  where candidate.opportunity_id = opportunity.id and candidate.workspace_id = opportunity.workspace_id
  order by candidate.version desc, candidate.created_at desc limit 1
) as lead on true
left join lateral (
  select jsonb_build_object(
    'id', exception.id, 'kind', exception.exception_kind,
    'summary', exception.summary, 'status', exception.status
  ) as value
  from public.automation_exceptions as exception
  where exception.workspace_id = opportunity.workspace_id
    and exception.opportunity_id = opportunity.id
    and exception.exception_kind = 'qualification_policy_mismatch'
    and exception.status = 'open'
  order by exception.created_at desc limit 1
) as qualification_exception on true;

revoke all on function public.create_qualified_lead_version(uuid, uuid, uuid, text, text, public.lead_route, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_qualified_lead_version(uuid, uuid, uuid, text, text, public.lead_route, jsonb, jsonb) to service_role;
revoke all on function public.quarantine_qualification_policy_mismatches() from public, anon, authenticated;
grant execute on function public.quarantine_qualification_policy_mismatches() to service_role;
revoke all on function public.save_lead_strategy(jsonb) from public, anon;
grant execute on function public.save_lead_strategy(jsonb) to authenticated;
grant select on public.opportunity_dashboard to authenticated;
