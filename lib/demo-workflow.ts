import type { OpportunityView, ScoreDimension } from "@/lib/domain";

export const DEMO_WORKFLOW_STORAGE_KEY = "yipyip.demo-workflow.v2";

export type DemoWorkflowStatus =
  | "empty"
  | "scouting"
  | "awaiting_approval"
  | "automating"
  | "completed";

export interface DemoSourceCandidate {
  id: string;
  name: string;
  sourceFamily: string;
  url: string;
  classification: "primary" | "secondary";
  reputationScore: number;
  confidence: number;
  rationale: string;
  sampleResults: string[];
  status: "proposed" | "approved" | "rejected";
}

export interface DemoAutomationCycle {
  id: string;
  completedAt: string;
  acceptedSignals: number;
  opportunitiesCreated: number;
  opportunitiesMatched: number;
  assessmentsCompleted: number;
  researchFindings: number;
  leadsQualified: number;
  exceptionsCreated: number;
  durationMs: number;
}

export interface DemoActivity {
  id: string;
  label: string;
  detail: string;
  status: "complete" | "attention";
}

export interface DemoWorkflowState {
  version: 2;
  strategySaved: boolean;
  automationEnabled: boolean;
  phase: DemoWorkflowStatus;
  sourceCandidates: DemoSourceCandidate[];
  opportunities: OpportunityView[];
  cycles: DemoAutomationCycle[];
  activity: DemoActivity[];
}

export type DemoWorkflowAction =
  | { type: "save_strategy" }
  | { type: "complete_source_scout" }
  | { type: "review_source"; sourceId: string; decision: "approved" | "rejected" }
  | { type: "complete_automation"; cycleId: string; completedAt: string; durationMs?: number }
  | { type: "complete_repeat_cycle"; cycleId: string; completedAt: string; durationMs?: number }
  | { type: "review_lead"; opportunityId: string; decision: "pursue" | "pass" | "request_research" | "route_changed"; reasonCode?: string; notes?: string; route?: OpportunityView["route"]; reviewedAt: string }
  | { type: "reset" };

const dimensionNames: ScoreDimension["name"][] = [
  "Social impact",
  "Technical fit",
  "Budget fit",
  "Timing fit",
  "Availability",
  "Delivery fit",
  "Commercial access",
  "Evidence confidence",
];

function dimensions(values: number[], explanations: string[]): ScoreDimension[] {
  return dimensionNames.map((name, index) => ({
    name,
    score: values[index] ?? 5,
    confidence: Math.min(0.94, 0.58 + (values[index] ?? 5) * 0.04),
    explanation: explanations[index] ?? "The available evidence supports this provisional judgment.",
  }));
}

const commonDimensionNotes = [
  "The intended public outcome aligns with YipYip's impact criteria.",
  "The product and service-design clues align with the delivery team's capabilities.",
  "Published funding and scope clues support the estimated commercial range.",
  "Recent planning activity indicates a reachable decision window.",
  "The expected start window fits the configured capacity assumptions.",
  "The work can be delivered directly with bounded specialist support.",
  "A named team and public route provide a credible path to a conversation.",
  "Claims are traceable to recent sources; uncertainty remains explicitly labelled.",
];

export const demoQualifiedOpportunities: OpportunityView[] = [
  {
    id: "demo-auto-utrecht",
    organization: "Gemeente Utrecht",
    title: "Digital participation platform renewal",
    summary: "A newly approved participation strategy and product-owner brief point to renewal of the resident engagement platform.",
    maturityStage: "planning",
    lifecycleStatus: "qualified",
    route: "direct",
    score: 86,
    confidence: 0.84,
    firstSeenAt: "2026-09-23T06:11:00.000Z",
    lastAssessedAt: "2026-09-24T05:18:00.000Z",
    signalCount: 3,
    primarySignalType: "Strategy",
    location: "Utrecht, NL",
    workMode: "Hybrid",
    budgetLabel: "Confirmed · €90,000 YipYip scope",
    technicalDifficulty: "High",
    technicalDifficultyInferred: true,
    contactLabel: "Digital participation lead",
    contactStatus: "inferred",
    whyNow: "The strategy was approved recently and the hiring brief calls for procurement preparation this quarter.",
    suggestedNextAction: "Review the completed evidence pack and decide whether to approach the digital participation team.",
    dimensions: dimensions([9.3, 8.8, 10, 9.1, 8.1, 8.7, 7.8, 8.9], commonDimensionNotes),
    evidence: [
      {
        id: "demo-signal-utrecht-strategy",
        title: "Participation strategy 2027 approved",
        publisher: "Gemeente Utrecht",
        url: "https://www.utrecht.nl/",
        publishedAt: "2026-09-23T06:00:00.000Z",
        type: "Strategy",
        status: "confirmed",
        excerpt: "The public strategy describes a unified digital participation experience and delivery preparation.",
      },
      {
        id: "demo-signal-utrecht-hiring",
        title: "Product owner digital participation",
        publisher: "Werken bij Utrecht",
        url: "https://www.werkenbijutrecht.nl/",
        publishedAt: "2026-09-23T08:30:00.000Z",
        type: "Hiring",
        status: "confirmed",
        excerpt: "The vacancy links product ownership to platform renewal and supplier preparation.",
      },
    ],
    missingFields: ["Current platform contract end date"],
    commercialFit: {
      budgetEvidenceStatus: "confirmed",
      totalProjectValueEur: 600_000,
      addressableScopeValueEur: 90_000,
      addressableScopeStatus: "bounded",
      confidence: 0.86,
      explanation: "The programme is larger, but the cited digital work package is bounded at €90k.",
    },
    lead: { id: "demo-lead-utrecht", version: 1, status: "in_review", route: "direct", pendingResearch: false },
    reviewCapability: "decide",
    reviewHistory: [],
  },
  {
    id: "demo-auto-fonds",
    organization: "Fonds Podiumkunsten",
    title: "Grant application service redesign",
    summary: "A service roadmap and accessibility commitment indicate a redesign of the digital grant application journey.",
    maturityStage: "funded",
    lifecycleStatus: "qualified",
    route: "direct",
    score: 81,
    confidence: 0.79,
    firstSeenAt: "2026-09-23T06:16:00.000Z",
    lastAssessedAt: "2026-09-24T05:19:00.000Z",
    signalCount: 2,
    primarySignalType: "Roadmap",
    location: "The Hague, NL",
    workMode: "Hybrid",
    budgetLabel: "Confirmed · €75,000 YipYip scope",
    technicalDifficulty: "Medium",
    technicalDifficultyInferred: true,
    contactLabel: "Digital services programme lead",
    contactStatus: "inferred",
    whyNow: "The published roadmap puts journey discovery and accessibility improvements in the coming programme period.",
    suggestedNextAction: "Review the evidence pack and consider an early accessibility and service-design conversation.",
    dimensions: dimensions([9.1, 8.4, 10, 8.3, 7.8, 8.5, 7.1, 8.1], commonDimensionNotes),
    evidence: [
      {
        id: "demo-signal-fonds-roadmap",
        title: "Digital service roadmap",
        publisher: "Fonds Podiumkunsten",
        url: "https://fondspodiumkunsten.nl/",
        publishedAt: "2026-09-22T09:00:00.000Z",
        type: "Roadmap",
        status: "confirmed",
        excerpt: "The roadmap prioritizes one accessible application journey across grant programmes.",
      },
    ],
    missingFields: ["Procurement route"],
    commercialFit: {
      budgetEvidenceStatus: "confirmed",
      totalProjectValueEur: 400_000,
      addressableScopeValueEur: 75_000,
      addressableScopeStatus: "bounded",
      confidence: 0.8,
      explanation: "A primary roadmap appendix bounds the addressable service-design package at €75k.",
    },
    lead: { id: "demo-lead-fonds", version: 1, status: "in_review", route: "direct", pendingResearch: false },
    reviewCapability: "decide",
    reviewHistory: [],
  },
  {
    id: "demo-auto-brabant",
    organization: "Provincie Noord-Brabant",
    title: "Nature data portal consolidation",
    summary: "Several data initiatives may be converging into a single public nature portal, but ownership and procurement remain ambiguous.",
    maturityStage: "exploring",
    lifecycleStatus: "needs_review",
    route: "partner",
    score: 74,
    confidence: 0.61,
    firstSeenAt: "2026-09-23T06:21:00.000Z",
    lastAssessedAt: "2026-09-24T05:20:00.000Z",
    signalCount: 3,
    primarySignalType: "Project",
    location: "North Brabant, NL",
    workMode: "Multi-site",
    budgetLabel: "Budget unknown",
    technicalDifficulty: "Complex",
    technicalDifficultyInferred: true,
    contactLabel: "Nature data programme owner",
    contactStatus: "unknown",
    whyNow: "The sources support a real initiative, but conflict about ownership prevents safe automatic qualification.",
    suggestedNextAction: "Resolve the programme owner and shared procurement path before deciding whether to pursue.",
    dimensions: dimensions([8.7, 7.9, 5.4, 7.4, 7.1, 6.6, 5.8, 6.1], commonDimensionNotes),
    evidence: [
      {
        id: "demo-signal-brabant-roadmap",
        title: "Open nature data roadmap",
        publisher: "Provincie Noord-Brabant",
        url: "https://www.brabant.nl/",
        publishedAt: "2026-09-23T07:00:00.000Z",
        type: "Roadmap",
        status: "confirmed",
        excerpt: "The roadmap describes public access improvements but does not name a commissioning owner.",
      },
    ],
    missingFields: ["Commissioning owner", "Approved budget", "Shared procurement path"],
    commercialFit: {
      budgetEvidenceStatus: "unknown",
      totalProjectValueEur: null,
      addressableScopeValueEur: null,
      addressableScopeStatus: "unknown",
      confidence: 0.35,
      explanation: "The bounded research pass did not establish an addressable budget.",
    },
    reviewCapability: "research_only",
    reviewHistory: [],
  },
];

export const demoSourceCandidates: DemoSourceCandidate[] = [
  {
    id: "demo-source-aanbestedingskalender",
    name: "Aanbestedingskalender",
    sourceFamily: "Public procurement",
    url: "https://www.aanbestedingskalender.nl/",
    classification: "primary",
    reputationScore: 91,
    confidence: 0.92,
    rationale: "Frequent Dutch procurement signals with public, attributable project details.",
    sampleResults: ["Digital platform market consultation", "Public service redesign notice"],
    status: "proposed",
  },
  {
    id: "demo-source-binnenlands-bestuur",
    name: "Binnenlands Bestuur",
    sourceFamily: "Public-sector news",
    url: "https://www.binnenlandsbestuur.nl/",
    classification: "secondary",
    reputationScore: 83,
    confidence: 0.86,
    rationale: "Early policy, funding, and programme signals from Dutch public organisations.",
    sampleResults: ["Municipality approves participation strategy", "Province consolidates data services"],
    status: "proposed",
  },
  {
    id: "demo-source-organisatie-updates",
    name: "Organisation newsrooms",
    sourceFamily: "Owned announcements",
    url: "https://www.overheid.nl/",
    classification: "primary",
    reputationScore: 88,
    confidence: 0.81,
    rationale: "Primary strategy, funding, hiring, and programme announcements from target organisations.",
    sampleResults: ["Digital roadmap publication", "Product-owner vacancy"],
    status: "proposed",
  },
];

export function createInitialDemoWorkflowState(): DemoWorkflowState {
  return {
    version: 2,
    strategySaved: false,
    automationEnabled: false,
    phase: "empty",
    sourceCandidates: [],
    opportunities: [],
    cycles: [],
    activity: [],
  };
}

export function getDemoWorkflowStatus(state: DemoWorkflowState): DemoWorkflowStatus {
  return state.phase;
}

export function reduceDemoWorkflow(state: DemoWorkflowState, action: DemoWorkflowAction): DemoWorkflowState {
  switch (action.type) {
    case "save_strategy":
      return {
        ...state,
        strategySaved: true,
        phase: "scouting",
        activity: [{ id: "strategy", label: "Lead Strategy saved", detail: "Source Scout queued automatically.", status: "complete" }],
      };
    case "complete_source_scout":
      if (!state.strategySaved) return state;
      return {
        ...state,
        phase: "awaiting_approval",
        sourceCandidates: demoSourceCandidates,
        activity: [
          { id: "scout", label: "Source Scout completed", detail: "3 representative sources proposed for one-time review.", status: "complete" },
          ...state.activity,
        ],
      };
    case "review_source": {
      if (state.phase !== "awaiting_approval") return state;
      const source = state.sourceCandidates.find((candidate) => candidate.id === action.sourceId);
      if (!source || source.status !== "proposed") return state;
      const sourceCandidates = state.sourceCandidates.map((candidate) =>
        candidate.id === action.sourceId ? { ...candidate, status: action.decision } : candidate,
      );
      const approved = action.decision === "approved";
      return {
        ...state,
        sourceCandidates,
        automationEnabled: state.automationEnabled || approved,
        phase: approved ? "automating" : "awaiting_approval",
        activity: [
          {
            id: `review-${source.id}`,
            label: `${source.name} ${approved ? "approved" : "rejected"}`,
            detail: approved ? "Weekday monitoring enabled; the first cycle was queued automatically." : "The unchanged proposal will be suppressed.",
            status: "complete",
          },
          ...state.activity,
        ],
      };
    }
    case "complete_automation":
      if (!state.automationEnabled) return state;
      return {
        ...state,
        phase: "completed",
        opportunities: demoQualifiedOpportunities,
        cycles: [{
          id: action.cycleId,
          completedAt: action.completedAt,
          acceptedSignals: 8,
          opportunitiesCreated: demoQualifiedOpportunities.length,
          opportunitiesMatched: 0,
          assessmentsCompleted: 6,
          researchFindings: 4,
          leadsQualified: 2,
          exceptionsCreated: 1,
          durationMs: action.durationMs ?? 4_200,
        }, ...state.cycles],
        activity: [
          { id: `route-${action.cycleId}`, label: "Qualification completed", detail: "2 leads qualified automatically; 1 ambiguity routed to Needs attention.", status: "attention" },
          { id: `research-${action.cycleId}`, label: "Material gaps researched", detail: "4 findings added; unsupported answers remained unknown.", status: "complete" },
          { id: `assess-${action.cycleId}`, label: "Assessments completed", detail: "First and final evidence snapshots scored deterministically.", status: "complete" },
          { id: `monitor-${action.cycleId}`, label: "Approved source monitored", detail: "8 cited signals normalized and exactly resolved.", status: "complete" },
          ...state.activity,
        ],
      };
    case "complete_repeat_cycle":
      if (state.phase !== "completed") return state;
      return {
        ...state,
        cycles: [{
          id: action.cycleId,
          completedAt: action.completedAt,
          acceptedSignals: 8,
          opportunitiesCreated: 0,
          opportunitiesMatched: demoQualifiedOpportunities.length,
          assessmentsCompleted: 0,
          researchFindings: 0,
          leadsQualified: 0,
          exceptionsCreated: 0,
          durationMs: action.durationMs ?? 1_300,
        }, ...state.cycles],
        activity: [
          { id: `repeat-${action.cycleId}`, label: "Weekday monitoring repeated", detail: "All 8 signals and 3 opportunities matched existing records; no duplicates created.", status: "complete" },
          ...state.activity,
        ],
      };
    case "review_lead": {
      const opportunity = state.opportunities.find((item) => item.id === action.opportunityId);
      if (!opportunity?.lead) return state;
      const nextStatus = action.decision === "pursue"
        ? "approved"
        : action.decision === "pass" ? "rejected" : opportunity.lead.status;
      const nextRoute = action.decision === "route_changed" && action.route ? action.route : opportunity.route;
      return {
        ...state,
        opportunities: state.opportunities.map((item) => item.id === action.opportunityId ? {
          ...item,
          route: nextRoute,
          lead: item.lead ? {
            ...item.lead,
            status: nextStatus,
            route: nextRoute,
            pendingResearch: action.decision === "request_research",
          } : null,
          reviewHistory: [{
            id: `demo-review-${action.reviewedAt}`,
            decision: action.decision,
            reasonCode: action.reasonCode ?? null,
            notes: action.notes ?? null,
            createdAt: action.reviewedAt,
            reviewerId: "demo-reviewer",
            changes: { simulated: true, route: nextRoute },
          }, ...(item.reviewHistory ?? [])],
        } : item),
        activity: [{
          id: `demo-review-${action.reviewedAt}`,
          label: `Lead review simulated: ${action.decision.replaceAll("_", " ")}`,
          detail: "Stored only in this browser session; no outreach or backend mutation occurred.",
          status: "complete",
        }, ...state.activity],
      };
    }
    case "reset":
      return createInitialDemoWorkflowState();
  }
}

export function parseDemoWorkflowState(value: string | null): DemoWorkflowState {
  if (!value) return createInitialDemoWorkflowState();
  try {
    const parsed = JSON.parse(value) as Partial<DemoWorkflowState>;
    if (
      parsed.version !== 2
      || typeof parsed.strategySaved !== "boolean"
      || typeof parsed.automationEnabled !== "boolean"
      || !Array.isArray(parsed.sourceCandidates)
      || !Array.isArray(parsed.opportunities)
      || !Array.isArray(parsed.cycles)
      || !Array.isArray(parsed.activity)
      || !["empty", "scouting", "awaiting_approval", "automating", "completed"].includes(parsed.phase ?? "")
    ) return createInitialDemoWorkflowState();
    return parsed as DemoWorkflowState;
  } catch {
    return createInitialDemoWorkflowState();
  }
}
