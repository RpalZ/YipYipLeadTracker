-- Manually triggered, agent-driven opportunity discovery. The external model
-- call happens in application code; these invoker RPCs only coordinate short,
-- atomic persistence phases under the authenticated actor's workspace role.

create type public.discovery_run_status as enum ('queued', 'running', 'succeeded', 'partial', 'failed');
create type public.discovery_result_status as enum ('accepted', 'rejected', 'duplicate');

alter table public.organizations
  add constraint organizations_workspace_id_id_key unique (workspace_id, id);
alter table public.signals
  add constraint signals_workspace_id_id_key unique (workspace_id, id);
alter table public.opportunities
  add column discovery_key text,
  add constraint opportunities_workspace_id_id_key unique (workspace_id, id);
create unique index opportunities_workspace_discovery_key_idx
  on public.opportunities (workspace_id, discovery_key)
  where discovery_key is not null;

alter table public.signals drop constraint signals_source_id_fkey;
alter table public.signals
  add constraint signals_workspace_source_fkey
  foreign key (workspace_id, source_id)
  references public.source_registry(workspace_id, id) on delete restrict;

alter table public.opportunities drop constraint opportunities_organization_id_fkey;
alter table public.opportunities
  add constraint opportunities_workspace_organization_fkey
  foreign key (workspace_id, organization_id)
  references public.organizations(workspace_id, id) on delete restrict;

alter table public.opportunity_signals drop constraint opportunity_signals_opportunity_id_fkey;
alter table public.opportunity_signals drop constraint opportunity_signals_signal_id_fkey;
alter table public.opportunity_signals
  add constraint opportunity_signals_workspace_opportunity_fkey
  foreign key (workspace_id, opportunity_id)
  references public.opportunities(workspace_id, id) on delete cascade;
alter table public.opportunity_signals
  add constraint opportunity_signals_workspace_signal_fkey
  foreign key (workspace_id, signal_id)
  references public.signals(workspace_id, id) on delete restrict;

create table public.discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  coverage_profile_id uuid not null,
  source_id uuid not null,
  job_key text not null check (job_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  enabled boolean not null default false,
  cadence text not null default 'manual' check (cadence = 'manual'),
  result_limit integer not null default 5 check (result_limit between 1 and 5),
  max_turns integer not null default 5 check (max_turns between 1 and 5),
  timeout_seconds integer not null default 60 check (timeout_seconds between 1 and 60),
  max_output_tokens integer not null default 1200 check (max_output_tokens between 1 and 1200),
  estimated_cost_limit numeric(8,4) not null default 0.5 check (estimated_cost_limit between 0 and 0.5),
  model text not null default 'gpt-5.4-mini-2026-03-17',
  prompt_version text not null default 'dutch-agency-pitches-v1',
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, job_key, version),
  unique (workspace_id, id),
  foreign key (workspace_id, coverage_profile_id)
    references public.discovery_coverage_profiles(workspace_id, id) on delete restrict,
  foreign key (workspace_id, source_id)
    references public.source_registry(workspace_id, id) on delete restrict
);
create unique index discovery_jobs_active_key_idx
  on public.discovery_jobs (workspace_id, job_key) where enabled;
create index discovery_jobs_workspace_idx on public.discovery_jobs (workspace_id, updated_at desc);
create index discovery_jobs_profile_idx on public.discovery_jobs (coverage_profile_id);
create index discovery_jobs_source_idx on public.discovery_jobs (source_id);

create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null,
  coverage_profile_id uuid not null,
  source_id uuid not null,
  triggered_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  status public.discovery_run_status not null default 'queued',
  job_version integer not null,
  profile_version integer not null,
  source_version integer not null,
  model text not null,
  prompt_version text not null,
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  stop_reason text,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  opportunities_created integer not null default 0 check (opportunities_created >= 0),
  opportunities_matched integer not null default 0 check (opportunities_matched >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost numeric(10,6) not null default 0 check (estimated_cost >= 0),
  cost_currency text not null default 'EUR' check (cost_currency = 'EUR'),
  cost_overrun boolean not null default false,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  search_queries jsonb not null default '[]'::jsonb check (jsonb_typeof(search_queries) = 'array'),
  consulted_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(consulted_urls) = 'array'),
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  error_code text,
  failure_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, idempotency_key),
  unique (workspace_id, id),
  foreign key (workspace_id, job_id)
    references public.discovery_jobs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, coverage_profile_id)
    references public.discovery_coverage_profiles(workspace_id, id) on delete restrict,
  foreign key (workspace_id, source_id)
    references public.source_registry(workspace_id, id) on delete restrict,
  check (accepted_count + rejected_count + duplicate_count <= candidate_count)
);
create unique index discovery_runs_one_active_per_job_idx
  on public.discovery_runs (job_id) where status in ('queued', 'running');
create index discovery_runs_workspace_created_idx on public.discovery_runs (workspace_id, created_at desc);
create index discovery_runs_job_created_idx on public.discovery_runs (job_id, created_at desc);

create table public.discovery_run_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null,
  ordinal integer not null check (ordinal between 1 and 5),
  status public.discovery_result_status not null,
  canonical_url text,
  content_fingerprint text,
  opportunity_key text,
  title text not null,
  organization_name text not null,
  publisher text,
  publication_date date,
  signal_type text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_excerpt text not null check (length(evidence_excerpt) <= 500),
  structured_output jsonb not null check (jsonb_typeof(structured_output) = 'object'),
  rejection_reasons text[] not null default '{}',
  signal_id uuid,
  opportunity_id uuid,
  created_at timestamptz not null default now(),
  unique (run_id, ordinal),
  foreign key (workspace_id, run_id)
    references public.discovery_runs(workspace_id, id) on delete cascade,
  foreign key (workspace_id, signal_id)
    references public.signals(workspace_id, id) on delete restrict,
  foreign key (workspace_id, opportunity_id)
    references public.opportunities(workspace_id, id) on delete restrict,
  check ((status = 'accepted' and signal_id is not null and opportunity_id is not null)
    or (status in ('rejected', 'duplicate')))
);
create index discovery_run_results_workspace_idx on public.discovery_run_results (workspace_id, created_at desc);
create index discovery_run_results_signal_idx on public.discovery_run_results (signal_id) where signal_id is not null;
create index discovery_run_results_opportunity_idx on public.discovery_run_results (opportunity_id) where opportunity_id is not null;

create table public.source_health_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid not null,
  run_id uuid,
  previous_health public.source_health not null,
  current_health public.source_health not null,
  policy_version text not null,
  reason text not null,
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  evaluated_at timestamptz not null default now(),
  evaluated_by uuid not null references auth.users(id) on delete restrict,
  foreign key (workspace_id, source_id)
    references public.source_registry(workspace_id, id) on delete restrict,
  foreign key (workspace_id, run_id)
    references public.discovery_runs(workspace_id, id) on delete restrict
);
create index source_health_events_source_idx on public.source_health_events (source_id, evaluated_at desc);
create index source_health_events_workspace_idx on public.source_health_events (workspace_id, evaluated_at desc);

create trigger discovery_jobs_set_updated_at before update on public.discovery_jobs
for each row execute function private.set_updated_at();

alter table public.discovery_jobs enable row level security;
alter table public.discovery_runs enable row level security;
alter table public.discovery_run_results enable row level security;
alter table public.source_health_events enable row level security;

create policy "members can read discovery jobs" on public.discovery_jobs
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert discovery jobs" on public.discovery_jobs
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "operators can update discovery jobs" on public.discovery_jobs
for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));

create policy "members can read discovery runs" on public.discovery_runs
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert discovery runs" on public.discovery_runs
for insert to authenticated with check (
  triggered_by = (select auth.uid())
  and (select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[]))
);
create policy "operators can update discovery runs" on public.discovery_runs
for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "operators can read discovery results" on public.discovery_run_results
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert discovery results" on public.discovery_run_results
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "members can read source health events" on public.source_health_events
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert source health events" on public.source_health_events
for insert to authenticated with check (
  evaluated_by = (select auth.uid())
  and (select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[]))
);

revoke all on public.discovery_jobs, public.discovery_runs, public.discovery_run_results, public.source_health_events from authenticated;
grant select, insert, update on public.discovery_jobs to authenticated;
grant select, insert, update on public.discovery_runs to authenticated;
grant select, insert on public.discovery_run_results, public.source_health_events to authenticated;
revoke all on public.discovery_jobs, public.discovery_runs, public.discovery_run_results, public.source_health_events from anon;

create or replace function public.bootstrap_dutch_agency_discovery(p_workspace_id uuid)
returns table (profile_id uuid, source_id uuid, job_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not (select private.has_workspace_role(p_workspace_id, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;

  insert into public.discovery_coverage_profiles (
    workspace_id, profile_key, name, description, status, is_default, signal_areas,
    regions, languages, project_types, negative_terms, project_clues, lookback,
    evidence_preferences, cadence, result_limit, cost_limit, allow_source_proposals,
    created_by, changed_by, change_note
  ) values (
    p_workspace_id, 'dutch-agency-pitches', 'Dutch Agency Pitches',
    'Recommended manual profile for concrete Dutch digital-agency opportunity signals.',
    'active', true,
    array['pitching','newsletters','strategy','hiring','announcements']::public.discovery_signal_area[],
    array['Netherlands'], array['nl','en'],
    array['websites','digital products','platforms','apps','redesigns','rebrands','campaigns','agency reviews'],
    array['completed projects','awarded projects','closed pitches','unrelated vacancies','restricted social-platform scraping'],
    array['procurement preparation','agency review','platform replacement','digital strategy execution'],
    interval '90 days', '{"require_citations":true,"minimum_confidence":0.65}'::jsonb,
    'manual', 5, 0.50, false, actor_id, actor_id, 'Recommended one-click discovery profile'
  )
  on conflict (workspace_id, profile_key) where status = 'active'
  do update set changed_by = actor_id, updated_at = now()
  returning id into profile_id;

  insert into public.source_registry (
    workspace_id, name, source_family, owner, jurisdiction, adapter_type,
    permitted_method, privacy_class, retention_policy, enabled, cadence, lookback,
    search_config, controls, health, alert_owner, changed_by, change_note
  ) values (
    p_workspace_id, 'Dutch Agency Pitches Query Pack', 'agent_query_pack', 'YipYip operators',
    'NL', 'openai_hosted_web_search', 'hosted web search', 'public',
    '{"structured_outputs":"retained","webpage_bodies":"not_retained"}'::jsonb,
    false, 'manual', interval '90 days',
    '{"signal_areas":["pitching","newsletters","strategy","hiring","announcements"],"languages":["nl","en"],"region":"Netherlands"}'::jsonb,
    '{"max_candidates":5,"max_turns":5,"timeout_seconds":60,"max_output_tokens":1200,"estimated_cost_eur":0.5}'::jsonb,
    'paused', 'YipYip operators', actor_id, 'Governed query pack; disabled until explicit confirmation'
  )
  on conflict (workspace_id, name, version)
  do update set changed_by = actor_id, updated_at = now()
  returning id into source_id;

  insert into public.coverage_profile_sources (
    workspace_id, coverage_profile_id, source_id, signal_areas, link_rationale, linked_by
  ) values (
    p_workspace_id, profile_id, source_id,
    array['pitching','newsletters','strategy','hiring','announcements']::public.discovery_signal_area[],
    'Internal hosted-search query pack governed by this profile.', actor_id
  ) on conflict on constraint coverage_profile_sources_pkey do nothing;

  insert into public.discovery_jobs (
    workspace_id, coverage_profile_id, source_id, job_key, name, enabled, created_by, changed_by
  ) values (
    p_workspace_id, profile_id, source_id, 'dutch-agency-pitches-manual',
    'Dutch Agency Pitches — manual discovery', false, actor_id, actor_id
  )
  on conflict (workspace_id, job_key, version)
  do update set changed_by = actor_id, updated_at = now()
  returning id into job_id;

  return next;
end;
$$;

create or replace function public.set_discovery_job_enabled(p_job_id uuid, p_enabled boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.discovery_jobs%rowtype;
  old_health public.source_health;
begin
  select * into target from public.discovery_jobs where id = p_job_id;
  if not found or not (select private.has_workspace_role(target.workspace_id, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;
  select health into old_health from public.source_registry where id = target.source_id;
  update public.discovery_jobs set enabled = p_enabled, changed_by = (select auth.uid()) where id = p_job_id;
  update public.source_registry
    set enabled = p_enabled, health = case when p_enabled then 'degraded'::public.source_health else 'paused'::public.source_health end,
      changed_by = (select auth.uid()), change_note = case when p_enabled then 'Query pack explicitly enabled' else 'Query pack disabled' end
    where id = target.source_id;
  insert into public.source_health_events (
    workspace_id, source_id, previous_health, current_health, policy_version, reason, metrics, evaluated_by
  ) values (
    target.workspace_id, target.source_id, old_health,
    case when p_enabled then 'degraded'::public.source_health else 'paused'::public.source_health end,
    'discovery-health-v1', case when p_enabled then 'enabled_awaiting_run' else 'source_or_job_disabled' end,
    '{}'::jsonb, (select auth.uid())
  );
end;
$$;

create or replace function public.start_discovery_run(p_workspace_id uuid, p_job_id uuid, p_idempotency_key text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.discovery_jobs%rowtype;
  target_profile public.discovery_coverage_profiles%rowtype;
  target_source public.source_registry%rowtype;
  run_id uuid;
begin
  if (select auth.uid()) is null or not (select private.has_workspace_role(p_workspace_id, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'owner or operator role required' using errcode = '42501';
  end if;
  select * into target from public.discovery_jobs where id = p_job_id and workspace_id = p_workspace_id;
  if not found or not target.enabled then raise exception 'enabled discovery job required' using errcode = '55000'; end if;
  select * into target_profile from public.discovery_coverage_profiles where id = target.coverage_profile_id and workspace_id = p_workspace_id;
  select * into target_source from public.source_registry where id = target.source_id and workspace_id = p_workspace_id;
  if target_profile.status <> 'active' or not target_source.enabled then
    raise exception 'active profile and enabled source required' using errcode = '55000';
  end if;

  insert into public.discovery_runs (
    workspace_id, job_id, coverage_profile_id, source_id, triggered_by, idempotency_key,
    status, job_version, profile_version, source_version, model, prompt_version, limits, started_at
  ) values (
    p_workspace_id, target.id, target.coverage_profile_id, target.source_id, (select auth.uid()), p_idempotency_key,
    'running', target.version, target_profile.version, target_source.version, target.model, target.prompt_version,
    jsonb_build_object('max_candidates', target.result_limit, 'max_turns', target.max_turns,
      'timeout_seconds', target.timeout_seconds, 'max_output_tokens', target.max_output_tokens,
      'estimated_cost_eur', target.estimated_cost_limit), now()
  ) returning id into run_id;
  update public.source_registry set last_attempt_at = now() where id = target.source_id;
  return run_id;
end;
$$;

create or replace function public.complete_discovery_run(
  p_run_id uuid, p_results jsonb, p_telemetry jsonb, p_health jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.discovery_runs%rowtype;
  item jsonb;
  candidate jsonb;
  result_status public.discovery_result_status;
  v_org_id uuid;
  v_signal_id uuid;
  v_opportunity_id uuid;
  existed boolean;
  v_created_count integer := 0;
  v_matched_count integer := 0;
  v_accepted_count integer := 0;
  v_rejected_count integer := 0;
  v_duplicate_count integer := 0;
  item_ordinal integer := 0;
  old_health public.source_health;
  new_health public.source_health;
begin
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 5 then
    raise exception 'results must be an array of at most five items' using errcode = '22023';
  end if;
  select * into target from public.discovery_runs where id = p_run_id for update;
  if not found or target.status <> 'running' or not (select private.has_workspace_role(target.workspace_id, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'active authorized discovery run required' using errcode = '42501';
  end if;

  for item in select value from jsonb_array_elements(p_results) loop
    item_ordinal := item_ordinal + 1;
    candidate := item -> 'candidate';
    if coalesce((item ->> 'accepted')::boolean, false) then
      insert into public.organizations (workspace_id, name, normalized_name, country_code, metadata)
      values (target.workspace_id, candidate ->> 'organization', item ->> 'normalizedOrganization', 'NL',
        jsonb_build_object('location', coalesce(candidate ->> 'location', 'Netherlands')))
      on conflict (workspace_id, normalized_name)
      do update set name = excluded.name, updated_at = now()
      returning id into v_org_id;

      insert into public.signals (
        workspace_id, source_id, source_item_id, canonical_url, title, raw_text, publisher,
        published_at, signal_type, organization_mentions, extracted_facts, extracted_inferences,
        content_fingerprint, processing_metadata
      ) values (
        target.workspace_id, target.source_id, item ->> 'canonicalUrl', item ->> 'canonicalUrl',
        candidate ->> 'title', candidate ->> 'evidenceExcerpt', candidate ->> 'publisher',
        case when candidate ->> 'publicationDate' is null then null else ((candidate ->> 'publicationDate')::date)::timestamptz end,
        case candidate ->> 'signalType'
          when 'pitching' then 'pitch'::public.signal_type
          when 'strategy' then 'strategy'::public.signal_type
          when 'hiring' then 'hiring'::public.signal_type
          else 'other'::public.signal_type end,
        jsonb_build_array(candidate ->> 'organization'), candidate -> 'facts', candidate -> 'inferences',
        item ->> 'fingerprint',
        jsonb_build_object('provenance_status','confirmed','discovery_run_id',target.id,'confidence',candidate -> 'confidence')
      )
      on conflict (source_id, canonical_url, content_fingerprint)
      do nothing;
      select id into v_signal_id
      from public.signals
      where source_id = target.source_id
        and canonical_url = item ->> 'canonicalUrl'
        and content_fingerprint = item ->> 'fingerprint';

      select exists(select 1 from public.opportunities where workspace_id = target.workspace_id and discovery_key = item ->> 'opportunityKey') into existed;
      insert into public.opportunities (
        workspace_id, organization_id, title, description, maturity_stage, technical_scope,
        budget, timeline, missing_fields, lifecycle_status, resolution_metadata, discovery_key
      ) values (
        target.workspace_id, v_org_id, candidate ->> 'title', candidate ->> 'summary',
        (candidate ->> 'maturity')::public.maturity_stage,
        jsonb_build_object('difficulty', candidate ->> 'technicalDifficulty', 'work_mode', coalesce(candidate ->> 'workMode','Unknown'),
          'project_clues', candidate -> 'projectClues', 'inferred', true),
        jsonb_build_object('label', coalesce(candidate ->> 'budgetClue','Budget not confirmed'), 'inferred', (candidate ->> 'budgetClue') is not null),
        jsonb_build_object('label', coalesce(candidate ->> 'timingClue','Timing not confirmed'), 'inferred', (candidate ->> 'timingClue') is not null),
        array['assessment','confirmed budget','confirmed contact'], 'discovered',
        jsonb_build_object('contact_hint', coalesce(candidate ->> 'contactClue','Contact research pending'),
          'why_now', candidate ->> 'whyNow', 'agent_confidence', candidate -> 'confidence', 'facts', candidate -> 'facts', 'inferences', candidate -> 'inferences'),
        item ->> 'opportunityKey'
      )
      on conflict (workspace_id, discovery_key) where discovery_key is not null
      do update set description = excluded.description, technical_scope = excluded.technical_scope,
        budget = excluded.budget, timeline = excluded.timeline, resolution_metadata = excluded.resolution_metadata,
        updated_at = now()
      returning id into v_opportunity_id;

      insert into public.opportunity_signals (workspace_id, opportunity_id, signal_id, linked_by, link_reason)
      values (target.workspace_id, v_opportunity_id, v_signal_id, (select auth.uid()), 'Exact deterministic discovery key')
      on conflict on constraint opportunity_signals_pkey do nothing;
      v_accepted_count := v_accepted_count + 1;
      if existed then v_matched_count := v_matched_count + 1; else v_created_count := v_created_count + 1; end if;
      result_status := 'accepted';
    else
      result_status := case when 'duplicate_candidate' = any(array(select jsonb_array_elements_text(item -> 'rejectionReasons')))
        then 'duplicate'::public.discovery_result_status else 'rejected'::public.discovery_result_status end;
      if result_status = 'duplicate' then v_duplicate_count := v_duplicate_count + 1; else v_rejected_count := v_rejected_count + 1; end if;
      v_signal_id := null;
      v_opportunity_id := null;
    end if;

    insert into public.discovery_run_results (
      workspace_id, run_id, ordinal, status, canonical_url, content_fingerprint, opportunity_key,
      title, organization_name, publisher, publication_date, signal_type, confidence,
      evidence_excerpt, structured_output, rejection_reasons, signal_id, opportunity_id
    ) values (
      target.workspace_id, target.id, item_ordinal, result_status, item ->> 'canonicalUrl', item ->> 'fingerprint', item ->> 'opportunityKey',
      candidate ->> 'title', candidate ->> 'organization', candidate ->> 'publisher',
      case when candidate ->> 'publicationDate' is null then null else (candidate ->> 'publicationDate')::date end,
      candidate ->> 'signalType', (candidate ->> 'confidence')::numeric, candidate ->> 'evidenceExcerpt',
      candidate, array(select jsonb_array_elements_text(item -> 'rejectionReasons')), v_signal_id, v_opportunity_id
    );
  end loop;

  update public.discovery_runs set
    status = case when coalesce((p_telemetry ->> 'partial')::boolean, false) then 'partial'::public.discovery_run_status else 'succeeded'::public.discovery_run_status end,
    stop_reason = coalesce(p_telemetry ->> 'stopReason','completed'), candidate_count = item_ordinal,
    accepted_count = v_accepted_count, rejected_count = v_rejected_count, duplicate_count = v_duplicate_count,
    opportunities_created = v_created_count, opportunities_matched = v_matched_count,
    input_tokens = coalesce((p_telemetry ->> 'inputTokens')::integer,0),
    output_tokens = coalesce((p_telemetry ->> 'outputTokens')::integer,0),
    total_tokens = coalesce((p_telemetry ->> 'totalTokens')::integer,0),
    estimated_cost = coalesce((p_telemetry ->> 'estimatedCostEur')::numeric,0),
    cost_overrun = coalesce((p_telemetry ->> 'costEnvelopeExceeded')::boolean,false),
    duration_ms = (p_telemetry ->> 'durationMs')::integer,
    search_queries = coalesce(p_telemetry -> 'searchQueries','[]'::jsonb),
    consulted_urls = coalesce(p_telemetry -> 'consultedUrls','[]'::jsonb),
    validation_errors = coalesce(p_telemetry -> 'validationErrors','[]'::jsonb),
    finished_at = now()
  where id = target.id;

  select health into old_health from public.source_registry where id = target.source_id;
  new_health := (p_health ->> 'health')::public.source_health;
  update public.source_registry set health = new_health, last_success_at = now(),
    error_rate = coalesce((p_health -> 'metrics' ->> 'recentFailureRate')::numeric,0)
  where id = target.source_id;
  insert into public.source_health_events (
    workspace_id, source_id, run_id, previous_health, current_health, policy_version, reason, metrics, evaluated_by
  ) values (
    target.workspace_id, target.source_id, target.id, old_health, new_health,
    p_health ->> 'policyVersion', p_health ->> 'reason', p_health -> 'metrics', (select auth.uid())
  );
  return jsonb_build_object('opportunitiesCreated',v_created_count,'opportunitiesMatched',v_matched_count,
    'accepted',v_accepted_count,'rejected',v_rejected_count,'duplicates',v_duplicate_count);
end;
$$;

create or replace function public.fail_discovery_run(
  p_run_id uuid, p_error_code text, p_failure_reason text, p_duration_ms integer, p_health jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.discovery_runs%rowtype;
  old_health public.source_health;
  new_health public.source_health;
begin
  select * into target from public.discovery_runs where id = p_run_id for update;
  if not found or target.status <> 'running' or not (select private.has_workspace_role(target.workspace_id, array['owner', 'operator']::public.workspace_role[])) then
    raise exception 'active authorized discovery run required' using errcode = '42501';
  end if;
  update public.discovery_runs set
    status = case when p_error_code in ('time_limit','cost_limit','turn_limit') then 'partial'::public.discovery_run_status else 'failed'::public.discovery_run_status end,
    stop_reason = case when p_error_code in ('time_limit','cost_limit','turn_limit') then p_error_code else 'error' end,
    error_code = left(p_error_code,80),
    failure_reason = left(p_failure_reason,500), duration_ms = p_duration_ms, finished_at = now() where id = target.id;
  select health into old_health from public.source_registry where id = target.source_id;
  new_health := (p_health ->> 'health')::public.source_health;
  update public.source_registry set health = new_health,
    error_rate = coalesce((p_health -> 'metrics' ->> 'recentFailureRate')::numeric,1)
  where id = target.source_id;
  insert into public.source_health_events (
    workspace_id, source_id, run_id, previous_health, current_health, policy_version, reason, metrics, evaluated_by
  ) values (
    target.workspace_id, target.source_id, target.id, old_health, new_health,
    p_health ->> 'policyVersion', p_health ->> 'reason', p_health -> 'metrics', (select auth.uid())
  );
end;
$$;

revoke all on function public.bootstrap_dutch_agency_discovery(uuid) from public, anon;
revoke all on function public.set_discovery_job_enabled(uuid, boolean) from public, anon;
revoke all on function public.start_discovery_run(uuid, uuid, text) from public, anon;
revoke all on function public.complete_discovery_run(uuid, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.fail_discovery_run(uuid, text, text, integer, jsonb) from public, anon;
grant execute on function public.bootstrap_dutch_agency_discovery(uuid) to authenticated;
grant execute on function public.set_discovery_job_enabled(uuid, boolean) to authenticated;
grant execute on function public.start_discovery_run(uuid, uuid, text) to authenticated;
grant execute on function public.complete_discovery_run(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.fail_discovery_run(uuid, text, text, integer, jsonb) to authenticated;

create or replace view public.opportunity_dashboard
with (security_invoker = true)
as
select
  opportunity.id,
  opportunity.workspace_id,
  organization.name as organization,
  opportunity.title,
  opportunity.description,
  opportunity.maturity_stage,
  opportunity.lifecycle_status,
  opportunity.technical_scope,
  opportunity.budget,
  opportunity.missing_fields,
  organization.metadata ->> 'location' as location,
  opportunity.resolution_metadata ->> 'contact_hint' as contact_hint,
  coalesce(signal_summary.first_seen_at, opportunity.created_at) as first_seen_at,
  coalesce(signal_summary.signal_count, 0)::integer as signal_count,
  signal_summary.primary_signal_type,
  assessment.overall_score as score,
  assessment.overall_confidence as confidence,
  assessment.assessed_at as last_assessed_at,
  assessment.dimension_results as dimensions,
  coalesce(lead.route::text,
    case assessment.delivery_route when 'direct' then 'direct' when 'partner' then 'partner'
      when 'consortium' then 'partner' when 'unsuitable' then 'unsuitable' else 'monitor' end) as route,
  coalesce(lead.why_now, opportunity.resolution_metadata ->> 'why_now') as why_now,
  lead.suggested_next_action,
  opportunity.updated_at,
  coalesce(signal_summary.evidence, '[]'::jsonb) as evidence
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
  select candidate.overall_score, candidate.overall_confidence, candidate.assessed_at,
    candidate.dimension_results, candidate.delivery_route
  from public.assessments as candidate
  where candidate.opportunity_id = opportunity.id
  order by candidate.assessed_at desc limit 1
) as assessment on true
left join lateral (
  select candidate.route, candidate.why_now, candidate.suggested_next_action
  from public.leads as candidate
  where candidate.opportunity_id = opportunity.id
  order by candidate.version desc, candidate.created_at desc limit 1
) as lead on true;

grant select on public.opportunity_dashboard to authenticated;
