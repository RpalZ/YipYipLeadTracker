"use server";

import { revalidatePath } from "next/cache";

import { describeAutomationError } from "@/lib/automation/diagnostics";
import type {
  OpportunityAttentionAction,
  OpportunityAttentionActionState,
} from "@/lib/opportunity-attention-action-state";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function resolveOpportunityAttentionAction(
  _previous: OpportunityAttentionActionState,
  formData: FormData,
): Promise<OpportunityAttentionActionState> {
  const opportunityId = value(formData, "opportunityId");
  const exceptionId = value(formData, "exceptionId");
  const action = value(formData, "action") as OpportunityAttentionAction;
  const reasonCode = value(formData, "reasonCode");
  const notes = value(formData, "notes");
  const idempotencyKey = value(formData, "idempotencyKey");

  if (!opportunityId || !exceptionId || !idempotencyKey) {
    return { ok: false, message: "The Opportunity resolution request is incomplete." };
  }
  if (action !== "request_research" && action !== "pass") {
    return { ok: false, message: "Choose research or pass before submitting." };
  }
  if (!reasonCode) {
    return { ok: false, message: "Choose a reason before submitting this action." };
  }
  if (reasonCode === "other" && !notes) {
    return { ok: false, message: "Add a short note when using the Other reason." };
  }

  try {
    const supabase = await createClient();
    const result = await supabase.rpc("resolve_opportunity_attention", {
      p_opportunity_id: opportunityId,
      p_exception_id: exceptionId,
      p_action: action,
      p_reason_code: reasonCode,
      p_notes: notes,
      p_idempotency_key: idempotencyKey,
    });
    if (result.error) throw result.error;

    const payload = result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data as Record<string, unknown>
      : {};
    revalidatePath("/");
    revalidatePath("/sources");
    revalidatePath("/reviewed");

    return {
      ok: true,
      message: action === "request_research"
        ? "Focused reassessment and research are queued. This Opportunity moved to Monitoring while automation runs."
        : "Opportunity passed and retained in decision history.",
      action,
      opportunityId,
      requestId: idempotencyKey,
      workflowId: typeof payload.workflowId === "string" ? payload.workflowId : null,
    };
  } catch (error) {
    const failure = describeAutomationError(error);
    return {
      ok: false,
      message: failure.message,
      action,
      opportunityId,
    };
  }
}
