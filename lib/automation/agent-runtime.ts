import "server-only";

import { Agent, OpenAIProvider, Runner, setTracingDisabled, webSearchTool } from "@openai/agents";
import type { ZodType } from "zod";

import {
  automatedAssessmentOutputSchema,
  gapAnalysisOutputSchema,
  researchOutputSchema,
  sourceScoutOutputSchema,
  type AutomatedAssessmentOutput,
  type GapQuestion,
  type ResearchFindingOutput,
  type SourceScoutOutput,
} from "@/lib/automation/contracts";
import type { LeadStrategyInput } from "@/lib/automation/strategy";
import { estimateDiscoveryCostEur } from "@/lib/discovery/cost";
import { resolveAutomationWorkerConfig } from "@/lib/automation/runtime-config";
import { collectWebSearchEvidenceUrls, countWebSearchCalls } from "@/lib/discovery/validation";
import type { EvidenceItem, OpportunityView } from "@/lib/domain";

const MODEL = process.env.OPENAI_DISCOVERY_MODEL ?? "gpt-5.4-mini-2026-03-17";
const PROVIDER_OUTPUT_TOKEN_BUDGET = 4_000;
const FINAL_OUTPUT_TOKEN_TARGET = 1_200;

export interface AutomationAgentTelemetry<T> {
  output: T;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostEur: number;
  durationMs: number;
  model: string;
  promptVersion: string;
  consultedUrls: string[];
  searchQueries: string[];
  webSearchCallCount: number;
}

function isWebSearchCall(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const raw = "rawItem" in item ? (item as { rawItem?: unknown }).rawItem : item;
  if (!raw || typeof raw !== "object") return false;
  const value = raw as Record<string, unknown>;
  return value.type === "web_search_call"
    || (value.type === "hosted_tool_call" && typeof value.name === "string" && value.name.startsWith("web_search"));
}

type WebSearchVariant = "web_search" | "web_search_preview";

function searchTool(variant: WebSearchVariant): ReturnType<typeof webSearchTool> {
  const tool = webSearchTool({ searchContextSize: "low", userLocation: { type: "approximate", country: "NL" } });
  if (variant === "web_search") return tool;
  return {
    ...tool,
    name: "web_search_preview",
    providerData: { ...tool.providerData, type: "web_search_preview", name: "web_search_preview" },
  } as ReturnType<typeof webSearchTool>;
}

function canRetryWithPreviewSearch(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number(error.status) : 0;
  const message = error instanceof Error ? error.message : String(error);
  return [400, 422].includes(status) && /web_search|tool_choice/i.test(message);
}

function config() {
  const result = resolveAutomationWorkerConfig({
    AUTOMATION_ENABLED: process.env.AUTOMATION_ENABLED,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  });
  if (!result.ready) throw new Error(result.reason);
  return result;
}

async function execute<T>({
  name,
  instructions,
  prompt,
  outputType,
  promptVersion,
  webSearch,
}: {
  name: string;
  instructions: string;
  prompt: string;
  outputType: ZodType<T>;
  promptVersion: string;
  webSearch: boolean;
}): Promise<AutomationAgentTelemetry<T>> {
  const runtime = config();
  setTracingDisabled(true);
  const provider = new OpenAIProvider({ apiKey: runtime.apiKey, baseURL: runtime.baseURL, useResponses: true });
  const runner = new Runner({ modelProvider: provider });
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`${name} exceeded ${runtime.agentTimeoutSeconds} seconds.`)),
    runtime.agentTimeoutSeconds * 1_000,
  );
  const started = performance.now();
  let observedSearchCalls = 0;
  try {
    const runVariant = (variant: WebSearchVariant) => {
      const agent = new Agent({
        name,
        instructions,
        model: MODEL,
        tools: webSearch ? [searchTool(variant)] : [],
        outputType,
        modelSettings: {
          reasoning: { effort: "low", summary: null },
          // Responses counts hidden reasoning tokens inside max_output_tokens.
          // Leave room for reasoning while keeping the structured JSON concise.
          maxTokens: PROVIDER_OUTPUT_TOKEN_BUDGET,
          text: { verbosity: "low" },
          store: false,
          parallelToolCalls: false,
          toolChoice: webSearch ? variant : "none",
          // The Responses API does not return the web-search source list unless
          // it is explicitly included. Deterministic citation validation relies
          // on these URLs and must never trust URLs from model output alone.
          providerData: webSearch ? { include: ["web_search_call.action.sources"] } : undefined,
        },
      });
      agent.on("agent_tool_start", (_context, tool) => {
        if (tool.name.startsWith("web_search")) observedSearchCalls += 1;
      });
      return runner.run(agent, prompt, { maxTurns: webSearch ? 5 : 2, signal: controller.signal });
    };
    let result: Awaited<ReturnType<typeof runVariant>>;
    try {
      result = await runVariant("web_search");
    } catch (error) {
      if (!webSearch || !runtime.baseURL || !canRetryWithPreviewSearch(error)) throw error;
      result = await runVariant("web_search_preview");
    }
    if (!result.finalOutput) throw new Error(`${name} returned no structured output.`);
    const webSearchCallCount = Math.max(
      observedSearchCalls,
      result.newItems.filter(isWebSearchCall).length,
      countWebSearchCalls(result.rawResponses),
    );
    if (webSearch && webSearchCallCount < 1) throw new Error(`${name} completed without the required web-search call.`);
    const consultedUrls = webSearch
      ? collectWebSearchEvidenceUrls([result.newItems.map((item) => item.toJSON()), result.rawResponses])
      : [];
    const rawOutput = result.finalOutput as Record<string, unknown>;
    const searchQueries = Array.isArray(rawOutput.searchQueries) ? rawOutput.searchQueries.map(String) : [];
    const usage = result.state.usage;
    return {
      output: result.finalOutput as T,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCostEur: estimateDiscoveryCostEur({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearchCalls: webSearchCallCount }),
      durationMs: Math.round(performance.now() - started),
      model: MODEL,
      promptVersion,
      consultedUrls,
      searchQueries,
      webSearchCallCount,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason instanceof Error
        ? controller.signal.reason
        : new Error(`${name} exceeded ${runtime.agentTimeoutSeconds} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    await provider.close();
  }
}

export function runSourceScoutAgent(strategy: LeadStrategyInput) {
  return execute<SourceScoutOutput>({
    name: "YipYip Source Scout",
    promptVersion: "source-scout-v1",
    webSearch: true,
    outputType: sourceScoutOutputSchema,
    instructions: `Find up to three reputable public source families for recurring early-opportunity monitoring. You MUST use web search. Prefer primary publishers and established sector publications with stable public URLs. Do not propose restricted social scraping, private newsletters, or a single opportunity article as a source. Return zero proposals if evidence is insufficient. Keep the final structured output under approximately ${FINAL_OUTPUT_TOKEN_TARGET} tokens, keep every field concise, separate reputation evidence from operational health, and never enable a source.`,
    prompt: `Propose sources for this Lead Strategy:\n${JSON.stringify(strategy)}`,
  });
}

export function runAssessmentAgent(opportunity: OpportunityView, findings: ResearchFindingOutput[] = []) {
  return execute<AutomatedAssessmentOutput>({
    name: "YipYip Opportunity Assessor",
    promptVersion: findings.length ? "final-assessment-v2-commercial-fit" : "first-assessment-v2-commercial-fit",
    webSearch: false,
    outputType: automatedAssessmentOutputSchema,
    instructions: `Assess only the supplied evidence. Score every configured dimension from 0 to 10 with separate confidence and concise evidence references. Apply hard exclusions explicitly. Unknown evidence must reduce confidence rather than be invented. Separate the total procurement or programme value from the portion realistically addressable by YipYip. Never treat a large total value as YipYip budget unless the evidence bounds that scope. Use evidence identifiers or cited finding URLs supplied in the prompt. Budget fit and delivery fit are non-linear: work can be too small, suitable, partner-dependent, or too large. Commercial access is not win probability.`,
    prompt: `Opportunity:\n${JSON.stringify(opportunity)}\nAccepted research findings:\n${JSON.stringify(findings)}`,
  });
}

export function runGapAnalysisAgent(opportunity: OpportunityView, assessment: AutomatedAssessmentOutput) {
  return execute<{ questions: GapQuestion[] }>({
    name: "YipYip Gap Analyst",
    promptVersion: "gap-analysis-v2-commercial-fit",
    webSearch: false,
    outputType: gapAnalysisOutputSchema,
    instructions: `Return only missing, weak, inferred, conflicting, or stale questions that could change qualification, rank, route, or next action. For large programmes, prioritize the YipYip-addressable work package, expected contract value, delivery route, and partner requirement rather than repeating the total programme value. An actionable contact route means a named person, responsible team, procurement desk, or official tender channel—not merely an organization name. Omit curiosity-only questions. Each question requires a concrete stop rule. Application policy may add mandatory commercial-access research after your output. Zero questions is otherwise valid.`,
    prompt: `Opportunity:\n${JSON.stringify(opportunity)}\nFirst assessment:\n${JSON.stringify(assessment)}`,
  });
}

export function runResearchAgent(opportunity: OpportunityView, questions: GapQuestion[], existingEvidence: EvidenceItem[]) {
  return execute<{ findings: ResearchFindingOutput[]; searchQueries: string[] }>({
    name: "YipYip Focused Researcher",
    promptVersion: "focused-research-v1",
    webSearch: true,
    outputType: researchOutputSchema,
    instructions: `Research every requested qualification question and echo each field name exactly. You MUST use web search. Prefer primary sources. For an actionable contact route, look for a named person, responsible team, procurement desk, official tender contact, or public procurement channel and cite the page that supports it. An organization name alone is insufficient. Preserve unknown and not_found as valid terminal outcomes after reasonable attempts. Never fabricate budgets, contacts, dates, or access. Keep evidence excerpts out of the output and return only structured findings with URLs.`,
    prompt: `Opportunity:\n${JSON.stringify(opportunity)}\nQuestions:\n${JSON.stringify(questions)}\nExisting evidence:\n${JSON.stringify(existingEvidence)}`,
  });
}
