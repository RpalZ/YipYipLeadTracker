-- Let an owner/reviewer deliberately move an assessed Opportunity into the
-- pursuit workflow without rewriting its automated qualification outcome.

alter table public.leads
  add column origin text not null default 'automated'
    check (origin in ('automated', 'manual_promotion')),
  add column promoted_by uuid references auth.users(id) on delete restrict,
  add column promoted_at timestamptz,
  add column promotion_reason text,
  add column promotion_notes text,
  add column promotion_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(promotion_snapshot) = 'object'),
  add constraint leads_manual_promotion_attribution_check check (
    origin = 'automated'
    or (
      promoted_by is not null
      and promoted_at is not null
      and promotion_reason is not null
      and length(trim(promotion_reason)) > 0
    )
  );

create index leads_workspace_manual_promotion_idx
  on public.leads (workspace_id, promoted_at desc)
  where origin = 'manual_promotion';

alter table public.review_events
  drop constraint review_events_decision_check,
  add constraint review_events_decision_check
    check (decision in ('pursue','pass','request_research','route_changed','manual_promote'));

create function public.promote_opportunity_to_pursuit(
  p_opportunity_id uuid,
  p_expected_assessment_id uuid,
  p_reason_code text,
  p_notes text,
  p_route public.lead_route,
  p_language text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target public.opportunities%rowtype;
  target_assessment public.assessments%rowtype;
  latest_lead public.leads%rowtype;
  primary_signal public.signals%rowtype;
  next_version integer;
  lead_id uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid();
  event_key text := nullif(trim(p_idempotency_key), '');
  normalized_reason text := nullif(trim(p_reason_code), '');
  normalized_notes text := nullif(trim(p_notes), '');
  draft jsonb;
  snapshot jsonb;
  changes jsonb;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if event_key is null then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;
  if normalized_reason is null or normalized_reason not in (
    'seasonal_capacity', 'strategic_interest', 'existing_relationship',
    'portfolio_fit', 'partner_opportunity', 'other'
  ) then
    raise exception 'supported promotion reason required' using errcode = '22023';
  end if;
  if normalized_reason = 'other' and normalized_notes is null then
    raise exception 'notes are required for the other reason' using errcode = '22023';
  end if;
  if normalized_notes is not null and length(normalized_notes) > 1000 then
    raise exception 'promotion note is too long' using errcode = '22023';
  end if;
  if p_route is null or p_route not in ('direct', 'partner', 'nurture', 'monitor') then
    raise exception 'supported pursuit route required' using errcode = '22023';
  end if;
  if p_language is null or p_language not in ('nl', 'en') then
    raise exception 'outreach language must be nl or en' using errcode = '22023';
  end if;

  select * into target
  from public.opportunities
  where id = p_opportunity_id
  for update;
  if target.id is null then
    raise exception 'Opportunity not found' using errcode = 'P0002';
  end if;
  if not (select private.has_workspace_role(target.workspace_id, array['owner','reviewer']::public.workspace_role[])) then
    raise exception 'owner or reviewer role required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'eventId', event.id,
    'leadId', event.lead_id,
    'origin', 'manual_promotion',
    'replayed', true
  ) into changes
  from public.review_events as event
  where event.workspace_id = target.workspace_id
    and event.opportunity_id = target.id
    and event.idempotency_key = event_key;
  if changes is not null then return changes; end if;

  if target.lifecycle_status not in ('monitoring', 'needs_review', 'rejected') then
    raise exception 'only a completed non-qualified Opportunity can be manually promoted' using errcode = '23514';
  end if;

  select * into target_assessment
  from public.assessments
  where workspace_id = target.workspace_id and opportunity_id = target.id
  order by assessed_at desc, created_at desc
  limit 1;
  if target_assessment.id is null or target_assessment.assessment_type <> 'final' then
    raise exception 'latest completed final Assessment required' using errcode = '23514';
  end if;
  if target_assessment.id <> p_expected_assessment_id then
    raise exception 'Assessment version is stale' using errcode = '40001';
  end if;
  if target_assessment.qualification_checks -> 'checks' ->> 'sector' is null
    or target_assessment.qualification_checks -> 'checks' ->> 'actionability' is null then
    raise exception 'Assessment must explicitly evaluate sector and current actionability before manual promotion' using errcode = '23514';
  end if;
  if target_assessment.qualification_checks -> 'checks' ->> 'sector' = 'rejected' then
    raise exception 'hard-excluded sectors cannot be manually promoted' using errcode = '23514';
  end if;
  if target_assessment.qualification_checks -> 'checks' ->> 'actionability' = 'rejected' then
    raise exception 'expired Opportunities without an active follow-on cannot be manually promoted' using errcode = '23514';
  end if;

  select * into latest_lead
  from public.leads
  where workspace_id = target.workspace_id and opportunity_id = target.id
  order by version desc, created_at desc
  limit 1;
  if latest_lead.id is not null then
    raise exception 'Opportunity already has a Lead version; use the existing review actions' using errcode = '23514';
  end if;

  select signal.* into primary_signal
  from public.opportunity_signals as link
  join public.signals as signal
    on signal.workspace_id = link.workspace_id and signal.id = link.signal_id
  where link.workspace_id = target.workspace_id and link.opportunity_id = target.id
  order by coalesce(signal.published_at, signal.captured_at) desc
  limit 1;
  if primary_signal.id is null then
    raise exception 'at least one citation-valid Signal is required' using errcode = '23514';
  end if;

  snapshot := jsonb_build_object(
    'automatedLifecycleStatus', target.lifecycle_status,
    'assessmentId', target_assessment.id,
    'assessmentDecision', target_assessment.decision,
    'qualificationChecks', target_assessment.qualification_checks,
    'missingFields', target.missing_fields,
    'evidenceSignalId', primary_signal.id,
    'evidenceUrl', primary_signal.canonical_url,
    'promotedBy', actor_id,
    'promotedAt', now()
  );

  if p_language = 'nl' then
    draft := jsonb_build_object(
      'language', 'nl',
      'recommendedChannel', 'email',
      'emailSubject', left('Kennismaking over ' || target.title, 180),
      'emailBody', format(
        'Goedendag, het signaal rond %s bij uw organisatie viel ons op. YipYip bouwt maatwerkapplicaties, digitale platforms en complexe back-ends. Hoewel nog niet alle commerciële en operationele details publiek bevestigd zijn, verkennen we graag of onze ervaring aansluit op de komende keuzes. Staat u open voor een kort gesprek over de actuele scope, planning en een passende samenwerkingsvorm?',
        target.title
      ),
      'callOpening', format(
        'Goedendag, ik bel omdat het signaal rond %s ons opviel. YipYip bouwt complexe digitale producten en back-ends. Ik ben benieuwd welke keuzes nu spelen en of een korte verkenning zinvol is.',
        target.title
      ),
      'discoveryQuestions', jsonb_build_array(
        'Welke digitale scope is nu daadwerkelijk voorzien?',
        'Welk budget en tijdpad zijn voor dit onderdeel beschikbaar?',
        'Wie is verantwoordelijk voor de volgende markt- of leveranciersstap?'
      ),
      'evidenceRefs', jsonb_build_array(primary_signal.id::text, primary_signal.canonical_url),
      'caveats', jsonb_build_array(
        'Deze Lead is handmatig gepromoveerd en heeft niet alle automatische kwalificatiepoorten doorlopen.',
        'Controleer openstaande bewijs- en contactvragen voordat outreach wordt verstuurd.'
      )
    );
  else
    draft := jsonb_build_object(
      'language', 'en',
      'recommendedChannel', 'email',
      'emailSubject', left('Exploring ' || target.title, 180),
      'emailBody', format(
        'Hello, the signal concerning %s at your organisation caught our attention. YipYip builds custom applications, digital platforms, and complex back-end systems. Although not every commercial and operational detail is publicly confirmed, we would value a short conversation to understand the current scope, timing, and a suitable way to contribute. Would you be open to an introductory discussion?',
        target.title
      ),
      'callOpening', format(
        'Hello, I am calling because the signal concerning %s caught our attention. YipYip builds complex digital products and back-end systems. I would like to understand the choices currently being made and whether an early conversation would be useful.',
        target.title
      ),
      'discoveryQuestions', jsonb_build_array(
        'What digital scope is currently being considered?',
        'What budget and timing apply to the addressable package?',
        'Who owns the next market or supplier decision?'
      ),
      'evidenceRefs', jsonb_build_array(primary_signal.id::text, primary_signal.canonical_url),
      'caveats', jsonb_build_array(
        'This Lead was manually promoted and did not pass every automatic qualification gate.',
        'Verify unresolved evidence and contact questions before sending outreach.'
      )
    );
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.leads
  where workspace_id = target.workspace_id and opportunity_id = target.id;

  insert into public.leads (
    id, workspace_id, opportunity_id, final_assessment_id, why_now,
    suggested_next_action, route, status, outreach_draft, review_record, version,
    origin, promoted_by, promoted_at, promotion_reason, promotion_notes, promotion_snapshot
  ) values (
    lead_id, target.workspace_id, target.id, target_assessment.id,
    coalesce(target.resolution_metadata ->> 'why_now', 'Promoted for pursuit through attributable human commercial judgment.'),
    'Review the unresolved qualification caveats, verify the contact route, and decide whether to pursue.',
    p_route, 'in_review', draft,
    jsonb_build_object(
      'lastDecision', 'manual_promote', 'reasonCode', normalized_reason,
      'notes', normalized_notes, 'reviewedBy', actor_id, 'reviewedAt', now()
    ),
    next_version, 'manual_promotion', actor_id, now(), normalized_reason,
    normalized_notes, snapshot
  );

  changes := jsonb_build_object(
    'previousLifecycleStatus', target.lifecycle_status,
    'currentLifecycleStatus', target.lifecycle_status,
    'leadOrigin', 'manual_promotion',
    'assessmentDecision', target_assessment.decision,
    'unresolvedChecks', target_assessment.qualification_checks -> 'checks',
    'route', p_route,
    'language', p_language
  );

  insert into public.review_events (
    id, workspace_id, opportunity_id, lead_id, reviewer_id,
    decision, reason_code, notes, changes, idempotency_key
  ) values (
    event_id, target.workspace_id, target.id, lead_id, actor_id,
    'manual_promote', normalized_reason, normalized_notes, changes, event_key
  );

  return jsonb_build_object(
    'eventId', event_id,
    'leadId', lead_id,
    'origin', 'manual_promotion',
    'replayed', false
  );
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
  ) as lead_research_pending,
  assessment.qualification_checks,
  lead.outreach_draft,
  qualification_exception.value as qualification_exception,
  assessment.id as latest_assessment_id,
  assessment.assessment_type as latest_assessment_type,
  lead.origin as lead_origin,
  lead.promoted_by,
  lead.promoted_at,
  lead.promotion_reason,
  lead.promotion_notes,
  lead.promotion_snapshot
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
  select candidate.id, candidate.assessment_type, candidate.overall_score,
    candidate.overall_confidence, candidate.assessed_at,
    candidate.dimension_results, candidate.delivery_route, candidate.commercial_fit,
    candidate.qualification_checks
  from public.assessments as candidate
  where candidate.opportunity_id = opportunity.id and candidate.workspace_id = opportunity.workspace_id
  order by candidate.assessed_at desc, candidate.created_at desc limit 1
) as assessment on true
left join lateral (
  select candidate.id, candidate.version, candidate.status, candidate.route,
    candidate.why_now, candidate.suggested_next_action, candidate.review_record,
    candidate.outreach_draft, candidate.origin, candidate.promoted_by,
    candidate.promoted_at, candidate.promotion_reason, candidate.promotion_notes,
    candidate.promotion_snapshot
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

revoke all on function public.promote_opportunity_to_pursuit(uuid, uuid, text, text, public.lead_route, text, text)
  from public, anon;
grant execute on function public.promote_opportunity_to_pursuit(uuid, uuid, text, text, public.lead_route, text, text)
  to authenticated;
