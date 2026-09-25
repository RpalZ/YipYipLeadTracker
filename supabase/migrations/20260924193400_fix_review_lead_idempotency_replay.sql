-- Forward-fix the already-applied local review RPC while keeping fresh resets
-- aligned with the canonical migration definition.
do $migration$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.review_lead(uuid,integer,text,text,text,public.lead_route,text)'::regprocedure
  ) into definition;

  definition := replace(
    definition,
    '''workflowId'', changes ->> ''workflowId''',
    '''workflowId'', public.review_events.changes ->> ''workflowId'''
  );

  execute definition;
end;
$migration$;
