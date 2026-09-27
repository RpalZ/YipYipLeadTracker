-- Evidence time is separate from insertion time; replay must not refresh stale evidence.
alter table public.conversation_readiness_labels alter column created_at set default clock_timestamp();
create or replace function public.label_conversation_readiness(
  p_evaluation_id uuid, p_label text, p_reason text, p_notes text,
  p_idempotency_key text, p_expected_label_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid()); target public.conversation_readiness_evaluations%rowtype;
  prior public.conversation_readiness_labels%rowtype; latest_assessment uuid; latest_evaluation uuid; latest_label uuid;
  new_id uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into target from public.conversation_readiness_evaluations where id=p_evaluation_id;
  if not found or not private.has_workspace_role(target.workspace_id, array['owner','reviewer']::public.workspace_role[]) then
    raise exception 'owner or reviewer required' using errcode='42501';
  end if;
  perform 1 from public.opportunities where id=target.opportunity_id and workspace_id=target.workspace_id for update;
  select * into prior from public.conversation_readiness_labels where workspace_id=target.workspace_id and reviewer_id=actor and idempotency_key=p_idempotency_key;
  if found then
    if prior.evaluation_id <> p_evaluation_id or prior.label <> p_label or prior.reason <> p_reason or prior.notes is distinct from nullif(trim(p_notes),'') then
      raise exception 'idempotency key reused for different label' using errcode='22023';
    end if;
    return prior.id;
  end if;
  select id into latest_assessment from public.assessments where workspace_id=target.workspace_id and opportunity_id=target.opportunity_id order by created_at desc, id desc limit 1;
  select id into latest_evaluation from public.conversation_readiness_evaluations where workspace_id=target.workspace_id and assessment_id=target.assessment_id order by created_at desc,id desc limit 1;
  if target.assessment_id <> latest_assessment or target.id <> latest_evaluation then raise exception 'assessment superseded; refresh before labeling' using errcode='40001'; end if;
  if coalesce((target.provenance #>> '{context,evaluatedAt}')::timestamptz, target.created_at) < now()-interval '90 days' or (target.result->>'validUntil' is not null and (target.result->>'validUntil')::date < current_date) then
    raise exception 'evaluation expired; refresh evidence before labeling' using errcode='40001';
  end if;
  select id into latest_label from public.conversation_readiness_labels where evaluation_id=target.id and reviewer_id=actor order by created_at desc,id desc limit 1;
  if latest_label is distinct from p_expected_label_id then raise exception 'label superseded; refresh before labeling' using errcode='40001'; end if;
  insert into public.conversation_readiness_labels(workspace_id,evaluation_id,reviewer_id,label,reason,notes,idempotency_key,replaces_id)
  values(target.workspace_id,target.id,actor,p_label,p_reason,nullif(trim(p_notes),''),p_idempotency_key,latest_label) returning id into new_id;
  return new_id;
end; $$;
