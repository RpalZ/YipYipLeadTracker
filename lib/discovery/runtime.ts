import "server-only";

import { Agent, OpenAIProvider, Runner, setTracingDisabled, webSearchTool } from "@openai/agents";

import {
  DEFAULT_DISCOVERY_LIMITS,
  DEFAULT_DISCOVERY_MODEL,
  DISCOVERY_PROMPT_VERSION,
  discoveryAgentOutputSchema,
  type DiscoveryAgentOutput,
  type DiscoveryProfileCriteria,
} from "@/lib/discovery/contracts";
import {
  OPENAI_PRICING_VERSION,
  cachedInputTokensFromUsage,
  estimateOpenAICostEur,
  resolveOpenAIModelPricing,
  resolveUsdToEurRate,
} from "@/lib/discovery/cost";
import { resolveDiscoveryRuntimeConfig } from "@/lib/discovery/runtime-config";
import { buildDiscoveryInstructions } from "@/lib/discovery/prompt";
import { collectWebSearchEvidenceUrls, collectWebSearchQueries } from "@/lib/discovery/validation";
import { resolveAutomationExecutionTiming } from "@/lib/automation/runtime-config";

export interface DiscoveryAgentTelemetry {
  output: DiscoveryAgentOutput;
  consultedUrls: string[];
  searchQueries: string[];
  webSearchCallCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostEur: number;
  costEnvelopeExceeded: boolean;
  durationMs: number;
  model: string;
  promptVersion: string;
  pricingVersion: string;
  usdToEurRate: number;
}

export function discoveryIsEnabled(): boolean {
  return process.env.DISCOVERY_AGENT_ENABLED === "true" || process.env.AUTOMATION_ENABLED === "true";
}

export function discoveryRuntimeReadiness(): { ready: boolean; reason: string | null } {
  const configuration = resolveDiscoveryRuntimeConfig({
    DISCOVERY_AGENT_ENABLED: discoveryIsEnabled() ? "true" : process.env.DISCOVERY_AGENT_ENABLED,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  });
  return configuration.ready
    ? { ready: true, reason: null }
    : { ready: false, reason: configuration.reason };
}

function isWebSearchCall(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const raw = "rawItem" in item ? (item as { rawItem?: unknown }).rawItem : item;
  if (!raw || typeof raw !== "object") return false;
  const value = raw as Record<string, unknown>;
  return value.type === "hosted_tool_call" && typeof value.name === "string" && value.name.startsWith("web_search");
}

export async function runDiscoveryAgent({
  profile,
  source,
  model = process.env.OPENAI_DISCOVERY_MODEL ?? DEFAULT_DISCOVERY_MODEL,
  timeoutMs = resolveAutomationExecutionTiming(process.env.AUTOMATION_AGENT_TIMEOUT_SECONDS).agentTimeoutSeconds * 1_000,
  maxCandidates = DEFAULT_DISCOVERY_LIMITS.maxCandidates,
}: {
  profile: DiscoveryProfileCriteria;
  source?: { name: string; baseUrl: string };
  model?: string;
  timeoutMs?: number;
  maxCandidates?: number;
}): Promise<DiscoveryAgentTelemetry> {
  const configuration = resolveDiscoveryRuntimeConfig({
    DISCOVERY_AGENT_ENABLED: discoveryIsEnabled() ? "true" : process.env.DISCOVERY_AGENT_ENABLED,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  });
  if (!configuration.ready) throw new Error(configuration.reason);
  resolveOpenAIModelPricing(model);
  const usdToEurRate = resolveUsdToEurRate();
  setTracingDisabled(true);

  const modelProvider = new OpenAIProvider({
    apiKey: configuration.apiKey,
    baseURL: configuration.baseURL,
    useResponses: true,
  });
  const runner = new Runner({ modelProvider });

  const controller = new AbortController();
  const timeoutSeconds = Math.ceil(timeoutMs / 1_000);
  const timeout = setTimeout(() => controller.abort(new Error(`Discovery agent exceeded ${timeoutSeconds} seconds.`)), timeoutMs);
  const startedAt = performance.now();
  let observedSearchCalls = 0;

  const agent = new Agent({
    name: "YipYip Opportunity Discovery",
    instructions: `${buildDiscoveryInstructions(profile, Math.max(1, Math.min(DEFAULT_DISCOVERY_LIMITS.maxCandidates, maxCandidates)))}${source ? `\n\nThis is a source-scoped monitor. Search ${source.name} at ${source.baseUrl} and use that source as the canonical evidence origin. Use several relevant query angles within the configured source instead of requiring one page to contain every qualification fact. Do not broaden into an unrestricted general search.` : ""}`,
    model,
    tools: [webSearchTool({ searchContextSize: "low", userLocation: { type: "approximate", country: "NL" } })],
    outputType: discoveryAgentOutputSchema,
    modelSettings: {
      reasoning: { effort: "low", summary: null },
      // Responses counts reasoning tokens inside max_output_tokens. The larger
      // provider cap prevents reasoning from truncating the concise final JSON.
      maxTokens: DEFAULT_DISCOVERY_LIMITS.maxProviderOutputTokens,
      text: { verbosity: "low" },
      store: false,
      parallelToolCalls: false,
      providerData: { include: ["web_search_call.action.sources"] },
    },
  });

  const enforceEstimatedCost = (
    inputTokens: number,
    outputTokens: number,
    inputTokenDetails: ReadonlyArray<Readonly<Record<string, number>>>,
  ) => {
    const estimated = estimateOpenAICostEur({
      model,
      inputTokens,
      cachedInputTokens: cachedInputTokensFromUsage(inputTokenDetails),
      outputTokens,
      webSearchCalls: observedSearchCalls,
      usdToEurRate,
    });
    if (estimated >= DEFAULT_DISCOVERY_LIMITS.estimatedCostEur) {
      controller.abort(new Error("Discovery agent reached the estimated cost envelope."));
    }
  };

  agent.on("agent_start", (context) => {
    enforceEstimatedCost(context.usage.inputTokens, context.usage.outputTokens, context.usage.inputTokensDetails);
  });
  agent.on("agent_tool_start", (context, tool) => {
    if (tool.name.startsWith("web_search")) observedSearchCalls += 1;
    enforceEstimatedCost(context.usage.inputTokens, context.usage.outputTokens, context.usage.inputTokensDetails);
  });

  try {
    const result = await runner.run(agent, source
      ? `Find current concrete opportunity signals published by ${source.name} (${source.baseUrl}).`
      : "Find current concrete opportunity signals that match the configured profile.", {
      maxTurns: DEFAULT_DISCOVERY_LIMITS.maxTurns,
      signal: controller.signal,
    });
    if (!result.finalOutput) throw new Error("Discovery agent returned no structured output.");

    const webSearchCallCount = Math.max(observedSearchCalls, result.newItems.filter(isWebSearchCall).length);
    if (webSearchCallCount < 1) throw new Error("Discovery agent completed without the required web-search call.");

    const rawSearchArtifacts = [
      result.newItems.map((item) => item.toJSON()),
      result.rawResponses,
    ];
    // Only provider web-search sources/citations belong in the evidence allow-
    // list. URLs repeated by the model in its final JSON do not prove that the
    // page was actually consulted.
    const consultedUrls = collectWebSearchEvidenceUrls(rawSearchArtifacts);
    const providerQueries = collectWebSearchQueries(rawSearchArtifacts);
    const usage = result.state.usage;
    const cachedInputTokens = cachedInputTokensFromUsage(usage.inputTokensDetails);
    const estimatedCostEur = estimateOpenAICostEur({
      model,
      inputTokens: usage.inputTokens,
      cachedInputTokens,
      outputTokens: usage.outputTokens,
      webSearchCalls: webSearchCallCount,
      usdToEurRate,
    });

    return {
      output: result.finalOutput,
      consultedUrls,
      searchQueries: [...new Set([...providerQueries, ...result.finalOutput.searchQueries])],
      webSearchCallCount,
      inputTokens: usage.inputTokens,
      cachedInputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCostEur,
      costEnvelopeExceeded: estimatedCostEur > DEFAULT_DISCOVERY_LIMITS.estimatedCostEur,
      durationMs: Math.round(performance.now() - startedAt),
      model,
      promptVersion: DISCOVERY_PROMPT_VERSION,
      pricingVersion: OPENAI_PRICING_VERSION,
      usdToEurRate,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason instanceof Error
        ? controller.signal.reason
        : new Error(`Discovery agent exceeded ${timeoutSeconds} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    await modelProvider.close();
  }
}
