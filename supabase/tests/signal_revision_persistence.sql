begin;

insert into public.workspaces (id, name, slug)
values
  ('6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Signal revision workspace', 'signal-revision-workspace'),
  ('6bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Signal revision other', 'signal-revision-other');

insert into public.source_registry (
  id, workspace_id, name, source_family, adapter_type, permitted_method, enabled
) values (
  '6ccccccc-cccc-cccc-cccc-cccccccccccc',
  '6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Weekly roundup',
  'newsletter',
  'web_search',
  'public_web',
  true
);

set local role service_role;

do $$
declare
  base_payload jsonb := '{
    "sourceItemId":"web-v1:item-a",
    "canonicalUrl":"https://example.test/weekly-roundup",
    "title":"Platform A",
    "rawText":"Organization A is preparing a platform.",
    "publisher":"Example publisher",
    "publishedAt":"2026-09-26T00:00:00Z",
    "signalType":"strategy",
    "organizationMentions":["Organization A"],
    "extractedFacts":{"facts":["Platform A is planned"]},
    "extractedInferences":{"inferences":[]},
    "contentFingerprint":"fingerprint-a-v1",
    "processingMetadata":{"automated":true}
  }'::jsonb;
  first_result record;
  repeated_result record;
  second_item_result record;
  revision_result record;
begin
  select * into first_result
  from public.persist_automation_signal(
    '6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '6ccccccc-cccc-cccc-cccc-cccccccccccc',
    base_payload
  );
  if not first_result.created or first_result.signal_revision <> 1 then
    raise exception 'first logical item did not create revision 1';
  end if;

  select * into repeated_result
  from public.persist_automation_signal(
    '6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '6ccccccc-cccc-cccc-cccc-cccccccccccc',
    base_payload
  );
  if repeated_result.created or repeated_result.signal_id <> first_result.signal_id then
    raise exception 'unchanged retry did not reuse its Signal';
  end if;

  select * into second_item_result
  from public.persist_automation_signal(
    '6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '6ccccccc-cccc-cccc-cccc-cccccccccccc',
    base_payload || '{
      "sourceItemId":"web-v1:item-b",
      "title":"Platform B",
      "rawText":"Organization B is preparing a platform.",
      "organizationMentions":["Organization B"],
      "contentFingerprint":"fingerprint-b-v1"
    }'::jsonb
  );
  if not second_item_result.created or second_item_result.signal_revision <> 1 then
    raise exception 'second item on the same page did not create its own revision 1';
  end if;

  select * into revision_result
  from public.persist_automation_signal(
    '6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '6ccccccc-cccc-cccc-cccc-cccccccccccc',
    base_payload || '{
      "rawText":"Organization A has updated its platform plan.",
      "contentFingerprint":"fingerprint-a-v2"
    }'::jsonb
  );
  if not revision_result.created or revision_result.signal_revision <> 2 then
    raise exception 'changed logical item did not create revision 2';
  end if;

  if (
    select count(*)
    from public.signals
    where source_id = '6ccccccc-cccc-cccc-cccc-cccccccccccc'
  ) <> 3 then
    raise exception 'unexpected Signal count after idempotency and revision checks';
  end if;

  begin
    perform public.persist_automation_signal(
      '6bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '6ccccccc-cccc-cccc-cccc-cccccccccccc',
      base_payload
    );
    raise exception 'cross-workspace source persistence unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role authenticated;
do $$
begin
  begin
    perform public.persist_automation_signal(
      '6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '6ccccccc-cccc-cccc-cccc-cccccccccccc',
      '{}'::jsonb
    );
    raise exception 'authenticated caller unexpectedly persisted an automation Signal';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
