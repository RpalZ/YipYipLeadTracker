begin;

do $$
declare
  constraint_definition text;
begin
  select pg_get_constraintdef(constraint_row.oid)
  into constraint_definition
  from pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.automation_exceptions'::regclass
    and constraint_row.conname = 'automation_exceptions_exception_kind_check';

  if constraint_definition is null
    or position('capability_fit_uncertain' in constraint_definition) = 0
    or position('delivery_capacity_uncertain' in constraint_definition) = 0 then
    raise exception 'automation exception constraint does not preserve distinct capability and capacity kinds';
  end if;
end;
$$;

do $$
begin
  if exists (
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
    select 1
    from public.automation_exceptions as exception
    join latest_final_assessment as assessment
      on assessment.workspace_id = exception.workspace_id
     and assessment.opportunity_id = exception.opportunity_id
    where exception.status = 'open'
      and exception.exception_kind = 'capability_fit_uncertain'
      and assessment.qualification_checks #>> '{checks,capability}' = 'passed'
      and assessment.qualification_checks #>> '{checks,capacity}' in ('unresolved', 'review')
  ) then
    raise exception 'capacity-only historical exception remains mislabeled as capability fit';
  end if;
end;
$$;

rollback;
