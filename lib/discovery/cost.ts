const ESTIMATED_INPUT_EUR_PER_MILLION = 0.75;
const ESTIMATED_OUTPUT_EUR_PER_MILLION = 4.5;
const ESTIMATED_WEB_SEARCH_EUR = 0.01;

export function estimateDiscoveryCostEur({
  inputTokens,
  outputTokens,
  webSearchCalls,
}: {
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
}): number {
  return Number((
    (inputTokens / 1_000_000) * ESTIMATED_INPUT_EUR_PER_MILLION +
    (outputTokens / 1_000_000) * ESTIMATED_OUTPUT_EUR_PER_MILLION +
    webSearchCalls * ESTIMATED_WEB_SEARCH_EUR
  ).toFixed(6));
}

