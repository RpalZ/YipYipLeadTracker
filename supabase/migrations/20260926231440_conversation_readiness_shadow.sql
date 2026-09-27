-- Parallel experimental judgments; never update production qualification.
alter table public.assessments add constraint assessments_readiness_identity unique (workspace_id, opportunity_id, id);
create table public.conversation_readiness_evaluations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  opportunity_id uuid not null,
  assessment_id uuid not null,
  policy_version text not null,
  input_fingerprint text not null check (length(input_fingerprint) = 64),
  input_snapshot jsonb,
  result jsonb not null check (jsonb_typeof(result) = 'object' and result->>'status' in ('conversation_ready','monitor','not_suitable','not_evaluated')),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  unique (assessment_id, input_fingerprint, policy_version),
  unique (workspace_id, id),
  foreign key (workspace_id, opportunity_id, assessment_id) references public.assessments(workspace_id, opportunity_id, id)
);
create index readiness_opportunity_idx on public.conversation_readiness_evaluations(workspace_id, opportunity_id, created_at desc);
create table public.conversation_readiness_labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  evaluation_id uuid not null,
  reviewer_id uuid not null references auth.users(id),
  label text not null check (label in ('worth_contacting','monitor','pass','insufficient_evidence')),
  reason text not null check (reason in ('concrete_need','commercial_potential','budget_uncertain','no_external_demand','timing','capability','evidence_missing','other')),
  notes text check (length(notes) <= 1000),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  replaces_id uuid references public.conversation_readiness_labels(id),
  created_at timestamptz not null default now(),
  check (reason <> 'other' or length(trim(notes)) > 0),
  unique (workspace_id, reviewer_id, idempotency_key),
  foreign key (workspace_id, evaluation_id) references public.conversation_readiness_evaluations(workspace_id, id)
);
create index readiness_labels_evaluation_idx on public.conversation_readiness_labels(workspace_id, evaluation_id, created_at desc);
create index readiness_labels_reviewer_idx on public.conversation_readiness_labels(reviewer_id);
create index readiness_labels_replaces_idx on public.conversation_readiness_labels(replaces_id);
alter table public.conversation_readiness_evaluations enable row level security;
alter table public.conversation_readiness_labels enable row level security;
revoke all on public.conversation_readiness_evaluations, public.conversation_readiness_labels from public, anon, authenticated;
grant select on public.conversation_readiness_evaluations, public.conversation_readiness_labels to authenticated;
grant select, insert on public.conversation_readiness_evaluations to service_role;
grant select on public.conversation_readiness_labels to service_role;
create policy readiness_member_read on public.conversation_readiness_evaluations for select to authenticated
 using (private.has_workspace_role(workspace_id, array['owner','operator','reviewer','viewer']::public.workspace_role[]));
create policy readiness_label_member_read on public.conversation_readiness_labels for select to authenticated
 using (private.has_workspace_role(workspace_id, array['owner','operator','reviewer','viewer']::public.workspace_role[]));
create function private.readiness_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'readiness snapshots and labels are immutable' using errcode='42501'; end; $$;
create trigger readiness_immutable before update or delete on public.conversation_readiness_evaluations for each row execute function private.readiness_immutable();
create trigger readiness_label_immutable before update or delete on public.conversation_readiness_labels for each row execute function private.readiness_immutable();

-- Definer is deliberately narrow: table writes are not granted to application roles.
create function public.label_conversation_readiness(
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
  if target.created_at < now()-interval '90 days' or (target.result->>'validUntil' is not null and (target.result->>'validUntil')::date < current_date) then
    raise exception 'evaluation expired; refresh evidence before labeling' using errcode='40001';
  end if;
  select id into latest_label from public.conversation_readiness_labels where evaluation_id=target.id and reviewer_id=actor order by created_at desc,id desc limit 1;
  if latest_label is distinct from p_expected_label_id then raise exception 'label superseded; refresh before labeling' using errcode='40001'; end if;
  insert into public.conversation_readiness_labels(workspace_id,evaluation_id,reviewer_id,label,reason,notes,idempotency_key,replaces_id)
  values(target.workspace_id,target.id,actor,p_label,p_reason,nullif(trim(p_notes),''),p_idempotency_key,latest_label) returning id into new_id;
  return new_id;
end; $$;
revoke all on function public.label_conversation_readiness(uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.label_conversation_readiness(uuid,text,text,text,text,uuid) to authenticated;
