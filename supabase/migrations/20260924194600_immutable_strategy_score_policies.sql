-- A strategy-specific scoring policy snapshot must never silently change under
-- an existing Assessment reference.
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
    select id into policy_id
    from public.score_policies
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

revoke all on function public.ensure_current_score_policy(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ensure_current_score_policy(uuid, text, jsonb, jsonb) to service_role;
