-- Entirely rolled back. No existing opportunities or workflow rows are mutated.
begin;
do $$
declare w uuid:=gen_random_uuid(); other_w uuid:=gen_random_uuid(); org uuid:=gen_random_uuid(); opp uuid:=gen_random_uuid(); policy uuid:=gen_random_uuid(); assessment uuid:=gen_random_uuid(); evaluation uuid:=gen_random_uuid(); actor uuid; r text;
begin
  insert into public.workspaces(id,name,slug) values(w,'Readiness test',w::text),(other_w,'Other readiness test',other_w::text);
  foreach r in array array['owner','reviewer','operator','viewer','stranger'] loop
    actor:=gen_random_uuid();
    insert into auth.users(id,email) values(actor,actor::text||'@example.test');
    insert into public.workspace_members(workspace_id,user_id,role) values(case when r='stranger' then other_w else w end,actor,(case when r='stranger' then 'owner' else r end)::public.workspace_role);
    perform set_config('test.readiness_'||r,actor::text,true);
  end loop;
  insert into public.organizations(id,workspace_id,name,normalized_name) values(org,w,'Fixture','fixture');
  insert into public.opportunities(id,workspace_id,organization_id,title,description,lifecycle_status) values(opp,w,org,'Readiness fixture','Synthetic','monitoring');
  insert into public.score_policies(id,workspace_id,version,weights,thresholds) values(policy,w,'readiness-test','{}','{}');
  insert into public.assessments(id,workspace_id,opportunity_id,assessment_type,profile_version,score_policy_id,overall_score,overall_confidence,decision)
    values(assessment,w,opp,'final','test',policy,55,0.8,'research');
  insert into public.conversation_readiness_evaluations(id,workspace_id,opportunity_id,assessment_id,policy_version,input_fingerprint,result,provenance)
    values(evaluation,w,opp,assessment,'test',repeat('a',64),'{"status":"conversation_ready","validUntil":null}','{}');
  insert into public.conversation_readiness_evaluations(workspace_id,opportunity_id,assessment_id,policy_version,input_fingerprint,result,provenance)
    values(w,opp,assessment,'test',repeat('a',64),'{"status":"monitor"}','{}') on conflict(assessment_id,input_fingerprint,policy_version) do nothing;
  if (select count(*) from public.conversation_readiness_evaluations where assessment_id=assessment)<>1 then raise exception 'evaluation not idempotent'; end if;
  begin
    insert into public.conversation_readiness_evaluations(workspace_id,opportunity_id,assessment_id,policy_version,input_fingerprint,result,provenance)
      values(other_w,opp,assessment,'test',repeat('b',64),'{"status":"monitor"}','{}');
    raise exception 'cross-workspace insert succeeded';
  exception when foreign_key_violation then null; end;
  begin update public.conversation_readiness_evaluations set policy_version='changed' where id=evaluation; raise exception 'mutable evaluation'; exception when insufficient_privilege then null; end;
  perform set_config('test.readiness_evaluation',evaluation::text,true);
  perform set_config('test.readiness_opportunity',opp::text,true);
  perform set_config('test.readiness_workspace',w::text,true);
  perform set_config('test.readiness_policy',policy::text,true);
end $$;
set local role service_role;
insert into public.conversation_readiness_evaluations(workspace_id,opportunity_id,assessment_id,policy_version,input_fingerprint,result,provenance)
select workspace_id,opportunity_id,assessment_id,policy_version,input_fingerprint,result,provenance
from public.conversation_readiness_evaluations where id=current_setting('test.readiness_evaluation')::uuid
on conflict(assessment_id,input_fingerprint,policy_version) do nothing;
reset role;
set local role authenticated;
do $$
declare r text; label_id uuid; replacement uuid; e uuid:=current_setting('test.readiness_evaluation')::uuid;
begin
  foreach r in array array['operator','viewer','stranger'] loop
    perform set_config('request.jwt.claims',json_build_object('sub',current_setting('test.readiness_'||r),'role','authenticated')::text,true);
    if r='stranger' and exists(select 1 from public.conversation_readiness_evaluations where id=e) then raise exception 'tenant data visible'; end if;
    if r<>'stranger' and not exists(select 1 from public.conversation_readiness_evaluations where id=e) then raise exception 'member cannot inspect'; end if;
    begin perform public.label_conversation_readiness(e,'monitor','timing',null,'deny-'||r); raise exception 'unauthorized label succeeded'; exception when insufficient_privilege then null; end;
  end loop;
  foreach r in array array['owner','reviewer'] loop
    perform set_config('request.jwt.claims',json_build_object('sub',current_setting('test.readiness_'||r),'role','authenticated')::text,true);
    begin perform public.label_conversation_readiness(e,'monitor','other',null,'invalid-'||r); raise exception 'Other without note succeeded'; exception when check_violation then null; end;
    label_id:=public.label_conversation_readiness(e,'worth_contacting','commercial_potential',null,'first-'||r);
    if label_id<>public.label_conversation_readiness(e,'worth_contacting','commercial_potential',null,'first-'||r) then raise exception 'label duplicate'; end if;
    begin perform public.label_conversation_readiness(e,'pass','timing',null,'first-'||r); raise exception 'changed idempotent payload allowed'; exception when invalid_parameter_value then null; end;
    begin perform public.label_conversation_readiness(e,'pass','timing',null,'stale-'||r); raise exception 'stale label allowed'; exception when serialization_failure then null; end;
    replacement:=public.label_conversation_readiness(e,'monitor','timing',null,'replacement-'||r,label_id);
    if not exists(select 1 from public.conversation_readiness_labels where id=replacement and replaces_id=label_id) then raise exception 'replacement history missing'; end if;
    begin delete from public.conversation_readiness_labels where id=label_id; raise exception 'direct delete allowed'; exception when insufficient_privilege then null; end;
  end loop;
  if (select lifecycle_status from public.opportunities where id=current_setting('test.readiness_opportunity')::uuid)<>'monitoring' then raise exception 'shadow changed lifecycle'; end if;
  if exists(select 1 from public.leads where opportunity_id=current_setting('test.readiness_opportunity')::uuid) then raise exception 'shadow created Lead'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',current_setting('test.readiness_stranger'),'role','authenticated')::text,true);
  if exists(select 1 from public.conversation_readiness_labels where evaluation_id=e) then raise exception 'cross-tenant feedback visible'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',current_setting('test.readiness_reviewer'),'role','authenticated')::text,true);
end $$;
reset role;
do $$
begin
  if has_table_privilege('authenticated','public.conversation_readiness_evaluations','INSERT') or has_table_privilege('authenticated','public.conversation_readiness_labels','INSERT') then raise exception 'direct authenticated write granted'; end if;
  if has_table_privilege('anon','public.conversation_readiness_evaluations','SELECT') or has_function_privilege('anon','public.label_conversation_readiness(uuid,text,text,text,text,uuid)','EXECUTE') then raise exception 'anonymous access granted'; end if;
  if not has_table_privilege('service_role','public.conversation_readiness_evaluations','INSERT') then raise exception 'worker insert unavailable'; end if;
  begin update public.conversation_readiness_labels set label='pass' where evaluation_id=current_setting('test.readiness_evaluation')::uuid; raise exception 'mutable labels'; exception when insufficient_privilege then null; end;
  insert into public.conversation_readiness_evaluations(workspace_id,opportunity_id,assessment_id,policy_version,input_fingerprint,result,provenance,created_at)
    select workspace_id,opportunity_id,assessment_id,'expired-evidence',repeat('c',64),result,jsonb_build_object('context',jsonb_build_object('evaluatedAt',now()-interval '100 days')),now()+interval '1 second'
    from public.conversation_readiness_evaluations where id=current_setting('test.readiness_evaluation')::uuid;
  begin
    perform public.label_conversation_readiness((select id from public.conversation_readiness_evaluations where opportunity_id=current_setting('test.readiness_opportunity')::uuid and policy_version='expired-evidence'),'monitor','timing',null,'expired');
    raise exception 'replay refreshed expired evidence';
  exception when serialization_failure then null; end;
  insert into public.assessments(workspace_id,opportunity_id,assessment_type,profile_version,score_policy_id,overall_score,overall_confidence,decision,created_at)
    values(current_setting('test.readiness_workspace')::uuid,current_setting('test.readiness_opportunity')::uuid,'initial','new',current_setting('test.readiness_policy')::uuid,60,0.8,'research',now()+interval '1 minute');
end $$;
set local role authenticated;
do $$ begin
  begin perform public.label_conversation_readiness(current_setting('test.readiness_evaluation')::uuid,'monitor','timing',null,'superseded'); raise exception 'superseded assessment allowed'; exception when serialization_failure then null; end;
end $$;
reset role;
rollback;
