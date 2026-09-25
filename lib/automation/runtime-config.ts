export interface AutomationEnvironment {
  AUTOMATION_ENABLED?: string;
  AUTOMATION_CRON_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  APP_BASE_URL?: string;
  AUTOMATION_AGENT_TIMEOUT_SECONDS?: string;
}

export const DEFAULT_AUTOMATION_AGENT_TIMEOUT_SECONDS = 150;
export const MAX_AUTOMATION_AGENT_TIMEOUT_SECONDS = 240;

export interface AutomationExecutionTiming {
  agentTimeoutSeconds: number;
  stageLeaseSeconds: number;
}

export type AutomationWorkerConfig =
  | ({ ready: true; serviceRoleKey: string; apiKey: string; baseURL?: string } & AutomationExecutionTiming)
  | { ready: false; reason: string };

export type AutomationRuntimeConfig =
  | ({ ready: true; cronSecret: string; serviceRoleKey: string; apiKey: string; appBaseURL: string; baseURL?: string } & AutomationExecutionTiming)
  | { ready: false; reason: string };

function normalizeBaseUrl(value: string, name: "OPENAI_BASE_URL" | "APP_BASE_URL"): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error(`${name} must be an absolute HTTP(S) URL without credentials or a fragment.`);
  }
  return url.toString().replace(/\/$/, "");
}

export function resolveAutomationExecutionTiming(value?: string): AutomationExecutionTiming {
  const normalized = value?.trim();
  const seconds = normalized ? Number(normalized) : DEFAULT_AUTOMATION_AGENT_TIMEOUT_SECONDS;
  if (!Number.isInteger(seconds) || seconds < 30 || seconds > MAX_AUTOMATION_AGENT_TIMEOUT_SECONDS) {
    throw new Error(`AUTOMATION_AGENT_TIMEOUT_SECONDS must be an integer from 30 to ${MAX_AUTOMATION_AGENT_TIMEOUT_SECONDS}.`);
  }
  return {
    agentTimeoutSeconds: seconds,
    stageLeaseSeconds: Math.min(300, seconds + 30),
  };
}

export function resolveAutomationWorkerConfig(environment: AutomationEnvironment): AutomationWorkerConfig {
  if (environment.AUTOMATION_ENABLED !== "true") return { ready: false, reason: "Automation is disabled by configuration." };
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) return { ready: false, reason: "SUPABASE_SERVICE_ROLE_KEY is not configured." };
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ready: false, reason: "OPENAI_API_KEY is not configured." };
  let timing: AutomationExecutionTiming;
  try {
    timing = resolveAutomationExecutionTiming(environment.AUTOMATION_AGENT_TIMEOUT_SECONDS);
  } catch (error) {
    return { ready: false, reason: error instanceof Error ? error.message : "Automation timeout configuration is invalid." };
  }
  const configuredBaseUrl = environment.OPENAI_BASE_URL?.trim();
  if (!configuredBaseUrl) return { ready: true, serviceRoleKey, apiKey, ...timing };
  try {
    return { ready: true, serviceRoleKey, apiKey, baseURL: normalizeBaseUrl(configuredBaseUrl, "OPENAI_BASE_URL"), ...timing };
  } catch (error) {
    return { ready: false, reason: error instanceof Error ? error.message : "OPENAI_BASE_URL is invalid." };
  }
}

export function resolveAutomationRuntimeConfig(environment: AutomationEnvironment): AutomationRuntimeConfig {
  const worker = resolveAutomationWorkerConfig(environment);
  if (!worker.ready) return worker;
  const cronSecret = environment.AUTOMATION_CRON_SECRET?.trim();
  if (!cronSecret) return { ready: false, reason: "AUTOMATION_CRON_SECRET is not configured." };
  const appBaseUrl = environment.APP_BASE_URL?.trim();
  if (!appBaseUrl) return { ready: false, reason: "APP_BASE_URL is not configured." };
  let appBaseURL: string;
  try {
    appBaseURL = normalizeBaseUrl(appBaseUrl, "APP_BASE_URL");
  } catch (error) {
    return { ready: false, reason: error instanceof Error ? error.message : "APP_BASE_URL is invalid." };
  }
  return { ...worker, cronSecret, appBaseURL };
}

export function automationWorkerReadiness() {
  return resolveAutomationWorkerConfig({
    AUTOMATION_ENABLED: process.env.AUTOMATION_ENABLED,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AUTOMATION_AGENT_TIMEOUT_SECONDS: process.env.AUTOMATION_AGENT_TIMEOUT_SECONDS,
  });
}

export function automationRuntimeReadiness() {
  return resolveAutomationRuntimeConfig({
    AUTOMATION_ENABLED: process.env.AUTOMATION_ENABLED,
    AUTOMATION_CRON_SECRET: process.env.AUTOMATION_CRON_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    APP_BASE_URL: process.env.APP_BASE_URL,
    AUTOMATION_AGENT_TIMEOUT_SECONDS: process.env.AUTOMATION_AGENT_TIMEOUT_SECONDS,
  });
}
