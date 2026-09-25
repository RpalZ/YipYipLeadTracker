export interface LeadReviewActionState {
  ok: boolean;
  message: string;
  action?: string;
  leadId?: string;
  requestId?: string;
  workflowId?: string | null;
}

export const initialLeadReviewActionState: LeadReviewActionState = {
  ok: false,
  message: "",
};

export function successfulReviewResultKey(state: LeadReviewActionState): string | null {
  if (!state.ok || !state.action || !state.leadId || !state.requestId) return null;
  return `${state.leadId}:${state.action}:${state.requestId}`;
}

export function removeReviewedItem(items: string[], reviewedId: string): string[] {
  if (!items.includes(reviewedId)) return items;
  return items.filter((item) => item !== reviewedId);
}
