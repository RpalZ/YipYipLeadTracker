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
  coverageGap: string;
  noveltyReason: string;
  rationale: string;
  publicAccess: boolean;
  updateFrequency: string;
  estimatedMonthlyCost: number;
  sampleEvidence: Array<{ title: string; url: string; relevance: string }>;
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
  | { type: "resolve_attention"; opportunityId: string; action: "request_research" | "pass"; reasonCode: string; notes?: string; resolvedAt: string }
  | { type: "promote_opportunity"; opportunityId: string; reasonCode: string; notes?: string; route: OpportunityView["route"]; language: "nl" | "en"; promotedAt: string }
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
    contactLabel: "Digital participation team via the municipal contact channel",
    contactStatus: "confirmed",
    contactEvidenceUrls: ["https://www.utrecht.nl/"],
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
      scopeBasis: "dedicated_package",
      confidence: 0.86,
      explanation: "The programme is larger, but the cited digital work package is bounded at €90k.",
    },
    lead: {
      id: "demo-lead-utrecht",
      version: 1,
      status: "in_review",
      route: "direct",
      pendingResearch: false,
      origin: "automated",
      promotedAt: null,
      promotionReason: null,
      promotionNotes: null,
      outreachDraft: {
        language: "nl",
        recommendedChannel: "email",
        emailSubject: "Digitale participatie: vroeg meedenken over platformvernieuwing",
        emailBody: "Goedemiddag, de recent vastgestelde participatiestrategie en voorbereiding op platformvernieuwing vielen ons op. YipYip bouwt complexe digitale platforms en back-ends voor publieke dienstverlening. We verkennen graag vroegtijdig waar technische schaal, toegankelijkheid en een soepele overgang het verschil maken. Staat u open voor een kort gesprek over de komende keuzes en de manier waarop externe marktkennis kan helpen?",
        callOpening: "Goedemiddag, ik bel omdat de nieuwe participatiestrategie en voorbereiding op platformvernieuwing ons opvielen. YipYip bouwt complexe publieke platforms. Ik ben benieuwd welke technische en toegankelijkheidskeuzes nu het belangrijkst zijn en of een vroege marktverkenning nuttig is.",
        discoveryQuestions: ["Welke onderdelen vallen binnen de eerste werkpakket?", "Wanneer start de leveranciersverkenning?", "Welke toegankelijkheids- en schaalvereisten zijn doorslaggevend?"],
        evidenceRefs: ["demo-signal-utrecht-strategy", "demo-signal-utrecht-hiring"],
        caveats: ["The current platform contract end date remains unconfirmed."],
      },
    },
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
    contactLabel: "Digital services programme via the official grants contact desk",
    contactStatus: "confirmed",
    contactEvidenceUrls: ["https://fondspodiumkunsten.nl/"],
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
      scopeBasis: "explicit_lot",
      confidence: 0.8,
      explanation: "A primary roadmap appendix bounds the addressable service-design package at €75k.",
    },
    lead: {
      id: "demo-lead-fonds",
      version: 1,
      status: "in_review",
      route: "direct",
      pendingResearch: false,
      origin: "automated",
      promotedAt: null,
      promotionReason: null,
      promotionNotes: null,
      outreachDraft: {
        language: "nl",
        recommendedChannel: "email",
        emailSubject: "Toegankelijke digitale aanvraagreis",
        emailBody: "Goedemiddag, in de digitale roadmap zagen we dat Fonds Podiumkunsten de aanvraagreis en toegankelijkheid verder wil verbeteren. YipYip ontwerpt en bouwt digitale diensten en back-ends waarin complexe processen voor gebruikers overzichtelijk worden. We denken graag vroeg mee over de technische en dienstverleningskeuzes. Is er ruimte voor een korte kennismaking over de komende fase en de beoogde inkooproute?",
        callOpening: "Goedemiddag, ik bel naar aanleiding van de digitale roadmap en de geplande verbetering van de aanvraagreis. YipYip combineert service design met softwarebouw. Ik hoor graag welke keuzes nu worden voorbereid en wanneer externe expertise relevant wordt.",
        discoveryQuestions: ["Welke aanvraagstappen hebben de hoogste prioriteit?", "Welke integraties bepalen de technische scope?", "Wanneer wordt de inkooproute vastgesteld?"],
        evidenceRefs: ["demo-signal-fonds-roadmap"],
        caveats: ["The procurement route is not yet explicit."],
      },
    },
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
    latestAssessmentId: "demo-assessment-brabant",
    latestAssessmentType: "final",
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
      scopeBasis: "unknown",
      confidence: 0.35,
      explanation: "The bounded research pass did not establish an addressable budget.",
    },
    qualificationChecks: {
      policyVersion: "demo-2026-09-25.2",
      allPassed: false,
      hardRejection: null,
      checks: {
        sector: "passed",
        actionability: "passed",
        commercial: "unresolved",
        contact: "unresolved",
        score: "review",
      },
      reasons: ["commercial: unresolved", "contact: unresolved", "score: review"],
      capabilityEvidence: {
        status: "partial",
        matchedServices: ["digital platforms", "APIs and integrations", "back-end systems"],
        unmatchedRequirements: ["Shared multi-agency data governance ownership remains unclear"],
        confidence: 0.72,
        evidenceRefs: ["demo-signal-brabant-roadmap"],
        explanation: "The roadmap supports a platform and integration need, but the accountable delivery boundary is not yet explicit.",
      },
      capacityEvidence: {
        status: "available",
        effectiveUntil: "2026-12-31",
        expired: false,
        score: 10,
        confidence: 1,
      },
    },
    attentionException: {
      id: "demo-exception-brabant",
      kind: "commercial_fit_uncertain",
      summary: "Addressable budget and commissioning ownership remain unresolved after bounded research.",
      status: "open",
      details: { unresolvedFields: ["commercial", "contact"] },
      createdAt: "2026-09-24T05:20:00.000Z",
    },
    qualificationResearchPending: false,
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
    coverageGap: "pitching",
    noveltyReason: "Adds a primary Dutch procurement calendar beyond the owned-announcement sources already monitored.",
    rationale: "Frequent Dutch procurement signals with public, attributable project details.",
    publicAccess: true,
    updateFrequency: "Daily",
    estimatedMonthlyCost: 0.42,
    sampleEvidence: [
      { title: "Digital platform market consultation", url: "https://www.aanbestedingskalender.nl/", relevance: "A current public digital-project signal with an identifiable commissioning organisation." },
      { title: "Public service redesign notice", url: "https://www.aanbestedingskalender.nl/", relevance: "Shows the source regularly exposes service and platform work before award." },
    ],
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
    coverageGap: "strategy",
    noveltyReason: "Adds secondary reporting on municipal policy and programme decisions before formal procurement.",
    rationale: "Early policy, funding, and programme signals from Dutch public organisations.",
    publicAccess: true,
    updateFrequency: "Weekdays",
    estimatedMonthlyCost: 0.31,
    sampleEvidence: [
      { title: "Municipality approves participation strategy", url: "https://www.binnenlandsbestuur.nl/", relevance: "Demonstrates early reporting on a funded public programme before a supplier brief." },
      { title: "Province consolidates data services", url: "https://www.binnenlandsbestuur.nl/", relevance: "Provides corroborating policy and ownership signals for a technical opportunity." },
    ],
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
    coverageGap: "hiring",
    noveltyReason: "Adds first-party roadmap and hiring signals from target organisations rather than another tender index.",
    rationale: "Primary strategy, funding, hiring, and programme announcements from target organisations.",
    publicAccess: true,
    updateFrequency: "Weekly",
    estimatedMonthlyCost: 0.24,
    sampleEvidence: [
      { title: "Digital roadmap publication", url: "https://www.overheid.nl/", relevance: "A first-party planning signal that can establish timing and strategic intent." },
      { title: "Product-owner vacancy", url: "https://www.overheid.nl/", relevance: "A first-party capacity signal that can corroborate an upcoming digital programme." },
    ],
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
        activity: [{ id: `strategy-${state.activity.length + 1}`, label: "Lead Strategy saved", detail: "Source Scout queued automatically.", status: "complete" }, ...state.activity],
      };
    case "complete_source_scout": {
      if (!state.strategySaved) return state;
      const sourceCandidates = demoSourceCandidates.map((candidate) => ({
        ...candidate,
        status: state.sourceCandidates.find((existing) => existing.id === candidate.id)?.status ?? candidate.status,
      }));
      return {
        ...state,
        phase: sourceCandidates.some((candidate) => candidate.status === "proposed")
          ? "awaiting_approval"
          : state.cycles.length ? "completed" : "awaiting_approval",
        sourceCandidates,
        activity: [
          { id: "scout", label: "Source Scout completed", detail: "3 representative sources proposed for one-time review.", status: "complete" },
          ...state.activity,
        ],
      };
    }
    case "review_source": {
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
        phase: approved ? "automating" : state.phase,
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
    case "resolve_attention": {
      const opportunity = state.opportunities.find((item) => item.id === action.opportunityId);
      if (!opportunity || opportunity.lead || !opportunity.attentionException) return state;
      const lifecycleStatus = action.action === "request_research" ? "needs_research" : "rejected";
      return {
        ...state,
        opportunities: state.opportunities.map((item) => item.id === action.opportunityId ? {
          ...item,
          lifecycleStatus,
          attentionException: null,
          qualificationResearchPending: action.action === "request_research",
          reviewHistory: [{
            id: `demo-resolution-${action.resolvedAt}`,
            decision: action.action,
            reasonCode: action.reasonCode,
            notes: action.notes ?? null,
            createdAt: action.resolvedAt,
            reviewerId: "demo-reviewer",
            changes: {
              simulated: true,
              previousLifecycleStatus: item.lifecycleStatus,
              currentLifecycleStatus: lifecycleStatus,
            },
          }, ...(item.reviewHistory ?? [])],
        } : item),
        activity: [{
          id: `demo-resolution-${action.resolvedAt}`,
          label: action.action === "request_research"
            ? "Qualification research requested"
            : "Opportunity passed",
          detail: action.action === "request_research"
            ? "A simulated reassessment starts at First Assessment; no manual Assess click is required."
            : "The simulated Opportunity left Needs attention and remains in decision history.",
          status: "complete",
        }, ...state.activity],
      };
    }
    case "promote_opportunity": {
      const opportunity = state.opportunities.find((item) => item.id === action.opportunityId);
      if (
        !opportunity
        || opportunity.lead
        || !opportunity.evidence.length
        || opportunity.latestAssessmentType !== "final"
        || !opportunity.qualificationChecks?.checks.sector
        || !opportunity.qualificationChecks?.checks.actionability
        || opportunity.qualificationChecks.checks.sector === "rejected"
        || opportunity.qualificationChecks.checks.actionability === "rejected"
      ) return state;
      const primaryEvidence = opportunity.evidence[0];
      const dutch = action.language === "nl";
      return {
        ...state,
        opportunities: state.opportunities.map((item) => item.id === action.opportunityId ? {
          ...item,
          route: action.route,
          reviewCapability: "decide",
          lead: {
            id: `demo-manual-${item.id}`,
            version: 1,
            status: "in_review",
            route: action.route,
            pendingResearch: false,
            origin: "manual_promotion",
            promotedAt: action.promotedAt,
            promotionReason: action.reasonCode,
            promotionNotes: action.notes ?? null,
            outreachDraft: {
              language: action.language,
              recommendedChannel: "email",
              emailSubject: dutch ? `Kennismaking over ${item.title}` : `Exploring ${item.title}`,
              emailBody: dutch
                ? `Goedendag, het signaal rond ${item.title} bij uw organisatie viel ons op. YipYip bouwt maatwerkapplicaties, digitale platforms en complexe back-ends. Hoewel nog niet alle commerciële en operationele details publiek bevestigd zijn, verkennen we graag of onze ervaring aansluit op de komende keuzes. Staat u open voor een kort gesprek over de actuele scope, planning en een passende samenwerkingsvorm?`
                : `Hello, the signal concerning ${item.title} at your organisation caught our attention. YipYip builds custom applications, digital platforms, and complex back-end systems. Although not every commercial and operational detail is publicly confirmed, we would value a short conversation about the current scope, timing, and a suitable way to contribute. Would you be open to an introductory discussion?`,
              callOpening: dutch
                ? `Goedendag, ik bel omdat het signaal rond ${item.title} ons opviel. YipYip bouwt complexe digitale producten en back-ends. Ik ben benieuwd welke keuzes nu spelen en of een korte verkenning zinvol is.`
                : `Hello, I am calling because the signal concerning ${item.title} caught our attention. YipYip builds complex digital products and back-end systems. I would like to understand the choices being made and whether an early conversation would be useful.`,
              discoveryQuestions: dutch
                ? ["Welke digitale scope is nu voorzien?", "Welk budget en tijdpad zijn beschikbaar?", "Wie is verantwoordelijk voor de volgende leveranciersstap?"]
                : ["What digital scope is being considered?", "What budget and timing are available?", "Who owns the next supplier decision?"],
              evidenceRefs: [primaryEvidence.id, primaryEvidence.url],
              caveats: [
                dutch
                  ? "Deze Lead is handmatig gepromoveerd en heeft niet alle automatische kwalificatiepoorten doorlopen."
                  : "This Lead was manually promoted and did not pass every automatic qualification gate.",
              ],
            },
          },
          reviewHistory: [{
            id: `demo-promotion-${item.id}`,
            decision: "manual_promote",
            reasonCode: action.reasonCode,
            notes: action.notes ?? null,
            createdAt: action.promotedAt,
            reviewerId: "demo-reviewer",
            changes: { leadOrigin: "manual_promotion", route: action.route, language: action.language },
          }, ...(item.reviewHistory ?? [])],
        } : item),
        activity: [{
          id: `manual-promotion-${action.opportunityId}`,
          label: "Opportunity manually promoted",
          detail: "Human commercial judgment created a clearly labelled pursuit Lead without changing the automated assessment.",
          status: "attention",
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
