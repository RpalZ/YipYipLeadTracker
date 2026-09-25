"use server";

import { revalidatePath } from "next/cache";

import type { LeadReviewActionState } from "@/lib/lead-review-action-state";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function reviewLeadAction(
  _previous: LeadReviewActionState,
  formData: FormData,
): Promise<LeadReviewActionState> {
  const leadId = value(formData, "leadId");
  const expectedVersion = Number(value(formData, "expectedVersion"));
  const action = value(formData, "action");
  const reasonCode = value(formData, "reasonCode");
  const notes = value(formData, "notes");
  const route = value(formData, "route");
  const idempotencyKey = value(formData, "idempotencyKey");

  if (!leadId || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !idempotencyKey) {
    return { ok: false, message: "The Lead review request is incomplete." };
  }
  if (!["pursue", "pass", "request_research", "route_changed"].includes(action)) {
    return { ok: false, message: "Choose a supported review action." };
  }
  if (["pass", "request_research", "route_changed"].includes(action) && !reasonCode) {
    return { ok: false, message: "Choose a reason before submitting this action." };
  }
  if (reasonCode === "other" && !notes) {
    return { ok: false, message: "Add a short note when using the Other reason." };
  }
  if (action === "route_changed" && !["direct", "partner", "nurture", "monitor"].includes(route)) {
    return { ok: false, message: "Choose a valid delivery route." };
  }

  try {
    const supabase = await createClient();
    const result = await supabase.rpc("review_lead", {
      p_lead_id: leadId,
      p_expected_version: expectedVersion,
      p_action: action,
      p_reason_code: reasonCode || undefined,
      p_notes: notes || undefined,
      p_route: action === "route_changed" ? route as "direct" | "partner" | "nurture" | "monitor" : undefined,
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
      message: action === "pursue"
        ? "Lead approved for pursuit."
        : action === "pass"
          ? "Lead marked as passed."
          : action === "request_research"
            ? "A bounded reassessment and research cycle is queued."
            : "Delivery route updated.",
      action,
      leadId,
      requestId: idempotencyKey,
      workflowId: typeof payload.workflowId === "string" ? payload.workflowId : null,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The Lead review action could not be saved.",
      action,
      leadId,
    };
  }
}
