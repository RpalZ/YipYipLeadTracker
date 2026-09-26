export const OPENAI_PRICING_VERSION = "openai-standard-2026-09-25";
export const OPENAI_WEB_SEARCH_USD_PER_CALL = 0.01;

export interface OpenAIModelPricing {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

const MODEL_PRICING: Array<{ pattern: RegExp; pricing: OpenAIModelPricing }> = [
  {
    pattern: /^gpt-6-astra(?:-|$)/,
    pricing: { inputUsdPerMillion: 10, cachedInputUsdPerMillion: 1, outputUsdPerMillion: 50 },
  },
  {
    pattern: /^gpt-6-sol(?:-|$)/,
    pricing: { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.2, outputUsdPerMillion: 10 },
  },
  {
    pattern: /^gpt-6-luna(?:-|$)/,
    pricing: { inputUsdPerMillion: 0.1, cachedInputUsdPerMillion: 0.01, outputUsdPerMillion: 0.5 },
  },
  {
    pattern: /^gpt-5\.4-mini(?:-|$)/,
    pricing: { inputUsdPerMillion: 0.75, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 4.5 },
  },
  {
    pattern: /^gpt-5\.4(?:-|$)/,
    pricing: { inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 0.25, outputUsdPerMillion: 15 },
  },
];

export function resolveOpenAIModelPricing(model: string): OpenAIModelPricing {
  const match = MODEL_PRICING.find((entry) => entry.pattern.test(model));
  if (!match) {
    throw new Error(
      `No OpenAI pricing is configured for model "${model}". Add a reviewed pricing entry before live automation.`,
    );
  }
  return match.pricing;
}

export function resolveUsdToEurRate(value = process.env.OPENAI_USD_TO_EUR): number {
  if (!value?.trim()) return 1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2) {
    throw new Error("OPENAI_USD_TO_EUR must be a number greater than 0 and no greater than 2.");
  }
  return parsed;
}

export function cachedInputTokensFromUsage(
  details: ReadonlyArray<Readonly<Record<string, number>>> | Readonly<Record<string, number>> | undefined,
): number {
  const entries = Array.isArray(details) ? details : details ? [details] : [];
  return entries.reduce((total, entry) => total + Math.max(
    0,
    Number(entry.cached_tokens ?? entry.cachedTokens ?? 0),
  ), 0);
}

export function estimateOpenAICostEur({
  model,
  inputTokens,
  cachedInputTokens = 0,
  outputTokens,
  webSearchCalls,
  usdToEurRate = resolveUsdToEurRate(),
}: {
  model: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  webSearchCalls: number;
  usdToEurRate?: number;
}): number {
  const pricing = resolveOpenAIModelPricing(model);
  const safeInput = Math.max(0, inputTokens);
  const safeCachedInput = Math.min(safeInput, Math.max(0, cachedInputTokens));
  const uncachedInput = safeInput - safeCachedInput;
  const estimatedUsd =
    (uncachedInput / 1_000_000) * pricing.inputUsdPerMillion
    + (safeCachedInput / 1_000_000) * pricing.cachedInputUsdPerMillion
    + (Math.max(0, outputTokens) / 1_000_000) * pricing.outputUsdPerMillion
    + Math.max(0, webSearchCalls) * OPENAI_WEB_SEARCH_USD_PER_CALL;
  return Number((estimatedUsd * usdToEurRate).toFixed(6));
}
