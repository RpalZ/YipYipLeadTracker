-- YipYip Early Signal MVP schema
-- Internal workspaces isolate records while organizations represent lead targets.

create schema if not exists private;
revoke all on schema private from public, anon;

create type public.workspace_role as enum ('owner', 'operator', 'reviewer', 'viewer');
create type public.source_health as enum ('healthy', 'degraded', 'paused', 'failing');
create type public.signal_type as enum ('funding', 'hiring', 'pitch', 'strategy', 'project', 'consultation', 'policy', 'roadmap', 'other');
create type public.maturity_stage as enum ('early_signal', 'exploring', 'funded', 'planning', 'selecting', 'formalized', 'closed');
create type public.lifecycle_status as enum ('discovered', 'assessing', 'rejected', 'needs_research', 'ready_for_final_assessment', 'needs_review', 'qualified', 'delivered');
create type public.assessment_type as enum ('initial', 'final', 'human_adjusted');
create type public.assessment_decision as enum ('reject', 'research', 'review', 'qualify', 'nurture', 'monitor');
create type public.delivery_route as enum ('direct', 'partner', 'consortium', 'unsuitable');
create type public.finding_status as enum ('confirmed', 'strongly_inferred', 'contradicted', 'not_found', 'unknown');
create type public.lead_route as enum ('direct', 'partner', 'nurture', 'monitor');
create type public.lead_status as enum ('draft', 'in_review', 'approved', 'delivered', 'accepted', 'rejected', 'archived');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id, workspace_id);

create table public.source_registry (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  source_family text not null,
  owner text,
  jurisdiction text,
  base_url text,
  adapter_type text not null,
  permitted_method text not null,
  auth_ref text,
  terms_note text,
  privacy_class text not null default 'public',
  retention_policy jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  cadence text,
  lookback interval,
  checkpoint jsonb not null default '{}'::jsonb,
  timezone text not null default 'Europe/Amsterdam',
  search_config jsonb not null default '{}'::jsonb,
  controls jsonb not null default '{}'::jsonb,
  health public.source_health not null default 'paused',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  error_rate numeric(5,4) check (error_rate between 0 and 1),
  alert_owner text,
  version integer not null default 1 check (version > 0),
  effective_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  change_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name, version)
);
create index source_registry_workspace_enabled_idx on public.source_registry (workspace_id, enabled);
create index source_registry_changed_by_idx on public.source_registry (changed_by) where changed_by is not null;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  normalized_name text not null,
  domain text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, normalized_name)
);
create index organizations_workspace_name_idx on public.organizations (workspace_id, normalized_name);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid not null references public.source_registry(id) on delete restrict,
  source_item_id text,
  canonical_url text not null,
  title text not null,
  raw_text text not null,
  publisher text,
  published_at timestamptz,
  captured_at timestamptz not null default now(),
  signal_type public.signal_type not null,
  organization_mentions jsonb not null default '[]'::jsonb,
  extracted_facts jsonb not null default '{}'::jsonb,
  extracted_inferences jsonb,
  content_fingerprint text not null,
  processing_metadata jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  unique (source_id, canonical_url, content_fingerprint),
  unique nulls not distinct (source_id, source_item_id, revision)
);
create index signals_workspace_captured_idx on public.signals (workspace_id, captured_at desc);
create index signals_source_id_idx on public.signals (source_id, captured_at desc);
create index signals_type_published_idx on public.signals (workspace_id, signal_type, published_at desc);
create index signals_extracted_facts_gin on public.signals using gin (extracted_facts jsonb_path_ops);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  description text not null,
  maturity_stage public.maturity_stage not null default 'early_signal',
  technical_scope jsonb,
  budget jsonb,
  timeline jsonb,
  missing_fields text[] not null default '{}',
  lifecycle_status public.lifecycle_status not null default 'discovered',
  resolution_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opportunities_workspace_status_idx on public.opportunities (workspace_id, lifecycle_status, updated_at desc);
create index opportunities_organization_id_idx on public.opportunities (organization_id);

create table public.opportunity_signals (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete restrict,
  linked_by uuid references auth.users(id) on delete set null,
  link_reason text,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, signal_id)
);
create index opportunity_signals_workspace_idx on public.opportunity_signals (workspace_id);
create index opportunity_signals_signal_id_idx on public.opportunity_signals (signal_id);
create index opportunity_signals_linked_by_idx on public.opportunity_signals (linked_by) where linked_by is not null;

create table public.score_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  scale_min numeric(5,2) not null default 0,
  scale_max numeric(5,2) not null default 100 check (scale_max > scale_min),
  weights jsonb not null,
  thresholds jsonb not null,
  hard_rules jsonb not null default '[]'::jsonb,
  tie_breakers jsonb not null default '[]'::jsonb,
  effective_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, version)
);
create index score_policies_workspace_status_idx on public.score_policies (workspace_id, status);
create index score_policies_created_by_idx on public.score_policies (created_by) where created_by is not null;

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  assessment_type public.assessment_type not null,
  profile_version text not null,
  score_policy_id uuid not null references public.score_policies(id) on delete restrict,
  dimension_results jsonb not null default '[]'::jsonb,
  overall_score numeric(5,2) not null check (overall_score between 0 and 100),
  overall_confidence numeric(5,4) not null check (overall_confidence between 0 and 1),
  decision public.assessment_decision not null,
  delivery_route public.delivery_route,
  rejection_reason jsonb,
  evidence_snapshot jsonb not null default '[]'::jsonb,
  execution_metadata jsonb not null default '{}'::jsonb,
  assessed_by uuid references auth.users(id) on delete set null,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index assessments_workspace_assessed_idx on public.assessments (workspace_id, assessed_at desc);
create index assessments_opportunity_latest_idx on public.assessments (opportunity_id, assessed_at desc);
create index assessments_score_policy_id_idx on public.assessments (score_policy_id);
create index assessments_assessed_by_idx on public.assessments (assessed_by) where assessed_by is not null;

create table public.research_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  field text not null,
  question text not null,
  priority smallint not null default 3 check (priority between 1 and 5),
  decision_impact text not null,
  stop_rule text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed_unknown', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index research_questions_workspace_status_idx on public.research_questions (workspace_id, status, priority);
create index research_questions_opportunity_id_idx on public.research_questions (opportunity_id);

create table public.research_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  question_id uuid not null references public.research_questions(id) on delete restrict,
  field text not null,
  status public.finding_status not null,
  value jsonb,
  explanation text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  source_refs jsonb not null default '[]'::jsonb,
  attempt_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (status = 'unknown' or jsonb_array_length(source_refs) > 0)
);
create index research_findings_workspace_created_idx on public.research_findings (workspace_id, created_at desc);
create index research_findings_opportunity_id_idx on public.research_findings (opportunity_id);
create index research_findings_question_id_idx on public.research_findings (question_id);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  final_assessment_id uuid not null references public.assessments(id) on delete restrict,
  why_now text not null,
  suggested_next_action text not null,
  primary_contact_id uuid,
  route public.lead_route not null,
  status public.lead_status not null default 'draft',
  review_record jsonb,
  delivery_metadata jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, final_assessment_id, version)
);
create index leads_workspace_status_idx on public.leads (workspace_id, status, updated_at desc);
create index leads_opportunity_id_idx on public.leads (opportunity_id);
create index leads_final_assessment_id_idx on public.leads (final_assessment_id);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null,
  reason_code text,
  notes text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (opportunity_id is not null or lead_id is not null)
);
create index review_events_workspace_created_idx on public.review_events (workspace_id, created_at desc);
create index review_events_opportunity_id_idx on public.review_events (opportunity_id) where opportunity_id is not null;
create index review_events_lead_id_idx on public.review_events (lead_id) where lead_id is not null;
create index review_events_reviewer_id_idx on public.review_events (reviewer_id);

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.has_workspace_role(target_workspace_id uuid, allowed_roles public.workspace_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and role = any(allowed_roles)
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon, service_role;
revoke all on function private.has_workspace_role(uuid, public.workspace_role[]) from public, anon, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function private.set_updated_at();
create trigger source_registry_set_updated_at before update on public.source_registry
for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function private.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities
for each row execute function private.set_updated_at();
create trigger research_questions_set_updated_at before update on public.research_questions
for each row execute function private.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
for each row execute function private.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.source_registry enable row level security;
alter table public.organizations enable row level security;
alter table public.signals enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_signals enable row level security;
alter table public.score_policies enable row level security;
alter table public.assessments enable row level security;
alter table public.research_questions enable row level security;
alter table public.research_findings enable row level security;
alter table public.leads enable row level security;
alter table public.review_events enable row level security;

create policy "members can read workspaces" on public.workspaces
for select to authenticated using ((select private.is_workspace_member(id)));

create policy "members can read workspace membership" on public.workspace_members
for select to authenticated using ((select private.is_workspace_member(workspace_id)));

create policy "members can read source registry" on public.source_registry
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert source registry" on public.source_registry
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "operators can update source registry" on public.source_registry
for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));

create policy "members can read organizations" on public.organizations
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert organizations" on public.organizations
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "operators can update organizations" on public.organizations
for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));

create policy "members can read signals" on public.signals
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert signals" on public.signals
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));

create policy "members can read opportunities" on public.opportunities
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators and reviewers can insert opportunities" on public.opportunities
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));
create policy "operators and reviewers can update opportunities" on public.opportunities
for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

create policy "members can read opportunity signals" on public.opportunity_signals
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators and reviewers can insert opportunity signals" on public.opportunity_signals
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));
create policy "operators and reviewers can delete opportunity signals" on public.opportunity_signals
for delete to authenticated using ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

create policy "members can read score policies" on public.score_policies
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "owners can insert score policies" on public.score_policies
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])));
create policy "owners can update score policies" on public.score_policies
for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner']::public.workspace_role[])));

create policy "members can read assessments" on public.assessments
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators and reviewers can insert assessments" on public.assessments
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

create policy "members can read research questions" on public.research_questions
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators and reviewers can insert research questions" on public.research_questions
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));
create policy "operators and reviewers can update research questions" on public.research_questions
for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

create policy "members can read research findings" on public.research_findings
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators and reviewers can insert research findings" on public.research_findings
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

create policy "members can read leads" on public.leads
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "operators and reviewers can insert leads" on public.leads
for insert to authenticated with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));
create policy "operators and reviewers can update leads" on public.leads
for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

create policy "members can read review events" on public.review_events
for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy "reviewers can insert review events" on public.review_events
for insert to authenticated with check (
  reviewer_id = (select auth.uid())
  and (select private.has_workspace_role(workspace_id, array['owner', 'reviewer']::public.workspace_role[]))
);

create view public.opportunity_dashboard
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
  coalesce(
    lead.route::text,
    case assessment.delivery_route
      when 'direct' then 'direct'
      when 'partner' then 'partner'
      when 'consortium' then 'partner'
      when 'unsuitable' then 'unsuitable'
      else 'monitor'
    end
  ) as route,
  lead.why_now,
  lead.suggested_next_action,
  opportunity.updated_at
from public.opportunities as opportunity
join public.organizations as organization on organization.id = opportunity.organization_id
left join lateral (
  select
    count(*) as signal_count,
    min(signal.captured_at) as first_seen_at,
    (array_agg(signal.signal_type::text order by coalesce(signal.published_at, signal.captured_at) desc))[1] as primary_signal_type
  from public.opportunity_signals as link
  join public.signals as signal on signal.id = link.signal_id
  where link.opportunity_id = opportunity.id
) as signal_summary on true
left join lateral (
  select candidate.overall_score, candidate.overall_confidence, candidate.assessed_at,
    candidate.dimension_results, candidate.delivery_route
  from public.assessments as candidate
  where candidate.opportunity_id = opportunity.id
  order by candidate.assessed_at desc
  limit 1
) as assessment on true
left join lateral (
  select candidate.route, candidate.why_now, candidate.suggested_next_action
  from public.leads as candidate
  where candidate.opportunity_id = opportunity.id
  order by candidate.version desc, candidate.created_at desc
  limit 1
) as lead on true;

grant usage on schema public to authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update on public.source_registry, public.organizations, public.opportunities,
  public.score_policies, public.research_questions, public.leads to authenticated;
grant select, insert on public.signals, public.assessments, public.research_findings, public.review_events to authenticated;
grant select, insert, delete on public.opportunity_signals to authenticated;
grant select on public.opportunity_dashboard to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
