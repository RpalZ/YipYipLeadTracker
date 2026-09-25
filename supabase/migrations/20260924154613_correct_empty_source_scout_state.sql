-- A Source Scout run with no persisted reviewable proposals is complete. It
-- must not leave the operator waiting at an approval gate with an empty inbox.
update public.automation_workflow_runs as workflow
set status = 'succeeded',
    stop_reason = 'no_reviewable_proposals',
    updated_at = now()
where workflow.kind = 'source_scout'
  and workflow.status = 'waiting_approval'
  and exists (
    select 1
    from public.automation_stage_runs as stage
    where stage.workflow_run_id = workflow.id
      and stage.stage = 'source_scout'
      and stage.status = 'succeeded'
      and stage.output_snapshot @> '{"proposalCount": 0}'::jsonb
  );
