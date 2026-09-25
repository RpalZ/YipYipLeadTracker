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
import { estimateDiscoveryCostEur } from "@/lib/discovery/cost";
import { resolveDiscoveryRuntimeConfig } from "@/lib/discovery/runtime-config";
import { collectHttpsUrls } from "@/lib/discovery/validation";
import { resolveAutomationExecutionTiming } from "@/lib/automation/runtime-config";

export interface DiscoveryAgentTelemetry {
  output: DiscoveryAgentOutput;
  consultedUrls: string[];
  searchQueries: string[];
  webSearchCallCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostEur: number;
  costEnvelopeExceeded: boolean;
  durationMs: number;
  model: string;
  promptVersion: string;
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

function buildInstructions(profile: DiscoveryProfileCriteria, maxCandidates: number): string {
  return `You discover concrete pre-procurement opportunities for a Dutch digital agency.

You MUST call web search at least once. Search broadly but return at most ${maxCandidates} genuinely supported candidate${maxCandidates === 1 ? "" : "s"}; zero candidates is valid. Keep the final structured output under approximately ${DEFAULT_DISCOVERY_LIMITS.maxOutputTokens} tokens. Focus on ${profile.region}, languages ${profile.languages.join(" and ")}, signal areas ${profile.signalAreas.join(", ")}, and project intent ${profile.projectIntents.join(", ")}. Use a ${profile.lookbackDays}-day lookback.

Exclude completed or awarded projects, closed pitches, unrelated vacancies, and restricted social-platform scraping. A hiring item only qualifies when it contains a concrete external digital-project clue. Use canonical HTTPS URLs. Separate source facts from your inferences. Keep excerpts short and source-supported. Do not fabricate missing budgets, contacts, timing, dates, or projects. Use null or explicit unknowns where the schema permits it. Never output chain-of-thought or complete webpage bodies.`;
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
    instructions: `${buildInstructions(profile, Math.max(1, Math.min(DEFAULT_DISCOVERY_LIMITS.maxCandidates, maxCandidates)))}${source ? `\n\nThis is a source-scoped monitor. Search ${source.name} at ${source.baseUrl} and use that source as the canonical evidence origin. Do not broaden into an unrestricted general search.` : ""}`,
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

  const enforceEstimatedCost = (inputTokens: number, outputTokens: number) => {
    const estimated = estimateDiscoveryCostEur({ inputTokens, outputTokens, webSearchCalls: observedSearchCalls });
    if (estimated >= DEFAULT_DISCOVERY_LIMITS.estimatedCostEur) {
      controller.abort(new Error("Discovery agent reached the estimated cost envelope."));
    }
  };

  agent.on("agent_start", (context) => {
    enforceEstimatedCost(context.usage.inputTokens, context.usage.outputTokens);
  });
  agent.on("agent_tool_start", (context, tool) => {
    if (tool.name.startsWith("web_search")) observedSearchCalls += 1;
    enforceEstimatedCost(context.usage.inputTokens, context.usage.outputTokens);
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

    const consultedUrls = collectHttpsUrls([
      result.newItems.map((item) => item.toJSON()),
      result.rawResponses,
    ]);
    const usage = result.state.usage;
    const estimatedCostEur = estimateDiscoveryCostEur({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      webSearchCalls: webSearchCallCount,
    });

    return {
      output: result.finalOutput,
      consultedUrls,
      searchQueries: result.finalOutput.searchQueries,
      webSearchCallCount,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCostEur,
      costEnvelopeExceeded: estimatedCostEur > DEFAULT_DISCOVERY_LIMITS.estimatedCostEur,
      durationMs: Math.round(performance.now() - startedAt),
      model,
      promptVersion: DISCOVERY_PROMPT_VERSION,
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
