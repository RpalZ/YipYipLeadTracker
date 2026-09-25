begin;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'coverage-owner@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'coverage-reviewer@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'coverage-stranger@example.test', now(), now());

insert into public.workspaces (id, name, slug)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Coverage workspace', 'coverage-workspace'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Other workspace', 'other-workspace');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'reviewer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

insert into public.discovery_coverage_profiles (
  id,
  workspace_id,
  profile_key,
  name,
  status,
  is_default,
  signal_areas,
  sectors,
  regions,
  created_by,
  changed_by
)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'nl-public-sector',
  'Dutch public-sector opportunities',
  'active',
  true,
  array['pitching', 'newsletters', 'funding']::public.discovery_signal_area[],
  array['public services', 'education'],
  array['Netherlands'],
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.discovery_source_packs (
  id,
  workspace_id,
  pack_key,
  name,
  signal_areas,
  status,
  created_by,
  changed_by
)
values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'nl-funding-newsletters',
  'Dutch funding and newsletter sources',
  array['newsletters', 'funding']::public.discovery_signal_area[],
  'active',
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.coverage_profile_source_packs (
  workspace_id,
  coverage_profile_id,
  source_pack_id,
  linked_by
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.source_registry (
  id,
  workspace_id,
  name,
  source_family,
  base_url,
  adapter_type,
  permitted_method,
  changed_by
)
values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Approved newsletter source',
  'newsletter',
  'https://example.test/newsletter',
  'rss',
  'public-feed',
  '11111111-1111-1111-1111-111111111111'
);

insert into public.discovery_source_candidates (
  id,
  workspace_id,
  coverage_profile_id,
  source_pack_id,
  origin,
  name,
  source_family,
  base_url,
  coverage_rationale,
  confidence,
  created_by
)
values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'curated_pack',
  'Candidate newsletter source',
  'newsletter',
  'https://candidate.example.test/newsletter',
  'Matches the requested newsletter and funding coverage.',
  0.9000,
  '11111111-1111-1111-1111-111111111111'
);

do $$
begin
  if (select count(*) from public.discovery_coverage_profiles) <> 1 then
    raise exception 'owner should see the workspace coverage profile';
  end if;
  if (select count(*) from public.discovery_source_candidates) <> 1 then
    raise exception 'owner should see the workspace source candidate';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);

do $$
begin
  begin
    insert into public.discovery_coverage_profiles (
      workspace_id, profile_key, name, signal_areas, created_by, changed_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reviewer-draft', 'Reviewer draft coverage',
      array['strategy']::public.discovery_signal_area[],
      '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222'
    );
    raise exception 'reviewer coverage insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.discovery_source_candidates (
      workspace_id,
      coverage_profile_id,
      origin,
      name,
      source_family,
      base_url,
      coverage_rationale,
      confidence,
      created_by
    )
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'operator',
      'Unauthorized reviewer candidate',
      'newsletter',
      'https://unauthorized.example.test',
      'This insert must be blocked by RLS.',
      0.5000,
      '22222222-2222-2222-2222-222222222222'
    );
    raise exception 'reviewer source-candidate insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.discovery_coverage_profiles) <> 0 then
    raise exception 'cross-workspace coverage profile was visible';
  end if;
  if (select count(*) from public.discovery_source_packs) <> 0 then
    raise exception 'cross-workspace source pack was visible';
  end if;
  if (select count(*) from public.discovery_source_candidates) <> 0 then
    raise exception 'cross-workspace source candidate was visible';
  end if;
end;
$$;

reset role;

do $$
begin
  if has_table_privilege('anon', 'public.discovery_coverage_profiles', 'select') then
    raise exception 'anon should not have coverage-profile select privilege';
  end if;
  if has_table_privilege('anon', 'public.discovery_source_candidates', 'insert') then
    raise exception 'anon should not have source-candidate insert privilege';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.discovery_source_candidates (
      workspace_id,
      coverage_profile_id,
      origin,
      name,
      source_family,
      base_url,
      coverage_rationale,
      confidence
    )
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'operator',
      'Cross-workspace candidate',
      'newsletter',
      'https://cross-workspace.example.test',
      'This insert must be blocked by the composite foreign key.',
      0.5000
    );
    raise exception 'cross-workspace candidate insert unexpectedly succeeded';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

do $$
begin
  begin
    update public.discovery_source_candidates
    set status = 'approved'
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    raise exception 'incomplete source-candidate approval unexpectedly succeeded';
  exception
    when check_violation then null;
  end;
end;
$$;

update public.discovery_source_candidates
set
  status = 'approved',
  resolved_source_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  reviewed_by = '11111111-1111-1111-1111-111111111111',
  reviewed_at = now(),
  review_note = 'Approved during migration acceptance testing.'
where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

insert into public.coverage_profile_sources (
  workspace_id,
  coverage_profile_id,
  source_id,
  source_candidate_id,
  signal_areas,
  link_rationale,
  linked_by
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  array['newsletters', 'funding']::public.discovery_signal_area[],
  'The approved technical source satisfies two requested coverage areas.',
  '11111111-1111-1111-1111-111111111111'
);

do $$
begin
  if (
    select status <> 'approved' or resolved_source_id is null
    from public.discovery_source_candidates
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
  ) then
    raise exception 'approved candidate did not retain its governed source reference';
  end if;
  if (select count(*) from public.coverage_profile_sources) <> 1 then
    raise exception 'approved source was not linked to the coverage profile';
  end if;
end;
$$;

rollback;
