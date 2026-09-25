begin;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '41111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'discovery-owner@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '42222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'discovery-reviewer@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '43333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'discovery-viewer@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'discovery-stranger@example.test', now(), now());

insert into public.workspaces (id, name, slug)
values
  ('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Discovery workspace', 'discovery-workspace'),
  ('4bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Discovery other', 'discovery-other');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '41111111-1111-1111-1111-111111111111', 'owner'),
  ('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '42222222-2222-2222-2222-222222222222', 'reviewer'),
  ('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '43333333-3333-3333-3333-333333333333', 'viewer'),
  ('4bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'owner');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select public.bootstrap_dutch_agency_discovery('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

do $$
declare target_job uuid;
begin
  select id into target_job from public.discovery_jobs where workspace_id = '4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if (select enabled from public.discovery_jobs where id = target_job) then
    raise exception 'bootstrap must leave the job disabled';
  end if;
  if (select enabled from public.source_registry where workspace_id = '4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    raise exception 'bootstrap must leave the query-pack source disabled';
  end if;
  perform public.set_discovery_job_enabled(target_job, true);
  perform set_config('test.discovery_job_id', target_job::text, true);
end;
$$;

do $$
declare first_run uuid;
begin
  first_run := public.start_discovery_run(
    '4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    current_setting('test.discovery_job_id')::uuid,
    'run-1'
  );
  perform set_config('test.discovery_run_id', first_run::text, true);
  begin
    perform public.start_discovery_run(
      '4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      current_setting('test.discovery_job_id')::uuid,
      'run-concurrent'
    );
    raise exception 'second active run unexpectedly succeeded';
  exception when unique_violation then null;
  end;
end;
$$;

-- A later invalid item must roll back the earlier accepted item in the same completion call.
do $$
declare
  valid_candidate jsonb := '{
    "title":"Participation platform renewal","organization":"Gemeente Utrecht",
    "summary":"A replacement participation platform is being prepared.",
    "whyNow":"The strategy enters delivery preparation this quarter.",
    "projectClues":["replacement participation platform"],"maturity":"planning",
    "budgetClue":null,"timingClue":"this quarter","contactClue":"digital participation lead",
    "location":"Utrecht, NL","workMode":"Hybrid","technicalDifficulty":"High",
    "canonicalSourceUrl":"https://example.test/utrecht-platform","publisher":"Example publisher",
    "publicationDate":"2026-09-01","evidenceExcerpt":"The municipality is preparing a replacement platform.",
    "facts":["A replacement is being prepared."],"inferences":["Agency selection may follow."],
    "signalType":"strategy","confidence":0.81
  }'::jsonb;
  valid_result jsonb;
begin
  valid_result := jsonb_build_object(
    'candidate',valid_candidate,'canonicalUrl','https://example.test/utrecht-platform',
    'fingerprint',repeat('a',64),'opportunityKey',repeat('b',64),
    'normalizedOrganization','gemeente utrecht','accepted',true,'rejectionReasons','[]'::jsonb
  );
  begin
    perform public.complete_discovery_run(
      current_setting('test.discovery_run_id')::uuid,
      jsonb_build_array(valid_result, valid_result || '{"accepted":false,"rejectionReasons":["low_confidence"],"candidate":{"confidence":2}}'::jsonb),
      '{"durationMs":10,"stopReason":"completed"}'::jsonb,
      '{"health":"healthy","reason":"test","policyVersion":"discovery-health-v1","metrics":{"recentFailureRate":0}}'::jsonb
    );
    raise exception 'invalid atomic completion unexpectedly succeeded';
  exception when integrity_constraint_violation then null;
  end;
  if exists(select 1 from public.organizations where normalized_name = 'gemeente utrecht') then
    raise exception 'atomic completion leaked a partial organization';
  end if;

  perform public.complete_discovery_run(
    current_setting('test.discovery_run_id')::uuid,
    jsonb_build_array(valid_result),
    '{"durationMs":25,"stopReason":"completed","inputTokens":100,"outputTokens":50,"totalTokens":150,"estimatedCostEur":0.011,"searchQueries":["test query"],"consultedUrls":["https://example.test/utrecht-platform"]}'::jsonb,
    '{"health":"healthy","reason":"latest_run_valid_and_recent_failure_rate_below_20_percent","policyVersion":"discovery-health-v1","metrics":{"recentFailureRate":0}}'::jsonb
  );
end;
$$;

do $$
declare second_run uuid;
declare valid_candidate jsonb := '{
  "title":"Participation platform renewal","organization":"Gemeente Utrecht",
  "summary":"A replacement participation platform is being prepared.","whyNow":"Delivery preparation is active.",
  "projectClues":["replacement participation platform"],"maturity":"planning","budgetClue":null,
  "timingClue":null,"contactClue":null,"location":"Utrecht, NL","workMode":null,"technicalDifficulty":"High",
  "canonicalSourceUrl":"https://example.test/utrecht-platform","publisher":"Example publisher","publicationDate":"2026-09-01",
  "evidenceExcerpt":"The municipality is preparing a replacement platform.","facts":["Replacement planned."],"inferences":[],
  "signalType":"strategy","confidence":0.81}'::jsonb;
declare repeated_result jsonb;
begin
  second_run := public.start_discovery_run('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_setting('test.discovery_job_id')::uuid, 'run-2');
  repeated_result := jsonb_build_object('candidate',valid_candidate,'canonicalUrl','https://example.test/utrecht-platform',
    'fingerprint',repeat('a',64),'opportunityKey',repeat('b',64),'normalizedOrganization','gemeente utrecht',
    'accepted',true,'rejectionReasons','[]'::jsonb);
  perform public.complete_discovery_run(second_run, jsonb_build_array(repeated_result),
    '{"durationMs":20,"stopReason":"completed"}'::jsonb,
    '{"health":"healthy","reason":"test","policyVersion":"discovery-health-v1","metrics":{"recentFailureRate":0}}'::jsonb);
  if (select count(*) from public.signals where workspace_id = '4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'repeat run created a duplicate signal';
  end if;
  if (select count(*) from public.opportunities where workspace_id = '4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'repeat run created a duplicate opportunity';
  end if;
  if (select opportunities_matched from public.discovery_runs where id = second_run) <> 1 then
    raise exception 'repeat run did not report an exact opportunity match';
  end if;
end;
$$;

do $$
declare partial_run uuid;
begin
  partial_run := public.start_discovery_run('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_setting('test.discovery_job_id')::uuid, 'run-partial');
  perform public.fail_discovery_run(
    partial_run, 'cost_limit', 'The discovery run reached its estimated cost envelope.', 60000,
    '{"health":"degraded","reason":"latest_run_stopped_partially","policyVersion":"discovery-health-v1","metrics":{"recentFailureRate":0}}'::jsonb
  );
  if (select status from public.discovery_runs where id = partial_run) <> 'partial' then
    raise exception 'cost/time/turn stops must persist as partial';
  end if;
  if (select health from public.source_registry where workspace_id = '4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 'degraded' then
    raise exception 'partial stop did not update deterministic source health';
  end if;
end;
$$;

do $$
begin
  if (select lifecycle_status from public.opportunities limit 1) <> 'discovered' then
    raise exception 'agent discovery must create an unassessed discovered opportunity';
  end if;
  if exists(select 1 from public.leads) or exists(select 1 from public.assessments) then
    raise exception 'discovery must not create lead or assessment rows';
  end if;
  if (select score from public.opportunity_dashboard limit 1) is not null then
    raise exception 'unassessed discovery received a synthetic score';
  end if;
  if jsonb_array_length((select evidence from public.opportunity_dashboard limit 1)) <> 1 then
    raise exception 'dashboard evidence was not exposed';
  end if;
  if (select count(*) from public.source_health_events) < 3 then
    raise exception 'health transitions were not appended';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"42222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.discovery_runs) <> 3 then raise exception 'reviewer should read run history'; end if;
  begin
    perform public.bootstrap_dutch_agency_discovery('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    raise exception 'reviewer unexpectedly bootstrapped discovery';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.start_discovery_run('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_setting('test.discovery_job_id')::uuid, 'reviewer-run');
    raise exception 'reviewer unexpectedly started discovery';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"43333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.discovery_runs) <> 3 then raise exception 'viewer should read run history'; end if;
  begin
    perform public.start_discovery_run('4aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_setting('test.discovery_job_id')::uuid, 'viewer-run');
    raise exception 'viewer unexpectedly started discovery';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$
begin
  if exists(select 1 from public.discovery_runs) then raise exception 'cross-workspace run history was visible'; end if;
  if exists(select 1 from public.discovery_run_results) then raise exception 'cross-workspace results were visible'; end if;
  if exists(select 1 from public.source_health_events) then raise exception 'cross-workspace health was visible'; end if;
end;
$$;

reset role;
do $$
begin
  if has_table_privilege('anon','public.discovery_runs','select') then raise exception 'anonymous run access is not allowed'; end if;
  if has_table_privilege('authenticated','public.source_health_events','update') then raise exception 'health events must be immutable'; end if;
  if has_function_privilege('anon','public.start_discovery_run(uuid,uuid,text)','execute') then raise exception 'anonymous run execution is not allowed'; end if;
end;
$$;

rollback;
