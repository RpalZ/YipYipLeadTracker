export interface PursuitPromotionActionState {
  ok: boolean;
  message: string;
  opportunityId?: string;
  leadId?: string | null;
  requestId?: string;
}

export const initialPursuitPromotionActionState: PursuitPromotionActionState = {
  ok: false,
  message: "",
};

export function successfulPromotionResultKey(state: PursuitPromotionActionState): string | null {
  return state.ok && state.requestId ? state.requestId : null;
}
