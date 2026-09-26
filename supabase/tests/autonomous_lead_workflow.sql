begin;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '51111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'automation-owner@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '52222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'automation-reviewer@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '53333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'automation-viewer@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'automation-operator@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '54444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'automation-stranger@example.test', now(), now());

insert into public.workspaces (id, name, slug)
values
  ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Automation workspace', 'automation-workspace'),
  ('5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Automation other', 'automation-other');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '51111111-1111-1111-1111-111111111111', 'owner'),
  ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '52222222-2222-2222-2222-222222222222', 'reviewer'),
  ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '53333333-3333-3333-3333-333333333333', 'viewer'),
  ('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'operator'),
  ('5bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '54444444-4444-4444-4444-444444444444', 'owner');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select set_config('test.onboarded_workspace_id', public.create_workspace_with_owner('New live MVP workspace')::text, true);
do $$
begin
  if not exists(
    select 1 from public.workspace_members
    where workspace_id = current_setting('test.onboarded_workspace_id')::uuid
      and user_id = '51111111-1111-1111-1111-111111111111'
      and role = 'owner'
  ) then raise exception 'workspace onboarding did not atomically create owner membership'; end if;
end;
$$;

select set_config('test.strategy_id', public.save_lead_strategy('{
  "workspaceId":"5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "name":"Dutch agency opportunities",
  "description":"Find early digital work.",
  "signalAreas":["pitching","strategy","hiring"],
  "regions":["Netherlands"],
  "languages":["nl","en"],
  "projectTypes":["platforms","apps"],
  "services":["strategy","software delivery"],
  "exclusions":["awarded","closed"],
  "lookbackDays":90,
  "resultLimit":5,
  "runCostLimit":0.50,
  "dailyCostLimit":2.50,
  "timezone":"Europe/Amsterdam",
  "monitorHour":7
}'::jsonb)::text, true);

do $$
begin
  if (select profile_key from public.discovery_coverage_profiles where id = current_setting('test.strategy_id')::uuid) <> 'lead-strategy' then
    raise exception 'strategy was not persisted using the Lead Strategy identity';
  end if;
  if (select count(*) from public.automation_workflow_runs where kind = 'source_scout') <> 1 then
    raise exception 'saving a strategy did not queue exactly one Source Scout workflow';
  end if;
  if not exists(select 1 from public.automation_stage_runs where stage = 'source_scout' and status = 'queued') then
    raise exception 'Source Scout stage was not queued';
  end if;
end;
$$;

insert into public.discovery_source_candidates (
  id, workspace_id, coverage_profile_id, origin, name, source_family, jurisdiction,
  base_url, proposed_config, sample_evidence, coverage_rationale, confidence,
  estimated_monthly_cost, governance_questions, status, reputation_score,
  source_classification, public_access, observed_update_frequency,
  reputation_evidence, policy_checks, suppression_fingerprint
) values (
  '5ccccccc-cccc-cccc-cccc-cccccccccccc', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  current_setting('test.strategy_id')::uuid, 'source_scout', 'Example public newsroom',
  'owned announcements', 'NL', 'https://example.test/news',
  '{"signalAreas":["strategy"]}',
  '[{"title":"Digital roadmap","url":"https://example.test/news/roadmap","relevance":"Signals a platform programme"}]',
  'Primary, public programme announcements.', 0.88, 1.00, '[]', 'proposed',
  0.91, 'primary', true, 'weekly',
  '[{"title":"Digital roadmap","url":"https://example.test/news/roadmap"}]',
  '{"termsNote":"Public pages only","robotsConcern":false,"termsConcern":false}',
  'example.test:owned-announcements:primary:public:robots-ok:terms-ok:/news/roadmap'
);

select set_config('test.source_id', public.review_source_candidate(
  '5ccccccc-cccc-cccc-cccc-cccccccccccc', 'approved', 'Approved for the acceptance test'
)::text, true);

do $$
begin
  if not exists(select 1 from public.source_registry where id = current_setting('test.source_id')::uuid and schedule_enabled and approved_at is not null) then
    raise exception 'source approval did not create an enabled governed source';
  end if;
  if not exists(select 1 from public.discovery_jobs where source_id = current_setting('test.source_id')::uuid and enabled and cadence = 'weekdays') then
    raise exception 'source approval did not create a weekday monitor';
  end if;
  if not exists(select 1 from public.automation_workflow_runs where source_id = current_setting('test.source_id')::uuid and trigger_kind = 'source_approval') then
    raise exception 'source approval did not queue the first monitor cycle';
  end if;
end;
$$;

select set_config('test.old_strategy_id', current_setting('test.strategy_id'), true);
select set_config('test.strategy_id', public.save_lead_strategy('{
  "workspaceId":"5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "name":"Dutch agency opportunities, revised",
  "description":"Find early digital work with approved sources preserved.",
  "signalAreas":["pitching","strategy","hiring"],
  "regions":["Netherlands"],
  "languages":["nl","en"],
  "projectTypes":["platforms","apps","redesigns"],
  "services":["strategy","software delivery"],
  "exclusions":["awarded","closed"],
  "lookbackDays":90,
  "resultLimit":5,
  "runCostLimit":0.50,
  "dailyCostLimit":2.50,
  "timezone":"Europe/Amsterdam",
  "monitorHour":7
}'::jsonb)::text, true);

do $$
declare first_workflow uuid;
declare second_workflow uuid;
begin
  if (select automation_enabled from public.discovery_coverage_profiles where id = current_setting('test.old_strategy_id')::uuid) then
    raise exception 'superseded Lead Strategy retained automation enablement';
  end if;
  if not exists(
    select 1 from public.coverage_profile_sources
    where coverage_profile_id = current_setting('test.strategy_id')::uuid
      and source_id = current_setting('test.source_id')::uuid
  ) then raise exception 'approved source was not carried to the revised Lead Strategy'; end if;
  if not exists(
    select 1 from public.discovery_jobs
    where source_id = current_setting('test.source_id')::uuid
      and coverage_profile_id = current_setting('test.strategy_id')::uuid
  ) then raise exception 'source monitor was not relinked to the revised Lead Strategy'; end if;
  if exists(
    select 1 from public.automation_workflow_runs
    where coverage_profile_id = current_setting('test.old_strategy_id')::uuid
      and status = 'queued'
  ) then raise exception 'superseded queued workflows were left runnable: %', (
    select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'trigger', trigger_kind, 'status', status))
    from public.automation_workflow_runs
    where coverage_profile_id = current_setting('test.old_strategy_id')::uuid
      and status = 'queued'
  ); end if;

  first_workflow := public.queue_source_monitor_now(current_setting('test.source_id')::uuid);
  second_workflow := public.queue_source_monitor_now(current_setting('test.source_id')::uuid);
  if first_workflow is null or first_workflow <> second_workflow then
    raise exception 'operator monitor queueing was not idempotent';
  end if;
  if (select count(*) from public.automation_workflow_runs
      where source_id = current_setting('test.source_id')::uuid
        and status in ('queued', 'running')) <> 1 then
    raise exception 'operator monitor queueing created duplicate active workflows';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.save_lead_strategy('{"workspaceId":"5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}'::jsonb);
    raise exception 'reviewer unexpectedly saved a Lead Strategy';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.queue_source_monitor_now(current_setting('test.source_id')::uuid);
    raise exception 'reviewer unexpectedly queued a live source monitor';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.review_source_candidate('5ccccccc-cccc-cccc-cccc-cccccccccccc', 'rejected', null);
    raise exception 'reviewer unexpectedly reviewed a source';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.discovery_coverage_profiles (
      workspace_id, profile_key, name, status, signal_areas, regions, languages, cadence
    ) values (
      '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reviewer-bypass', 'Reviewer bypass', 'draft',
      array['strategy']::public.discovery_signal_area[], array['Netherlands'], array['en'], 'weekdays'
    );
    raise exception 'reviewer bypassed the strategy RPC through direct insert';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.automation_workflow_runs) < 2 then
    raise exception 'viewer should be able to inspect automation history';
  end if;
  begin
    perform public.set_lead_automation_enabled('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
    raise exception 'viewer unexpectedly paused automation';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"54444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$
begin
  if exists(select 1 from public.automation_workflow_runs) then raise exception 'cross-workspace workflows were visible'; end if;
  if exists(select 1 from public.automation_stage_runs) then raise exception 'cross-workspace stages were visible'; end if;
  if exists(select 1 from public.automation_exceptions) then raise exception 'cross-workspace exceptions were visible'; end if;
end;
$$;

reset role;

insert into public.organizations (id, workspace_id, name, normalized_name)
values ('5ddddddd-dddd-dddd-dddd-dddddddddddd', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Research target', 'research target');
insert into public.opportunities (
  id, workspace_id, organization_id, title, description, lifecycle_status, discovery_key
) values (
  '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '5ddddddd-dddd-dddd-dddd-dddddddddddd', 'Unknown budget project',
  'An opportunity requiring a bounded second research cycle.', 'needs_review', 'research-target-key'
);
insert into public.automation_workflow_runs (
  id, workspace_id, kind, coverage_profile_id, opportunity_id, trigger_kind,
  idempotency_key, status, current_stage, search_plan_snapshot, cost_limit, finished_at
) values (
  '5fffffff-ffff-ffff-ffff-ffffffffffff', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'opportunity_qualification', current_setting('test.strategy_id')::uuid,
  '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'signal_created', 'exception-fixture',
  'succeeded', 'route', '{}', 0.50, now()
);
insert into public.automation_exceptions (
  id, workspace_id, workflow_run_id, opportunity_id, exception_kind, summary
) values (
  '50000000-0000-0000-0000-000000000005', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '5fffffff-ffff-ffff-ffff-ffffffffffff', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'low_confidence', 'Budget confidence is too low'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select set_config('test.review_workflow_id', public.review_automation_exception(
  '50000000-0000-0000-0000-000000000005', 'research', 'Research the material budget gap'
)::text, true);
do $$
begin
  if current_setting('test.review_workflow_id', true) is null then
    raise exception 'reviewer research request did not queue a qualification workflow';
  end if;
  if not exists(
    select 1 from public.automation_stage_runs
    where workflow_run_id = current_setting('test.review_workflow_id')::uuid
      and stage = 'first_assessment' and status = 'queued'
  ) then raise exception 'reviewer research request did not queue first assessment'; end if;
  if (select status from public.automation_exceptions where id = '50000000-0000-0000-0000-000000000005') <> 'resolved' then
    raise exception 'research-request exception was not resolved attributably';
  end if;
end;
$$;
reset role;

insert into public.automation_exceptions (
  id, workspace_id, workflow_run_id, opportunity_id, exception_kind, summary
) values (
  '50000000-0000-0000-0000-000000000006', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '5fffffff-ffff-ffff-ffff-ffffffffffff', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'commercial_fit_uncertain', 'Addressable commercial scope remains unresolved'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select set_config('test.attention_research_result', public.resolve_opportunity_attention(
  '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '50000000-0000-0000-0000-000000000006',
  'request_research', 'budget', 'Resolve the addressable commercial scope',
  'attention-research-idempotency'
)::text, true);
select public.resolve_opportunity_attention(
  '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '50000000-0000-0000-0000-000000000006',
  'request_research', 'budget', 'Resolve the addressable commercial scope',
  'attention-research-idempotency'
);
do $$
begin
  if (select lifecycle_status from public.opportunities where id = '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') <> 'needs_research' then
    raise exception 'Opportunity research resolution did not enter needs_research';
  end if;
  if (select status from public.automation_exceptions where id = '50000000-0000-0000-0000-000000000006') <> 'resolved' then
    raise exception 'Opportunity research resolution did not resolve the exception';
  end if;
  if (select count(*) from public.review_events where idempotency_key = 'attention-research-idempotency') <> 1 then
    raise exception 'Opportunity research resolution was not idempotent';
  end if;
end;
$$;
reset role;

insert into public.automation_exceptions (
  id, workspace_id, workflow_run_id, opportunity_id, exception_kind, summary
) values (
  '50000000-0000-0000-0000-000000000007', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '5fffffff-ffff-ffff-ffff-ffffffffffff', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'contact_route_unresolved', 'No actionable buyer route was confirmed'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.resolve_opportunity_attention(
  '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '50000000-0000-0000-0000-000000000007',
  'pass', 'no_access', 'No viable route to the buyer',
  'attention-pass-idempotency'
);
do $$
begin
  if (select lifecycle_status from public.opportunities where id = '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') <> 'rejected' then
    raise exception 'Opportunity pass did not enter rejected';
  end if;
  if (select status from public.automation_exceptions where id = '50000000-0000-0000-0000-000000000007') <> 'dismissed' then
    raise exception 'Opportunity pass did not dismiss the exception';
  end if;
  if not exists (
    select 1 from public.review_events
    where idempotency_key = 'attention-pass-idempotency'
      and lead_id is null and decision = 'pass'
  ) then raise exception 'Opportunity pass did not append an immutable decision event'; end if;
end;
$$;
reset role;

insert into public.automation_exceptions (
  id, workspace_id, workflow_run_id, opportunity_id, exception_kind, summary
) values (
  '50000000-0000-0000-0000-000000000008', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '5fffffff-ffff-ffff-ffff-ffffffffffff', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'borderline_score', 'A viewer must not resolve this exception'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.resolve_opportunity_attention(
      '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      '50000000-0000-0000-0000-000000000008',
      'pass', 'poor_fit', null, 'viewer-attention-pass'
    );
    raise exception 'viewer unexpectedly resolved an Opportunity exception';
  exception when insufficient_privilege or no_data_found then null;
  end;
end;
$$;
reset role;

do $$
begin
  if private.next_weekday_at('2026-03-27 08:00:00+00', 'Europe/Amsterdam', 7) <> '2026-03-30 05:00:00+00'::timestamptz then
    raise exception 'spring DST schedule was not 07:00 Europe/Amsterdam';
  end if;
  if private.next_weekday_at('2026-10-23 08:00:00+00', 'Europe/Amsterdam', 7) <> '2026-10-26 06:00:00+00'::timestamptz then
    raise exception 'autumn DST schedule was not 07:00 Europe/Amsterdam';
  end if;
  if has_function_privilege('authenticated', 'public.claim_automation_stage(text,integer)', 'execute') then
    raise exception 'ordinary workspace users can execute worker claims';
  end if;
  if has_function_privilege('anon', 'public.dispatch_due_automation(integer)', 'execute') then
    raise exception 'anonymous users can dispatch automation';
  end if;
  if has_function_privilege('anon', 'public.create_workspace_with_owner(text)', 'execute') then
    raise exception 'anonymous users can create workspaces';
  end if;
  if has_table_privilege('anon', 'public.automation_workflow_runs', 'select') then
    raise exception 'anonymous users can read automation workflows';
  end if;
end;
$$;

set local role service_role;
select set_config('test.stage_id', id::text, true),
       set_config('test.workflow_id', workflow_run_id::text, true),
       set_config('test.lease_token', lease_token::text, true)
from public.claim_workspace_automation_stage('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'acceptance-worker', 15)
limit 1;

do $$
begin
  if current_setting('test.stage_id', true) is null then raise exception 'worker did not claim a due stage'; end if;
  if (select status from public.automation_stage_runs where id = current_setting('test.stage_id')::uuid) <> 'running' then
    raise exception 'claimed stage was not marked running';
  end if;
  begin
    perform public.complete_automation_stage(current_setting('test.stage_id')::uuid, gen_random_uuid(), '{}', '{}', 0, null, 'succeeded');
    raise exception 'completion accepted the wrong lease token';
  exception when serialization_failure then null;
  end;
end;
$$;

reset role;
update public.automation_stage_runs
set leased_until = now() - interval '1 minute'
where id = current_setting('test.stage_id')::uuid;
update public.automation_stage_runs
set available_at = now() + interval '1 hour'
where id <> current_setting('test.stage_id')::uuid and status in ('queued', 'failed');

set local role service_role;
select set_config('test.reclaimed_stage_id', id::text, true)
from public.claim_workspace_automation_stage('5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'recovery-worker', 30)
where workflow_run_id = current_setting('test.workflow_id')::uuid
  and attempt = 2;

do $$
begin
  if current_setting('test.reclaimed_stage_id', true) is null then
    raise exception 'expired lease was not reclaimed';
  end if;
  if (select status from public.automation_stage_runs where id = current_setting('test.stage_id')::uuid) <> 'failed' then
    raise exception 'expired stage was not retained as failed history';
  end if;
end;
$$;

reset role;
update public.automation_stage_runs as stage
set status = 'skipped', stop_reason = 'acceptance_setup', finished_at = now()
from public.automation_workflow_runs as workflow
where stage.workflow_run_id = workflow.id
  and workflow.source_id = current_setting('test.source_id')::uuid
  and workflow.status in ('queued', 'running')
  and stage.status = 'queued';
update public.automation_workflow_runs
set status = 'succeeded', stop_reason = 'acceptance_setup', finished_at = now()
where source_id = current_setting('test.source_id')::uuid
  and status in ('queued', 'running');
-- Keep this rollback-only acceptance case deterministic even when the local
-- developer database already contains other due monitors.
update public.discovery_jobs
set next_run_at = now() + interval '1 day';
update public.source_registry
set next_run_at = now() + interval '1 day'
where next_run_at is not null;
update public.discovery_jobs
set next_run_at = now() - interval '1 minute'
where source_id = current_setting('test.source_id')::uuid;
update public.source_registry
set next_run_at = now() - interval '1 minute'
where id = current_setting('test.source_id')::uuid;

set local role service_role;
do $$
declare first_dispatch integer;
declare second_dispatch integer;
begin
  first_dispatch := public.dispatch_due_automation(10);
  second_dispatch := public.dispatch_due_automation(10);
  if first_dispatch <> 1 then raise exception 'due weekday source monitor was not dispatched once: %', first_dispatch; end if;
  if second_dispatch <> 0 then raise exception 'repeated dispatcher created a duplicate scheduled workflow'; end if;
end;
$$;

reset role;
do $$
begin
  if not exists(
    select 1 from public.discovery_jobs
    where source_id = current_setting('test.source_id')::uuid
      and next_run_at > now()
      and extract(isodow from (next_run_at at time zone 'Europe/Amsterdam')) < 6
      and extract(hour from (next_run_at at time zone 'Europe/Amsterdam')) = 7
  ) then raise exception 'dispatcher did not schedule the next local weekday at 07:00'; end if;
  if has_table_privilege('authenticated', 'public.source_health_events', 'update') then
    raise exception 'source health events must remain immutable';
  end if;
end;
$$;

-- Commercial-fit Assessments create immutable, sequential Lead versions through
-- the service-only path; human mutations must use the atomic review RPC.
select set_config('test.review_policy_id', public.ensure_current_score_policy(
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-09-24.2',
  '{"Social impact":0.12,"Technical fit":0.16,"Budget fit":0.16,"Timing fit":0.13,"Availability":0.10,"Delivery fit":0.16,"Commercial access":0.10,"Evidence confidence":0.07}'::jsonb,
  '{"firstThreshold":58,"finalThreshold":72}'::jsonb
)::text, true);

reset role;
insert into public.assessments (
  id, workspace_id, opportunity_id, assessment_type, profile_version,
  score_policy_id, dimension_results, commercial_fit, qualification_checks, overall_score,
  overall_confidence, decision, delivery_route, evidence_snapshot, execution_metadata
) values
  (
    '50111111-1111-1111-1111-111111111111', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'final', 'lead-strategy-v1',
    current_setting('test.review_policy_id')::uuid, '[]',
    '{"budgetEvidenceStatus":"confirmed","totalProjectValueEur":7000000,"addressableScopeValueEur":75000,"addressableScopeStatus":"bounded","scopeBasis":"explicit_lot","confidence":0.86,"evidenceRefs":["signal-1"],"explanation":"A bounded package is cited."}',
    '{"policyVersion":"2026-09-25.1","allPassed":true,"hardRejection":null,"checks":{"sector":"passed","actionability":"passed","commercial":"passed","capability":"passed","fitAxis":"passed","timing":"passed","contact":"passed","capacity":"passed","delivery":"passed","outreach":"passed","score":"passed"},"reasons":[]}',
    82, 0.84, 'qualify', 'direct', '[]', '{"automated":true}'
  ),
  (
    '50222222-2222-2222-2222-222222222222', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'final', 'lead-strategy-v2',
    current_setting('test.review_policy_id')::uuid, '[]',
    '{"budgetEvidenceStatus":"confirmed","totalProjectValueEur":7000000,"addressableScopeValueEur":75000,"addressableScopeStatus":"bounded","scopeBasis":"explicit_lot","confidence":0.88,"evidenceRefs":["signal-1"],"explanation":"The reassessment retained a bounded package."}',
    '{"policyVersion":"2026-09-25.1","allPassed":true,"hardRejection":null,"checks":{"sector":"passed","actionability":"passed","commercial":"passed","capability":"passed","fitAxis":"passed","timing":"passed","contact":"passed","capacity":"passed","delivery":"passed","outreach":"passed","score":"passed"},"reasons":[]}',
    84, 0.86, 'qualify', 'direct', '[]', '{"automated":true}'
  ),
  (
    '50333333-3333-3333-3333-333333333333', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'final', 'lead-strategy-v2',
    current_setting('test.review_policy_id')::uuid, '[]',
    '{"budgetEvidenceStatus":"unknown","totalProjectValueEur":null,"addressableScopeValueEur":null,"addressableScopeStatus":"unknown","scopeBasis":"unknown","confidence":0.2,"evidenceRefs":[],"explanation":"Commercial scope remains unresolved."}',
    '{"policyVersion":"2026-09-25.1","allPassed":false,"hardRejection":null,"checks":{"commercial":"unresolved","score":"review"},"reasons":["commercial: unresolved"]}',
    66, 0.70, 'research', 'direct', '[]', '{"automated":true}'
  );

set local role service_role;
do $$
begin
  begin
    perform public.create_qualified_lead_version(
      '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      '50333333-3333-3333-3333-333333333333', 'Invalid', 'Must not create', 'direct',
      '{"language":"en","recommendedChannel":"email","emailSubject":"Subject","emailBody":"Body","callOpening":"Opening","discoveryQuestions":[],"evidenceRefs":["signal-1"],"caveats":[]}', '{}'
    );
    raise exception 'non-qualifying final Assessment created a Lead';
  exception when check_violation then null;
  end;
end;
$$;
select set_config('test.lead_v1', public.create_qualified_lead_version(
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '50111111-1111-1111-1111-111111111111', 'Review now', 'Prepare a focused response', 'direct',
  '{"language":"en","recommendedChannel":"email","emailSubject":"Subject","emailBody":"Body","callOpening":"Opening","discoveryQuestions":[],"evidenceRefs":["signal-1"],"caveats":[]}', '{}'
)::text, true);
select set_config('test.lead_v2', public.create_qualified_lead_version(
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '50222222-2222-2222-2222-222222222222', 'Review again', 'Prepare the updated response', 'direct',
  '{"language":"en","recommendedChannel":"email","emailSubject":"Subject","emailBody":"Body","callOpening":"Opening","discoveryQuestions":[],"evidenceRefs":["signal-1"],"caveats":[]}', '{}'
)::text, true);
do $$
begin
  if (select version from public.leads where id = current_setting('test.lead_v1')::uuid) <> 1
    or (select version from public.leads where id = current_setting('test.lead_v2')::uuid) <> 2 then
    raise exception 'qualified Lead versions were not allocated sequentially';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select set_config('test.review_result', public.review_lead(
  current_setting('test.lead_v2')::uuid, 2, 'pursue', null,
  'Local acceptance decision', null, 'review-idempotency-1'
)::text, true);
select public.review_lead(
  current_setting('test.lead_v2')::uuid, 2, 'pursue', null,
  'Local acceptance decision', null, 'review-idempotency-1'
);
do $$
begin
  if (select status from public.leads where id = current_setting('test.lead_v2')::uuid) <> 'approved' then
    raise exception 'Pursue did not approve the current Lead';
  end if;
  if (select count(*) from public.review_events where idempotency_key = 'review-idempotency-1') <> 1 then
    raise exception 'review idempotency created duplicate immutable events';
  end if;
  begin
    perform public.review_lead(current_setting('test.lead_v1')::uuid, 1, 'pass', 'poor_fit', null, null, 'stale-review');
    raise exception 'stale Lead version was unexpectedly reviewable';
  exception when serialization_failure then null;
  end;
  begin
    insert into public.leads (
      workspace_id, opportunity_id, final_assessment_id, why_now,
      suggested_next_action, route, version
    ) values (
      '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      '50222222-2222-2222-2222-222222222222', 'Bypass', 'Bypass', 'direct', 3
    );
    raise exception 'authenticated user bypassed the qualified Lead RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.review_lead(
  current_setting('test.lead_v2')::uuid, 2, 'route_changed', 'partner_fit',
  null, 'partner', 'review-route-1'
);
select set_config('test.research_review', public.review_lead(
  current_setting('test.lead_v2')::uuid, 2, 'request_research', 'budget',
  'Verify addressable value', null, 'review-research-1'
)::text, true);
select public.review_lead(
  current_setting('test.lead_v2')::uuid, 2, 'request_research', 'budget',
  'Verify addressable value', null, 'review-research-2'
);
do $$
begin
  if (select route from public.leads where id = current_setting('test.lead_v2')::uuid) <> 'partner' then
    raise exception 'route change was not persisted';
  end if;
  if (select count(*) from public.automation_workflow_runs
      where opportunity_id = '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
        and trigger_kind = 'review_request' and status in ('queued','running')) <> 1 then
    raise exception 'repeated research requests created duplicate active workflows';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.review_lead(current_setting('test.lead_v2')::uuid, 2, 'pursue', null, null, null, 'viewer-review');
    raise exception 'viewer unexpectedly reviewed a Lead';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"54444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.review_lead(current_setting('test.lead_v2')::uuid, 2, 'pass', 'poor_fit', null, null, 'cross-workspace-review');
    raise exception 'cross-workspace owner unexpectedly reviewed a Lead';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role service_role;
insert into public.leads (
  workspace_id, opportunity_id, final_assessment_id, why_now,
  suggested_next_action, route, status, review_record, version
) values (
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '50333333-3333-3333-3333-333333333333', 'Historical mismatch',
  'Retain for requalification', 'direct', 'approved', '{"historical":true}', 3
);
do $$
declare first_run integer;
declare second_run integer;
begin
  first_run := public.quarantine_qualification_policy_mismatches();
  second_run := public.quarantine_qualification_policy_mismatches();
  if first_run < 1 or second_run <> 0 then
    raise exception 'qualification quarantine was not idempotent or missed the fixture: first %, second %', first_run, second_run;
  end if;
  if (select lifecycle_status from public.opportunities where id = '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') <> 'needs_review' then
    raise exception 'quarantine did not move the Opportunity to needs_review';
  end if;
  if (select status from public.leads where final_assessment_id = '50333333-3333-3333-3333-333333333333') <> 'approved' then
    raise exception 'quarantine rewrote the historical Lead status';
  end if;
  if (select count(*) from public.automation_exceptions
      where opportunity_id = '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
        and exception_kind = 'qualification_policy_mismatch' and status = 'open') <> 1 then
    raise exception 'quarantine did not create exactly one open policy mismatch';
  end if;
end;
$$;

update public.opportunities
set lifecycle_status = 'monitoring'
where id = '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
insert into public.research_questions (
  id, workspace_id, opportunity_id, field, question, priority,
  decision_impact, stop_rule, status
) values (
  '5f111111-1111-1111-1111-111111111111',
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'current actionability', 'Is a current follow-on publicly visible?', 1,
  'high', 'Two focused source families.', 'closed_unknown'
);
insert into public.research_findings (
  workspace_id, opportunity_id, question_id, field, status, value,
  explanation, confidence, source_refs, attempt_summary
) values (
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '5f111111-1111-1111-1111-111111111111',
  'current actionability', 'not_found', null,
  'Two focused passes found no current follow-on.', 0.3, '[]',
  '{"pass":2,"bundle":"timing","consultedUrls":["https://example.nl/notice"],"citedUrls":[]}'
);
do $$
begin
  if (select lifecycle_status from public.opportunities where id = '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') <> 'monitoring' then
    raise exception 'monitoring lifecycle state was not persisted';
  end if;
  if (select count(*) from public.research_findings where question_id = '5f111111-1111-1111-1111-111111111111') <> 1 then
    raise exception 'not-found research attempt without claim citations was not retained';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.automation_stage_runs'::regclass
      and conname = 'automation_stage_runs_pass_check'
      and pg_get_constraintdef(oid) like '%pass <= 8%'
  ) then
    raise exception 'focused research pass bound is not eight';
  end if;
end;
$$;

-- A reviewer may deliberately create a clearly attributed manual pursuit Lead
-- from a completed non-qualifying Opportunity. The automated assessment and
-- lifecycle remain unchanged, hard exclusions remain non-overridable, and a
-- repeated idempotency key must replay the original result.
reset role;
insert into public.organizations (id, workspace_id, name, normalized_name)
values (
  '56aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Seasonal pursuit target',
  'seasonal pursuit target'
);
insert into public.opportunities (
  id, workspace_id, organization_id, title, description,
  lifecycle_status, discovery_key, missing_fields
) values (
  '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '56aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Promising platform programme',
  'A current opportunity with unresolved commercial evidence.',
  'needs_review', 'manual-pursuit-fixture', array['confirmed budget','confirmed contact']
);
insert into public.signals (
  id, workspace_id, source_id, source_item_id, canonical_url, title, raw_text,
  publisher, published_at, signal_type, content_fingerprint, processing_metadata
) values (
  '56cccccc-cccc-cccc-cccc-cccccccccccc',
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  current_setting('test.source_id')::uuid, 'manual-pursuit-source-item',
  'https://example.test/news/promising-platform-programme',
  'Promising platform programme',
  'The organisation announced a current platform programme, but no public budget or named contact.',
  'Example public newsroom', now(), 'strategy', 'manual-pursuit-fingerprint',
  '{"provenance_status":"verified"}'
);
insert into public.opportunity_signals (workspace_id, opportunity_id, signal_id, link_reason)
values (
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '56cccccc-cccc-cccc-cccc-cccccccccccc',
  'Acceptance-test evidence'
);
insert into public.assessments (
  id, workspace_id, opportunity_id, assessment_type, profile_version,
  score_policy_id, dimension_results, commercial_fit, qualification_checks,
  overall_score, overall_confidence, decision, delivery_route,
  evidence_snapshot, execution_metadata
) values (
  '56dddddd-dddd-dddd-dddd-dddddddddddd',
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'final', 'lead-strategy-manual-test', current_setting('test.review_policy_id')::uuid,
  '[]',
  '{"budgetEvidenceStatus":"unknown","totalProjectValueEur":null,"addressableScopeValueEur":null,"addressableScopeStatus":"unknown","scopeBasis":"unknown","confidence":0.30,"evidenceRefs":[],"explanation":"Budget remains unresolved."}',
  '{"policyVersion":"2026-09-25.1","allPassed":false,"hardRejection":null,"checks":{"sector":"passed","actionability":"passed","commercial":"unresolved","contact":"unresolved","score":"review"},"reasons":["commercial: unresolved","contact: unresolved"]}',
  68, 0.66, 'research', 'direct', '[]', '{"automated":true}'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select set_config('test.manual_promotion_result', public.promote_opportunity_to_pursuit(
  '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '56dddddd-dddd-dddd-dddd-dddddddddddd',
  'seasonal_capacity', 'Local acceptance promotion', 'direct', 'en',
  'manual-promotion-idempotency-1'
)::text, true);
select public.promote_opportunity_to_pursuit(
  '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '56dddddd-dddd-dddd-dddd-dddddddddddd',
  'seasonal_capacity', 'Local acceptance promotion', 'direct', 'en',
  'manual-promotion-idempotency-1'
);
do $$
begin
  if (select lifecycle_status from public.opportunities where id = '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') <> 'needs_review' then
    raise exception 'manual promotion rewrote the automated lifecycle';
  end if;
  if (select count(*) from public.leads where opportunity_id = '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and origin = 'manual_promotion') <> 1 then
    raise exception 'manual promotion did not create exactly one attributed Lead';
  end if;
  if (select promoted_by from public.leads where opportunity_id = '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') <> '52222222-2222-2222-2222-222222222222'::uuid then
    raise exception 'manual promotion did not attribute the reviewer';
  end if;
  if (select outreach_draft ->> 'language' from public.leads where opportunity_id = '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') <> 'en' then
    raise exception 'manual promotion did not create the requested outreach snapshot';
  end if;
  if (select count(*) from public.review_events where idempotency_key = 'manual-promotion-idempotency-1') <> 1 then
    raise exception 'manual promotion idempotency created duplicate review events';
  end if;
end;
$$;

reset role;
update public.assessments
set qualification_checks = '{"policyVersion":"legacy","allPassed":false,"hardRejection":null,"checks":{"commercial":"unresolved"},"reasons":["policy gates unavailable"]}'
where id = '56dddddd-dddd-dddd-dddd-dddddddddddd';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.promote_opportunity_to_pursuit(
      '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '56dddddd-dddd-dddd-dddd-dddddddddddd',
      'strategic_interest', null, 'direct', 'en', 'missing-policy-gates'
    );
    raise exception 'manual promotion accepted an Assessment without explicit sector/actionability checks';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
update public.assessments
set qualification_checks = '{"policyVersion":"2026-09-25.1","allPassed":false,"hardRejection":"hard_excluded_sector","checks":{"sector":"rejected","actionability":"passed"},"reasons":["sector: rejected"]}'
where id = '56dddddd-dddd-dddd-dddd-dddddddddddd';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.promote_opportunity_to_pursuit(
      '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '56dddddd-dddd-dddd-dddd-dddddddddddd',
      'strategic_interest', null, 'direct', 'en', 'hard-sector-promotion'
    );
    raise exception 'manual promotion overrode a hard-excluded sector';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.promote_opportunity_to_pursuit(
      '56bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '56dddddd-dddd-dddd-dddd-dddddddddddd',
      'strategic_interest', null, 'direct', 'en', 'viewer-manual-promotion'
    );
    raise exception 'viewer unexpectedly promoted an Opportunity';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
