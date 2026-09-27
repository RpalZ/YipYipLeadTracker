import { createHash } from "node:crypto";
import { conversationReadinessInputSchema, evaluateConversationReadiness, READINESS_INPUT_VERSION, type ReadinessContext } from "./readiness";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
export function buildReadinessSnapshot(raw: unknown, context: ReadinessContext) {
  const parsed = conversationReadinessInputSchema.safeParse(raw);
  const result = evaluateConversationReadiness(raw, context);
  const input = parsed.success ? parsed.data : null;
  const normalizedContext = { ...context, inputVersion: READINESS_INPUT_VERSION, allowedEvidenceRefs: [...new Set(context.allowedEvidenceRefs)].sort() };
  return { input, result, fingerprint: createHash("sha256").update(canonical({ raw: raw ?? null, input, result, context: normalizedContext })).digest("hex"), context: normalizedContext };
}
