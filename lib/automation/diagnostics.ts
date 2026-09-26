export interface AutomationErrorDetails {
  code: string;
  name: string;
  message: string;
  details?: string;
  hint?: string;
  operation?: string;
}

function sanitizeOperationalMessage(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted-api-key]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function describeAutomationError(error: unknown): AutomationErrorDetails {
  const record = error && typeof error === "object" && !Array.isArray(error)
    ? error as Record<string, unknown>
    : null;
  const cause = record?.cause && typeof record.cause === "object" && !Array.isArray(record.cause)
    ? record.cause as Record<string, unknown>
    : null;
  const field = (key: string): unknown => record?.[key] ?? cause?.[key];
  const rawMessage = typeof field("message") === "string"
    ? field("message") as string
    : error instanceof Error ? error.message : String(error);
  const rawCode = typeof field("code") === "string" ? field("code") as string : "";
  const details = typeof field("details") === "string"
    ? sanitizeOperationalMessage(field("details") as string)
    : undefined;
  const hint = typeof field("hint") === "string"
    ? sanitizeOperationalMessage(field("hint") as string)
    : undefined;
  const operation = typeof field("operation") === "string"
    ? sanitizeOperationalMessage(field("operation") as string)
    : undefined;
  const name = typeof field("name") === "string"
    ? sanitizeOperationalMessage(field("name") as string)
    : rawCode ? "PostgrestError" : "Error";
  const message = sanitizeOperationalMessage(rawMessage);
  const normalized = message.toLowerCase();
  let code = "stage_error";
  if (normalized.includes("response.incomplete")) code = "provider_incomplete";
  else if (normalized.includes("response.failed")) code = "provider_failed";
  else if (normalized.includes("source scout output contract")) code = "provider_output_contract";
  else if (normalized.includes("invalid output type") && normalized.includes("expected schema")) code = "provider_output_schema";
  else if (normalized.includes("invalid schema") || normalized.includes("response_format")) code = "provider_schema";
  else if (normalized.includes("hosted web-search limit")) code = "tool_limit";
  else if (normalized.includes("429") || normalized.includes("rate limit")) code = "rate_limit";
  else if (normalized.includes("aborted") || normalized.includes("timed out") || normalized.includes("timeout")) code = "timeout";
  else if (normalized.includes("authentication") || normalized.includes("unauthorized") || normalized.includes("access denied")) code = "authentication";
  else if (rawCode === "42501" || normalized.includes("permission denied") || normalized.includes("row-level security")) code = "authorization";
  else if (/^PGRST\d+$/i.test(rawCode)) code = `postgrest_${rawCode.toLowerCase()}`;
  else if (/^[A-Z0-9_]+$/i.test(rawCode)) code = `database_${rawCode.toLowerCase()}`;
  return {
    code,
    name,
    message: message || "Unknown automation error",
    ...(details ? { details } : {}),
    ...(hint ? { hint } : {}),
    ...(operation ? { operation } : {}),
  };
}

export function automationErrorIsRetryable(error: AutomationErrorDetails, attempt = 1): boolean {
  if (["provider_schema", "authentication", "authorization", "tool_limit"].includes(error.code)) return false;
  if (["provider_output_schema", "provider_output_contract"].includes(error.code)) return attempt < 2;
  return !/access denied|policy|invalid configuration/i.test(error.message);
}

export function writeAutomationLog(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown>,
): void {
  const line = JSON.stringify({ event, at: new Date().toISOString(), ...details });
  if (level === "error") console.error(`[automation] ${line}`);
  else if (level === "warn") console.warn(`[automation] ${line}`);
  else console.info(`[automation] ${line}`);
}
