"use server";

import { revalidatePath } from "next/cache";

import type { PursuitPromotionActionState } from "@/lib/pursuit-promotion-action-state";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reasons = new Set([
  "seasonal_capacity",
  "strategic_interest",
  "existing_relationship",
  "portfolio_fit",
  "partner_opportunity",
  "other",
]);

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function promoteOpportunityAction(
  _previous: PursuitPromotionActionState,
  formData: FormData,
): Promise<PursuitPromotionActionState> {
  const opportunityId = value(formData, "opportunityId");
  const expectedAssessmentId = value(formData, "expectedAssessmentId");
  const reasonCode = value(formData, "reasonCode");
  const notes = value(formData, "notes");
  const route = value(formData, "route");
  const language = value(formData, "language");
  const idempotencyKey = value(formData, "idempotencyKey");

  if (!uuidPattern.test(opportunityId) || !uuidPattern.test(expectedAssessmentId) || !idempotencyKey) {
    return { ok: false, message: "The manual promotion request is incomplete.", opportunityId };
  }
  if (!reasons.has(reasonCode)) {
    return { ok: false, message: "Choose why this Opportunity should enter the pursuit pipeline.", opportunityId };
  }
  if (reasonCode === "other" && !notes) {
    return { ok: false, message: "Add a short note when using the Other reason.", opportunityId };
  }
  if (notes.length > 1000) {
    return { ok: false, message: "Keep the promotion note under 1,000 characters.", opportunityId };
  }
  if (!["direct", "partner", "nurture", "monitor"].includes(route)) {
    return { ok: false, message: "Choose a supported pursuit route.", opportunityId };
  }
  if (language !== "nl" && language !== "en") {
    return { ok: false, message: "Choose Dutch or English outreach.", opportunityId };
  }

  try {
    const supabase = await createClient();
    const result = await supabase.rpc("promote_opportunity_to_pursuit", {
      p_opportunity_id: opportunityId,
      p_expected_assessment_id: expectedAssessmentId,
      p_reason_code: reasonCode,
      p_notes: notes,
      p_route: route as "direct" | "partner" | "nurture" | "monitor",
      p_language: language,
      p_idempotency_key: idempotencyKey,
    });
    if (result.error) throw result.error;
    const payload = result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data as Record<string, unknown>
      : {};
    revalidatePath("/");
    revalidatePath("/reviewed");
    return {
      ok: true,
      message: "Opportunity promoted to the pursuit pipeline. Its automated assessment remains unchanged.",
      opportunityId,
      leadId: typeof payload.leadId === "string" ? payload.leadId : null,
      requestId: idempotencyKey,
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "The Opportunity could not be promoted.";
    return {
      ok: false,
      message,
      opportunityId,
    };
  }
}
