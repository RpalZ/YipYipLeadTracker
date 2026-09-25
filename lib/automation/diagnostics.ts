export interface AutomationErrorDetails {
  code: string;
  name: string;
  message: string;
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
  const name = error instanceof Error ? error.name : "Error";
  const message = sanitizeOperationalMessage(error instanceof Error ? error.message : String(error));
  const normalized = message.toLowerCase();
  let code = "stage_error";
  if (normalized.includes("response.incomplete")) code = "provider_incomplete";
  else if (normalized.includes("response.failed")) code = "provider_failed";
  else if (normalized.includes("invalid schema") || normalized.includes("response_format")) code = "provider_schema";
  else if (normalized.includes("429") || normalized.includes("rate limit")) code = "rate_limit";
  else if (normalized.includes("aborted") || normalized.includes("timed out") || normalized.includes("timeout")) code = "timeout";
  else if (normalized.includes("authentication") || normalized.includes("unauthorized") || normalized.includes("access denied")) code = "authentication";
  return { code, name, message: message || "Unknown automation error" };
}

export function automationErrorIsRetryable(error: AutomationErrorDetails): boolean {
  if (["provider_schema", "authentication"].includes(error.code)) return false;
  return !/access denied|policy|invalid configuration/i.test(error.message);
}

export function writeAutomationLog(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>,
): void {
  const line = JSON.stringify({ event, at: new Date().toISOString(), ...details });
  if (level === "error") console.error(`[automation] ${line}`);
  else console.info(`[automation] ${line}`);
}
