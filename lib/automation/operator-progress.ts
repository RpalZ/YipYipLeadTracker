export interface OperatorStagePresentation {
  label: string;
  description: string;
  usesWebSearch: boolean;
}

export interface OperatorAutomationStatus {
  current: {
    id: string;
    stage: string;
    status: "queued" | "running";
    attempt: number;
    pass: number;
    startedAt: string | null;
    availableAt: string;
    leasedUntil: string | null;
  } | null;
  queuedStages: number;
  readyStages: number;
  lastFailure: {
    workflowId: string;
    stage: string;
    attempt: number;
    errorCode: string | null;
    reason: string;
    failedAt: string;
    retryScheduled: boolean;
    retryAt: string | null;
  } | null;
}

export interface OperatorFailurePresentation {
  headline: string;
  detail: string;
  tone: "retry" | "error";
}

const stagePresentations: Record<string, OperatorStagePresentation> = {
  source_scout: {
    label: "Discovering reputable sources",
    description: "Source Scout is searching the web and checking candidate-source evidence.",
    usesWebSearch: true,
  },
  source_monitor: {
    label: "Searching an approved source",
    description: "The monitor is searching this source for new, relevant opportunity signals.",
    usesWebSearch: true,
  },
  normalize: {
    label: "Validating new signals",
    description: "YipYip is checking citations, dates, restrictions, and duplicate fingerprints.",
    usesWebSearch: false,
  },
  resolve: {
    label: "Matching opportunities",
    description: "YipYip is matching organizations and projects without probabilistic merging.",
    usesWebSearch: false,
  },
  first_assessment: {
    label: "Assessing an opportunity",
    description: "The first assessor is evaluating fit, timing, evidence, and delivery route.",
    usesWebSearch: false,
  },
  gap_analysis: {
    label: "Checking evidence gaps",
    description: "The gap analyst is deciding whether missing information could change the outcome.",
    usesWebSearch: false,
  },
  research: {
    label: "Researching missing information",
    description: "The research agent is searching the web for decision-relevant missing evidence.",
    usesWebSearch: true,
  },
  final_assessment: {
    label: "Reassessing the evidence",
    description: "The final assessor is recalculating the complete evidence-backed result.",
    usesWebSearch: false,
  },
  route: {
    label: "Routing the result",
    description: "YipYip is qualifying, monitoring, rejecting, or escalating the opportunity.",
    usesWebSearch: false,
  },
};

export function getOperatorStagePresentation(stage?: string | null): OperatorStagePresentation {
  if (!stage) {
    return {
      label: "Starting the live worker",
      description: "YipYip is claiming the next durable stage from this workspace.",
      usesWebSearch: false,
    };
  }
  return stagePresentations[stage] ?? {
    label: stage.replaceAll("_", " "),
    description: "YipYip is processing the current durable automation stage.",
    usesWebSearch: false,
  };
}

export function formatOperatorElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatOperatorRetryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function isOutputSchemaMismatch(errorCode: string | null, reason: string): boolean {
  return errorCode === "provider_output_schema"
    || errorCode === "provider_output_contract"
    || /invalid output type.*expected schema|source scout output contract/i.test(reason);
}

export function getOperatorFailurePresentation(
  failure: OperatorAutomationStatus["lastFailure"],
): OperatorFailurePresentation | null {
  if (!failure) return null;
  const cause = isOutputSchemaMismatch(failure.errorCode, failure.reason)
    ? "The agent returned structured data that did not match the required contract. Nothing from that attempt was saved."
    : failure.reason;
  if (failure.retryScheduled) {
    const retryWindow = failure.retryAt
      ? formatOperatorRetryTime(failure.retryAt)
      : "the backoff window";
    return {
      headline: "Attempt failed — retry queued",
      detail: `${cause} The bounded retry is runnable after ${retryWindow}; in local mode, press Process live queue again then.`,
      tone: "retry",
    };
  }
  return {
    headline: "Automation needs attention",
    detail: cause,
    tone: "error",
  };
}
