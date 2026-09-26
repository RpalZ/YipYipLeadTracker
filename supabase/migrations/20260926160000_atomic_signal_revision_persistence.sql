-- A monitored web page can contain several independent publisher items. Keep
-- the canonical URL as provenance, while assigning revisions to the logical
-- source item supplied by the normalization layer.

create or replace function public.persist_automation_signal(
  p_workspace_id uuid,
  p_source_id uuid,
  p_signal jsonb
)
returns table (
  signal_id uuid,
  signal_revision integer,
  created boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_item_id_value text := nullif(btrim(p_signal ->> 'sourceItemId'), '');
  canonical_url_value text := nullif(btrim(p_signal ->> 'canonicalUrl'), '');
  fingerprint_value text := nullif(btrim(p_signal ->> 'contentFingerprint'), '');
  title_value text := nullif(btrim(p_signal ->> 'title'), '');
  raw_text_value text := nullif(btrim(p_signal ->> 'rawText'), '');
  persisted_signal_id uuid;
  persisted_revision integer;
begin
  if p_signal is null or jsonb_typeof(p_signal) <> 'object' then
    raise exception 'signal payload must be a JSON object' using errcode = '22023';
  end if;
  if source_item_id_value is null then
    raise exception 'signal sourceItemId is required' using errcode = '23502';
  end if;
  if canonical_url_value is null or canonical_url_value !~ '^https://' then
    raise exception 'signal canonicalUrl must be HTTPS' using errcode = '22023';
  end if;
  if fingerprint_value is null then
    raise exception 'signal contentFingerprint is required' using errcode = '23502';
  end if;
  if title_value is null or raw_text_value is null then
    raise exception 'signal title and rawText are required' using errcode = '23502';
  end if;
  if not exists (
    select 1
    from public.source_registry as source
    where source.id = p_source_id
      and source.workspace_id = p_workspace_id
  ) then
    raise exception 'source does not belong to workspace' using errcode = '42501';
  end if;

  -- Source-monitor result sets are deliberately small. Serializing writes per
  -- source avoids both unique-index races while keeping external agent calls
  -- outside the transaction.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_source_id::text, 0)
  );

  select signal.id, signal.revision
    into persisted_signal_id, persisted_revision
  from public.signals as signal
  where signal.source_id = p_source_id
    and signal.canonical_url = canonical_url_value
    and signal.content_fingerprint = fingerprint_value
  limit 1;

  if persisted_signal_id is not null then
    return query select persisted_signal_id, persisted_revision, false;
    return;
  end if;

  select coalesce(max(signal.revision), 0) + 1
    into persisted_revision
  from public.signals as signal
  where signal.source_id = p_source_id
    and signal.source_item_id = source_item_id_value;

  insert into public.signals (
    workspace_id,
    source_id,
    source_item_id,
    canonical_url,
    title,
    raw_text,
    publisher,
    published_at,
    signal_type,
    organization_mentions,
    extracted_facts,
    extracted_inferences,
    content_fingerprint,
    processing_metadata,
    revision
  ) values (
    p_workspace_id,
    p_source_id,
    source_item_id_value,
    canonical_url_value,
    title_value,
    raw_text_value,
    nullif(btrim(p_signal ->> 'publisher'), ''),
    nullif(p_signal ->> 'publishedAt', '')::timestamptz,
    (p_signal ->> 'signalType')::public.signal_type,
    case
      when jsonb_typeof(p_signal -> 'organizationMentions') = 'array'
        then p_signal -> 'organizationMentions'
      else '[]'::jsonb
    end,
    case
      when jsonb_typeof(p_signal -> 'extractedFacts') = 'object'
        then p_signal -> 'extractedFacts'
      else '{}'::jsonb
    end,
    case
      when jsonb_typeof(p_signal -> 'extractedInferences') = 'object'
        then p_signal -> 'extractedInferences'
      else null
    end,
    fingerprint_value,
    case
      when jsonb_typeof(p_signal -> 'processingMetadata') = 'object'
        then p_signal -> 'processingMetadata'
      else '{}'::jsonb
    end,
    persisted_revision
  )
  returning id into persisted_signal_id;

  return query select persisted_signal_id, persisted_revision, true;
end;
$$;

revoke all on function public.persist_automation_signal(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_automation_signal(uuid, uuid, jsonb)
  to service_role;

comment on function public.persist_automation_signal(uuid, uuid, jsonb) is
  'Service-only idempotent Signal persistence with atomic per-item revision allocation.';
