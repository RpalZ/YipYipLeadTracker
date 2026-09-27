alter table public.conversation_readiness_evaluations add constraint readiness_status_required
  check (result ? 'status' and jsonb_typeof(result->'status') = 'string');
alter table public.conversation_readiness_labels add constraint readiness_other_note_required
  check (reason <> 'other' or coalesce(length(trim(notes)),0) > 0);
