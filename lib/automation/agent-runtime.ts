import "server-only";
import { readinessEnabled } from "@/lib/readiness-config";
import { READINESS_AGENT_INSTRUCTIONS, READINESS_SCOPE_INSTRUCTIONS } from "@/lib/readiness";

import { Agent, OpenAIProvider, Runner, setTracingDisabled, webSearchTool } from "@openai/agents";
import type { ZodType } from "zod";

import {
  automatedAssessmentOutputSchema,
  shadowAssessmentOutputSchema,
  gapAnalysisOutputSchema,
  researchOutputSchema,
  sourceScoutWireOutputSchema,
  type AutomatedAssessmentOutput,
  type GapQuestion,
  type ResearchFindingOutput,
  type SourceScoutOutput,
  type SourceScoutWireOutput,
} from "@/lib/automation/contracts";
import type { ResearchBundleKind } from "@/lib/automation/pipeline";
import {
  normalizeSourceScoutOutput,
  summarizeSourceScoutContractIssues,
  type SourceScoutContractIssue,
} from "@/lib/automation/source-scout-output";
import type { LeadStrategyInput } from "@/lib/automation/strategy";
import type { SourceCoverageContext } from "@/lib/automation/source-coverage";
import { RESEARCH_MAX_WEB_SEARCH_CALLS, SOURCE_SCOUT_MAX_WEB_SEARCH_CALLS, openAIWebSearchProviderData } from "@/lib/automation/vendor-limits";
import {
  OPENAI_PRICING_VERSION,
  cachedInputTokensFromUsage,
  estimateOpenAICostEur,
  resolveOpenAIModelPricing,
  resolveUsdToEurRate,
} from "@/lib/discovery/cost";
import { resolveAutomationWorkerConfig } from "@/lib/automation/runtime-config";
import { collectWebSearchEvidenceUrls, collectWebSearchQueries, countWebSearchCalls } from "@/lib/discovery/validation";
import type { EvidenceItem, OpportunityView } from "@/lib/domain";

const MODEL = process.env.OPENAI_DISCOVERY_MODEL ?? "gpt-5.4-mini-2026-03-17";
const PROVIDER_OUTPUT_TOKEN_BUDGET = 4_000;
const SOURCE_SCOUT_OUTPUT_TOKEN_TARGET = 2_200;

export interface AutomationAgentTelemetry<T> {
  output: T;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostEur: number;
  durationMs: number;
  model: string;
  promptVersion: string;
  consultedUrls: string[];
  searchQueries: string[];
  webSearchCallCount: number;
  maxWebSearchCalls: number | null;
  pricingVersion: string;
  usdToEurRate: number;
  outputValidation?: {
    generatedCount: number;
    rejectedCount: number;
    issues: SourceScoutContractIssue[];
  };
}

export class SourceScoutOutputContractError extends Error {
  constructor(issues: SourceScoutContractIssue[]) {
    super(`Source Scout output contract could not produce a safe result (${summarizeSourceScoutContractIssues(issues)}).`);
    this.name = "SourceScoutOutputContractError";
  }
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
  maxWebSearchCalls,
}: {
  name: string;
  instructions: string;
  prompt: string;
  outputType: ZodType<T>;
  promptVersion: string;
  webSearch: boolean;
  maxWebSearchCalls?: number;
}): Promise<AutomationAgentTelemetry<T>> {
  const runtime = config();
  resolveOpenAIModelPricing(MODEL);
  const usdToEurRate = resolveUsdToEurRate();
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
          providerData: webSearch ? openAIWebSearchProviderData(maxWebSearchCalls) : undefined,
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
    if (maxWebSearchCalls !== undefined && webSearchCallCount > maxWebSearchCalls) {
      throw new Error(`${name} exceeded the ${maxWebSearchCalls}-call hosted web-search limit.`);
    }
    const consultedUrls = webSearch
      ? collectWebSearchEvidenceUrls([result.newItems.map((item) => item.toJSON()), result.rawResponses])
      : [];
    const rawOutput = result.finalOutput as Record<string, unknown>;
    const reportedSearchQueries = Array.isArray(rawOutput.searchQueries) ? rawOutput.searchQueries.map(String) : [];
    const observedSearchQueries = webSearch
      ? collectWebSearchQueries([result.newItems.map((item) => item.toJSON()), result.rawResponses])
      : [];
    const searchQueries = [...new Set([...observedSearchQueries, ...reportedSearchQueries]
      .map((query) => query.trim())
      .filter(Boolean))];
    const usage = result.state.usage;
    const cachedInputTokens = cachedInputTokensFromUsage(usage.inputTokensDetails);
    return {
      output: result.finalOutput as T,
      inputTokens: usage.inputTokens,
      cachedInputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCostEur: estimateOpenAICostEur({
        model: MODEL,
        inputTokens: usage.inputTokens,
        cachedInputTokens,
        outputTokens: usage.outputTokens,
        webSearchCalls: webSearchCallCount,
        usdToEurRate,
      }),
      durationMs: Math.round(performance.now() - started),
      model: MODEL,
      promptVersion,
      consultedUrls,
      searchQueries,
      webSearchCallCount,
      maxWebSearchCalls: maxWebSearchCalls ?? null,
      pricingVersion: OPENAI_PRICING_VERSION,
      usdToEurRate,
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

export async function runSourceScoutAgent(
  strategy: LeadStrategyInput,
  coverage: SourceCoverageContext,
): Promise<AutomationAgentTelemetry<SourceScoutOutput>> {
  const telemetry = await execute<SourceScoutWireOutput>({
    name: "YipYip Source Scout",
    promptVersion: "source-scout-v3-coverage-gaps",
    webSearch: true,
    maxWebSearchCalls: SOURCE_SCOUT_MAX_WEB_SEARCH_CALLS,
    outputType: sourceScoutWireOutputSchema,
    instructions: `Find up to ${coverage.targetProposalCount} reputable public sources for recurring early-opportunity monitoring. You MUST use web search. Explore the supplied uncovered and lowest-covered signal areas before adding redundancy. Do not propose a domain already present in existingSources, and avoid rejectedDomains unless public access or relevance has materially changed. Proposals must use distinct domains, cover no more than two sources in the same primary coverage gap or source family, and explain in noveltyReason what coverage they add beyond the current network. Set coverageGap to one configured strategy area that the source primarily improves. Prefer primary publishers and established sector publications with stable public URLs. Do not propose restricted social scraping, private newsletters, or a single opportunity article as a source. Return zero proposals if evidence is insufficient. Keep the final structured output under approximately ${SOURCE_SCOUT_OUTPUT_TOKEN_TARGET} tokens, keep every field concise, separate reputation evidence from operational health, and never enable a source.`,
    prompt: `Propose coverage-expanding sources for this Lead Strategy:\n${JSON.stringify(strategy)}\n\nCurrent Source Network coverage:\n${JSON.stringify(coverage)}`,
  });
  const normalized = normalizeSourceScoutOutput(telemetry.output, telemetry.searchQueries);
  if (!normalized.output) throw new SourceScoutOutputContractError(normalized.issues);
  return {
    ...telemetry,
    output: normalized.output,
    searchQueries: normalized.output.searchQueries,
    outputValidation: {
      generatedCount: normalized.generatedCount,
      rejectedCount: normalized.rejectedCount,
      issues: normalized.issues,
    },
  };
}

export function runAssessmentAgent(
  opportunity: OpportunityView,
  strategy: LeadStrategyInput,
  findings: ResearchFindingOutput[] = [],
  phase: "initial" | "final" = "initial",
) {
  const final = phase === "final";
  return execute<AutomatedAssessmentOutput>({
    name: "YipYip Opportunity Assessor",
    promptVersion: `${final ? "final-assessment-v3-original-brief" : "first-assessment-v3-original-brief"}${readinessEnabled() ? "/readiness-v1" : ""}`,
    webSearch: false,
    outputType: readinessEnabled() ? shadowAssessmentOutputSchema : automatedAssessmentOutputSchema,
    instructions: `Assess only the supplied, citation-valid evidence against the supplied Lead Strategy. Score every configured dimension from 0 to 10 with separate confidence and concise evidence references. Classify sector, capability fit, and actionability explicitly. For capability fit, list the configured YipYip services that match in matchedServices and list concrete project requirements that are unsupported or still unclear in unmatchedRequirements. Do not confuse capability fit with the Lead Strategy's delivery-capacity status. Unknown evidence must reduce confidence rather than be invented. Apply hard exclusions explicitly but do not make the final routing decision. Separate the total procurement or programme value from the portion realistically addressable by YipYip: a whole-procurement value is never the addressable value without evidence of a dedicated package or explicit lot. Use evidence identifiers or cited finding URLs supplied in the prompt. Budget fit and delivery fit are non-linear: work can be too small, suitable, partner-dependent, or too large. Commercial access is not win probability. ${final ? "Create an evidence-grounded outreach snapshot in Dutch for Dutch-language opportunities and English otherwise. Keep the email body at 120 words or fewer and call opening at 60 words or fewer; include no unsupported claim and cite the supporting evidence references." : "Set outreachDraft to null; outreach is generated only from the final evidence snapshot."}`,
    prompt: `Lead Strategy:\n${JSON.stringify(strategy)}\nOpportunity:\n${JSON.stringify(opportunity)}\nAccepted research findings:\n${JSON.stringify(findings)}${readinessEnabled() ? `\n${READINESS_AGENT_INSTRUCTIONS}\n${READINESS_SCOPE_INSTRUCTIONS}` : ""}`,
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

const researchBundleGuidance: Record<ResearchBundleKind, string> = {
  commercial: "Search procurement notices, tender attachments, grant decisions, programme budgets, annual plans, and explicit lots or packages. Never treat a whole programme value as YipYip-addressable without separate scope evidence.",
  buyer_access: "Search the commissioning organization's team pages, procurement pages, tender portals, public directories, meeting documents, and the current project notice for a concrete buyer or official contact route.",
  capability: "Search project briefs, technical specifications, roadmaps, architecture or integration requirements, and primary organization material that establishes the actual software delivery scope.",
  timing: "Search current notices, planning documents, procurement calendars, decision minutes, deadlines, and separately dated follow-on activity. Distinguish an expired item from a genuinely current continuation.",
  other: "Use the most authoritative primary source families that directly address the requested qualification question.",
};

export function runResearchAgent(
  opportunity: OpportunityView,
  questions: GapQuestion[],
  existingEvidence: EvidenceItem[],
  {
    bundleKind = "other",
    previousFindings = [],
    diversifiedRetry = false,
  }: {
    bundleKind?: ResearchBundleKind;
    previousFindings?: ResearchFindingOutput[];
    diversifiedRetry?: boolean;
  } = {},
) {
  return execute<{ findings: ResearchFindingOutput[]; searchQueries: string[] }>({
    name: "YipYip Focused Researcher",
    promptVersion: "focused-research-v2-bundled-corroboration",
    webSearch: true,
    maxWebSearchCalls: RESEARCH_MAX_WEB_SEARCH_CALLS,
    outputType: researchOutputSchema,
    instructions: `Research every requested qualification question in this single focused bundle and echo each field name exactly. You MUST use web search, but you may make at most ${RESEARCH_MAX_WEB_SEARCH_CALLS} hosted web-search calls in this pass; plan the highest-value queries first and return unknown rather than exceeding the limit. ${researchBundleGuidance[bundleKind]} Prefer primary sources. One authoritative primary source may confirm a direct fact; a strongly inferred claim requires at least two cited sources. The consulted search-source list is operational telemetry, while sourceUrls must contain only the pages that actually support that finding. For an actionable contact route, an organization name alone is insufficient. Unknown and not_found are valid when evidence remains unavailable, but only after materially different search angles across reasonable source families. Never fabricate budgets, contacts, dates, or access. Keep evidence excerpts out of the output and return only structured findings with URLs.`,
    prompt: `Opportunity:\n${JSON.stringify(opportunity)}\nResearch bundle: ${bundleKind}\nDiversified retry required: ${diversifiedRetry ? "yes — do not repeat the same query wording or source family without a new angle" : "no"}\nQuestions:\n${JSON.stringify(questions)}\nPrior findings for these questions:\n${JSON.stringify(previousFindings)}\nExisting signal evidence:\n${JSON.stringify(existingEvidence)}`,
  });
}
