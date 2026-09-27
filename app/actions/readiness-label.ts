"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readinessEnabled } from "@/lib/readiness-config";
import { readinessLabels, readinessReasons } from "@/lib/readiness";

export async function labelReadinessAction(_previous: { ok: boolean; message: string }, form: FormData): Promise<{ ok: boolean; message: string }> {
  if (!readinessEnabled()) return { ok: false, message: "disabled" };
  const value = (key: string) => String(form.get(key) ?? "").trim();
  if (!readinessLabels.some((label) => label === value("label")) || !readinessReasons.some((reason) => reason === value("reason"))
    || (value("reason") === "other" && !value("notes")) || value("notes").length > 1000) return { ok: false, message: "invalid" };
  try {
    const client = await createClient();
    const { error } = await client.rpc("label_conversation_readiness", {
      p_evaluation_id: value("evaluationId"), p_label: value("label"), p_reason: value("reason"),
      p_notes: value("notes"), p_idempotency_key: value("idempotencyKey"), p_expected_label_id: value("expectedLabelId") || undefined,
    });
    if (error) return { ok: false, message: error.code === "40001" ? "stale" : error.code === "42501" ? "denied" : "failed" };
    revalidatePath("/");
    return { ok: true, message: "saved" };
  } catch {
    return { ok: false, message: "failed" };
  }
}
