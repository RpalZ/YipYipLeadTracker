begin;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '51111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'automation-owner@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '52222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'automation-reviewer@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '53333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'automation-viewer@example.test', now(), now()),
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
from public.claim_automation_stage('acceptance-worker', 15)
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
from public.claim_automation_stage('recovery-worker', 30)
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
  score_policy_id, dimension_results, commercial_fit, overall_score,
  overall_confidence, decision, delivery_route, evidence_snapshot, execution_metadata
) values
  (
    '50111111-1111-1111-1111-111111111111', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'final', 'lead-strategy-v1',
    current_setting('test.review_policy_id')::uuid, '[]',
    '{"budgetEvidenceStatus":"confirmed","totalProjectValueEur":7000000,"addressableScopeValueEur":75000,"addressableScopeStatus":"bounded","confidence":0.86,"evidenceRefs":["signal-1"],"explanation":"A bounded package is cited."}',
    82, 0.84, 'qualify', 'direct', '[]', '{"automated":true}'
  ),
  (
    '50222222-2222-2222-2222-222222222222', '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'final', 'lead-strategy-v2',
    current_setting('test.review_policy_id')::uuid, '[]',
    '{"budgetEvidenceStatus":"confirmed","totalProjectValueEur":7000000,"addressableScopeValueEur":75000,"addressableScopeStatus":"bounded","confidence":0.88,"evidenceRefs":["signal-1"],"explanation":"The reassessment retained a bounded package."}',
    84, 0.86, 'qualify', 'direct', '[]', '{"automated":true}'
  );

set local role service_role;
select set_config('test.lead_v1', public.create_qualified_lead_version(
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '50111111-1111-1111-1111-111111111111', 'Review now', 'Prepare a focused response', 'direct', '{}'
)::text, true);
select set_config('test.lead_v2', public.create_qualified_lead_version(
  '5aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5eeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '50222222-2222-2222-2222-222222222222', 'Review again', 'Prepare the updated response', 'direct', '{}'
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

rollback;
