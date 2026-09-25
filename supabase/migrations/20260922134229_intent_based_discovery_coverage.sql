-- Intent-based discovery coverage is configured separately from the governed
-- catalog of exact source URLs and adapters. These tables establish the future
-- data contract without enabling source discovery or scheduled jobs.

create type public.coverage_profile_status as enum ('draft', 'active', 'paused', 'archived');
create type public.discovery_signal_area as enum (
  'pitching',
  'newsletters',
  'funding',
  'strategy',
  'hiring',
  'consultations',
  'announcements',
  'regional_networks',
  'other'
);
create type public.source_candidate_origin as enum ('curated_pack', 'source_scout', 'operator');
create type public.source_candidate_status as enum ('proposed', 'in_review', 'approved', 'rejected');

alter table public.source_registry
add constraint source_registry_workspace_id_id_key unique (workspace_id, id);

create table public.discovery_coverage_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_key text not null check (profile_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  description text,
  status public.coverage_profile_status not null default 'draft',
  is_default boolean not null default false,
  signal_areas public.discovery_signal_area[] not null,
  sectors text[] not null default '{}',
  organization_types text[] not null default '{}',
  organization_targets text[] not null default '{}',
  regions text[] not null default '{}',
  languages text[] not null default array['nl']::text[],
  project_types text[] not null default '{}',
  technical_themes text[] not null default '{}',
  impact_themes text[] not null default '{}',
  keywords text[] not null default '{}',
  negative_terms text[] not null default '{}',
  project_clues text[] not null default '{}',
  lookback interval not null default interval '90 days' check (lookback > interval '0 seconds'),
  evidence_preferences jsonb not null default '{}'::jsonb,
  cadence text not null default 'weekly' check (length(trim(cadence)) > 0),
  result_limit integer not null default 100 check (result_limit between 1 and 10000),
  cost_limit numeric(12,2) not null default 0 check (cost_limit >= 0),
  allow_source_proposals boolean not null default true,
  notification_preferences jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  effective_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  changed_by uuid references auth.users(id) on delete set null,
  change_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_key, version),
  unique (workspace_id, id),
  check (cardinality(signal_areas) > 0),
  check (cardinality(languages) > 0),
  check (jsonb_typeof(evidence_preferences) = 'object'),
  check (jsonb_typeof(notification_preferences) = 'object')
);
create unique index discovery_coverage_profiles_active_key_idx
  on public.discovery_coverage_profiles (workspace_id, profile_key)
  where status = 'active';
create unique index discovery_coverage_profiles_default_idx
  on public.discovery_coverage_profiles (workspace_id)
  where is_default and status = 'active';
create index discovery_coverage_profiles_workspace_status_idx
  on public.discovery_coverage_profiles (workspace_id, status, updated_at desc);
create index discovery_coverage_profiles_signal_areas_idx
  on public.discovery_coverage_profiles using gin (signal_areas);
create index discovery_coverage_profiles_created_by_idx
  on public.discovery_coverage_profiles (created_by) where created_by is not null;
create index discovery_coverage_profiles_changed_by_idx
  on public.discovery_coverage_profiles (changed_by) where changed_by is not null;

create table public.discovery_source_packs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pack_key text not null check (pack_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  description text,
  signal_areas public.discovery_signal_area[] not null,
  criteria_defaults jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  version integer not null default 1 check (version > 0),
  effective_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  changed_by uuid references auth.users(id) on delete set null,
  change_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, pack_key, version),
  unique (workspace_id, id),
  check (cardinality(signal_areas) > 0),
  check (jsonb_typeof(criteria_defaults) = 'object')
);
create unique index discovery_source_packs_active_key_idx
  on public.discovery_source_packs (workspace_id, pack_key)
  where status = 'active';
create index discovery_source_packs_workspace_status_idx
  on public.discovery_source_packs (workspace_id, status, updated_at desc);
create index discovery_source_packs_signal_areas_idx
  on public.discovery_source_packs using gin (signal_areas);
create index discovery_source_packs_created_by_idx
  on public.discovery_source_packs (created_by) where created_by is not null;
create index discovery_source_packs_changed_by_idx
  on public.discovery_source_packs (changed_by) where changed_by is not null;

create table public.coverage_profile_source_packs (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  coverage_profile_id uuid not null,
  source_pack_id uuid not null,
  configuration_overrides jsonb not null default '{}'::jsonb,
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (coverage_profile_id, source_pack_id),
  foreign key (workspace_id, coverage_profile_id)
    references public.discovery_coverage_profiles(workspace_id, id) on delete cascade,
  foreign key (workspace_id, source_pack_id)
    references public.discovery_source_packs(workspace_id, id) on delete cascade,
  check (jsonb_typeof(configuration_overrides) = 'object')
);
create index coverage_profile_source_packs_workspace_idx
  on public.coverage_profile_source_packs (workspace_id, coverage_profile_id);
create index coverage_profile_source_packs_source_pack_idx
  on public.coverage_profile_source_packs (source_pack_id);
create index coverage_profile_source_packs_linked_by_idx
  on public.coverage_profile_source_packs (linked_by) where linked_by is not null;

create table public.discovery_source_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  coverage_profile_id uuid not null,
  source_pack_id uuid,
  origin public.source_candidate_origin not null,
  name text not null check (length(trim(name)) > 0),
  source_family text not null check (length(trim(source_family)) > 0),
  jurisdiction text,
  base_url text not null check (base_url ~ '^https?://'),
  proposed_config jsonb not null default '{}'::jsonb,
  sample_evidence jsonb not null default '[]'::jsonb,
  coverage_rationale text not null check (length(trim(coverage_rationale)) > 0),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  estimated_monthly_cost numeric(12,2) not null default 0 check (estimated_monthly_cost >= 0),
  cost_currency text not null default 'EUR' check (cost_currency ~ '^[A-Z]{3}$'),
  governance_questions jsonb not null default '[]'::jsonb,
  status public.source_candidate_status not null default 'proposed',
  resolved_source_id uuid,
  execution_metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coverage_profile_id, base_url),
  unique (workspace_id, coverage_profile_id, id),
  foreign key (workspace_id, coverage_profile_id)
    references public.discovery_coverage_profiles(workspace_id, id) on delete cascade,
  foreign key (workspace_id, source_pack_id)
    references public.discovery_source_packs(workspace_id, id) on delete set null (source_pack_id),
  foreign key (workspace_id, resolved_source_id)
    references public.source_registry(workspace_id, id) on delete restrict,
  check (jsonb_typeof(proposed_config) = 'object'),
  check (jsonb_typeof(sample_evidence) = 'array'),
  check (jsonb_typeof(governance_questions) = 'array'),
  check (jsonb_typeof(execution_metadata) = 'object'),
  check (origin <> 'curated_pack' or source_pack_id is not null),
  check (
    (status in ('proposed', 'in_review') and resolved_source_id is null and reviewed_by is null and reviewed_at is null)
    or (status = 'approved' and resolved_source_id is not null and reviewed_by is not null and reviewed_at is not null)
    or (status = 'rejected' and resolved_source_id is null and reviewed_by is not null and reviewed_at is not null)
  )
);
create index discovery_source_candidates_workspace_status_idx
  on public.discovery_source_candidates (workspace_id, status, created_at desc);
create index discovery_source_candidates_source_pack_idx
  on public.discovery_source_candidates (source_pack_id) where source_pack_id is not null;
create index discovery_source_candidates_resolved_source_idx
  on public.discovery_source_candidates (resolved_source_id) where resolved_source_id is not null;
create index discovery_source_candidates_reviewed_by_idx
  on public.discovery_source_candidates (reviewed_by) where reviewed_by is not null;
create index discovery_source_candidates_created_by_idx
  on public.discovery_source_candidates (created_by) where created_by is not null;

create table public.coverage_profile_sources (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  coverage_profile_id uuid not null,
  source_id uuid not null,
  source_candidate_id uuid,
  signal_areas public.discovery_signal_area[] not null,
  link_rationale text,
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (coverage_profile_id, source_id),
  foreign key (workspace_id, coverage_profile_id)
    references public.discovery_coverage_profiles(workspace_id, id) on delete cascade,
  foreign key (workspace_id, source_id)
    references public.source_registry(workspace_id, id) on delete cascade,
  foreign key (workspace_id, coverage_profile_id, source_candidate_id)
    references public.discovery_source_candidates(workspace_id, coverage_profile_id, id) on delete set null (source_candidate_id),
  check (cardinality(signal_areas) > 0)
);
create index coverage_profile_sources_workspace_idx
  on public.coverage_profile_sources (workspace_id, coverage_profile_id);
create index coverage_profile_sources_source_idx
  on public.coverage_profile_sources (source_id);
create index coverage_profile_sources_candidate_idx
  on public.coverage_profile_sources (source_candidate_id) where source_candidate_id is not null;
create index coverage_profile_sources_linked_by_idx
  on public.coverage_profile_sources (linked_by) where linked_by is not null;

create trigger discovery_coverage_profiles_set_updated_at
before update on public.discovery_coverage_profiles
for each row execute function private.set_updated_at();
create trigger discovery_source_packs_set_updated_at
before update on public.discovery_source_packs
for each row execute function private.set_updated_at();
create trigger discovery_source_candidates_set_updated_at
before update on public.discovery_source_candidates
for each row execute function private.set_updated_at();

alter table public.discovery_coverage_profiles enable row level security;
alter table public.discovery_source_packs enable row level security;
alter table public.coverage_profile_source_packs enable row level security;
alter table public.discovery_source_candidates enable row level security;
alter table public.coverage_profile_sources enable row level security;

create policy "members can read discovery coverage profiles"
on public.discovery_coverage_profiles for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy "coverage editors can insert discovery coverage profiles"
on public.discovery_coverage_profiles for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));
create policy "coverage editors can update discovery coverage profiles"
on public.discovery_coverage_profiles for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

create policy "members can read discovery source packs"
on public.discovery_source_packs for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert discovery source packs"
on public.discovery_source_packs for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "operators can update discovery source packs"
on public.discovery_source_packs for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));

create policy "members can read coverage profile source packs"
on public.coverage_profile_source_packs for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy "coverage editors can insert coverage profile source packs"
on public.coverage_profile_source_packs for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));
create policy "coverage editors can delete coverage profile source packs"
on public.coverage_profile_source_packs for delete to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator', 'reviewer']::public.workspace_role[])));

create policy "members can read discovery source candidates"
on public.discovery_source_candidates for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert discovery source candidates"
on public.discovery_source_candidates for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "operators can update discovery source candidates"
on public.discovery_source_candidates for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])))
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));

create policy "members can read coverage profile sources"
on public.coverage_profile_sources for select to authenticated
using ((select private.is_workspace_member(workspace_id)));
create policy "operators can insert coverage profile sources"
on public.coverage_profile_sources for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));
create policy "operators can delete coverage profile sources"
on public.coverage_profile_sources for delete to authenticated
using ((select private.has_workspace_role(workspace_id, array['owner', 'operator']::public.workspace_role[])));

grant select, insert, update on public.discovery_coverage_profiles to authenticated;
grant select, insert, update on public.discovery_source_packs to authenticated;
grant select, insert, delete on public.coverage_profile_source_packs to authenticated;
grant select, insert, update on public.discovery_source_candidates to authenticated;
grant select, insert, delete on public.coverage_profile_sources to authenticated;

revoke all on public.discovery_coverage_profiles from anon;
revoke all on public.discovery_source_packs from anon;
revoke all on public.coverage_profile_source_packs from anon;
revoke all on public.discovery_source_candidates from anon;
revoke all on public.coverage_profile_sources from anon;
