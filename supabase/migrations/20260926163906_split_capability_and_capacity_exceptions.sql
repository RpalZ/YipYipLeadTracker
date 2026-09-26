-- Capability fit is evidence about whether YipYip's technical services match
-- the project. Delivery capacity is an operator-owned strategy setting. Keep
-- those two qualification exceptions separate in durable history.

alter table public.automation_exceptions
  drop constraint if exists automation_exceptions_exception_kind_check,
  add constraint automation_exceptions_exception_kind_check check (exception_kind in (
    'ambiguous_entity', 'low_confidence', 'borderline_score', 'sensitive_sector',
    'unusual_budget', 'partner_required', 'conflicting_evidence', 'commercial_fit_uncertain',
    'contact_route_unresolved', 'qualification_policy_mismatch', 'capability_fit_uncertain',
    'delivery_capacity_uncertain', 'actionability_uncertain', 'outreach_draft_invalid',
    'policy_failure', 'cost_limit', 'repeated_failure'
  ));

with latest_final_assessment as (
  select distinct on (assessment.workspace_id, assessment.opportunity_id)
    assessment.workspace_id,
    assessment.opportunity_id,
    assessment.qualification_checks
  from public.assessments as assessment
  where assessment.assessment_type = 'final'
  order by assessment.workspace_id, assessment.opportunity_id,
    assessment.assessed_at desc, assessment.id desc
)
update public.automation_exceptions as exception
set
  exception_kind = 'delivery_capacity_uncertain',
  summary = 'YipYip delivery capacity is unavailable, unknown, or outside its valid-through date.',
  details = coalesce(exception.details, '{}'::jsonb) || jsonb_build_object(
    'reclassifiedFrom', 'capability_fit_uncertain',
    'reclassifiedReason', 'delivery_capacity_gate'
  )
from latest_final_assessment as assessment
where exception.workspace_id = assessment.workspace_id
  and exception.opportunity_id = assessment.opportunity_id
  and exception.status = 'open'
  and exception.exception_kind = 'capability_fit_uncertain'
  and assessment.qualification_checks #>> '{checks,capability}' = 'passed'
  and assessment.qualification_checks #>> '{checks,capacity}' in ('unresolved', 'review');
