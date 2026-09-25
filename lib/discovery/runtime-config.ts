export interface DiscoveryRuntimeEnvironment {
  DISCOVERY_AGENT_ENABLED?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
}

export type DiscoveryRuntimeConfig =
  | { ready: true; apiKey: string; baseURL?: string }
  | { ready: false; reason: string };

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OPENAI_BASE_URL must be a valid absolute URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("OPENAI_BASE_URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("OPENAI_BASE_URL must not contain embedded credentials.");
  }
  if (url.hash) {
    throw new Error("OPENAI_BASE_URL must not contain a URL fragment.");
  }

  return url.toString().replace(/\/$/, "");
}

export function resolveDiscoveryRuntimeConfig(
  environment: DiscoveryRuntimeEnvironment,
): DiscoveryRuntimeConfig {
  if (environment.DISCOVERY_AGENT_ENABLED !== "true") {
    return { ready: false, reason: "Discovery agent is disabled by configuration." };
  }

  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ready: false, reason: "OPENAI_API_KEY is not configured." };

  const configuredBaseUrl = environment.OPENAI_BASE_URL?.trim();
  if (!configuredBaseUrl) return { ready: true, apiKey };

  try {
    return { ready: true, apiKey, baseURL: normalizeBaseUrl(configuredBaseUrl) };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : "OPENAI_BASE_URL is invalid.",
    };
  }
}
