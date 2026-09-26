export type OpportunityAttentionAction = "request_research" | "pass";

export interface OpportunityAttentionActionState {
  ok: boolean;
  message: string;
  action?: OpportunityAttentionAction;
  opportunityId?: string;
  requestId?: string;
  workflowId?: string | null;
}

export const initialOpportunityAttentionActionState: OpportunityAttentionActionState = {
  ok: false,
  message: "",
};

export function successfulAttentionResultKey(
  state: OpportunityAttentionActionState,
): string | null {
  if (!state.ok || !state.action || !state.opportunityId || !state.requestId) return null;
  return `${state.opportunityId}:${state.action}:${state.requestId}`;
}

export interface QualificationWorkflowSummary {
  opportunity_id: string | null;
  kind: string;
  status: string;
}

/**
 * Automatic `signal_created` qualification and human `review_request`
 * reassessment are both active research states. The UI must not limit its
 * progress indicator to the human-triggered variant.
 */
export function activeQualificationOpportunityIds(
  workflows: QualificationWorkflowSummary[],
): Set<string> {
  return new Set(workflows
    .filter((workflow) => workflow.opportunity_id
      && workflow.kind === "opportunity_qualification"
      && (workflow.status === "queued" || workflow.status === "running"))
    .map((workflow) => workflow.opportunity_id as string));
}
