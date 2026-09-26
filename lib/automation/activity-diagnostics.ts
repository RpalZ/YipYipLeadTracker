import type { DiscoveryActivityDiagnostics } from "@/lib/domain";

export interface DiscoveryStageSnapshot {
  stage: string;
  status: string;
  output_snapshot: unknown;
  usage: unknown;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function resultCounts(value: unknown): { accepted: number; rejected: number } {
  if (!Array.isArray(value)) return { accepted: 0, rejected: 0 };
  return value.reduce((counts, item) => {
    const accepted = record(item).accepted;
    if (accepted === true) counts.accepted += 1;
    if (accepted === false) counts.rejected += 1;
    return counts;
  }, { accepted: 0, rejected: 0 });
}

/**
 * Turns the persisted monitor/normalizer/resolver snapshots into one operator-
 * readable summary. Keep this deterministic: the UI must explain an empty run
 * from stored telemetry and must never ask an agent to reinterpret the result.
 */
export function summarizeDiscoveryActivity(stages: DiscoveryStageSnapshot[]): DiscoveryActivityDiagnostics {
  const monitor = stages.find((stage) => stage.stage === "source_monitor");
  const normalization = stages.find((stage) => stage.stage === "normalize");
  const resolution = stages.find((stage) => stage.stage === "resolve");
  const monitorOutput = record(monitor?.output_snapshot);
  const agentOutput = record(monitorOutput.output);
  const normalizationOutput = record(normalization?.output_snapshot);
  const resolutionOutput = record(resolution?.output_snapshot);
  const usage = record(monitor?.usage);
  const candidates = Array.isArray(agentOutput.candidates) ? agentOutput.candidates : [];
  const results = resultCounts(normalizationOutput.results);
  const generatedCandidates = numberValue(monitorOutput.candidateCount)
    || numberValue(normalizationOutput.generatedCount)
    || candidates.length;
  const rawRejectionCounts = record(normalizationOutput.rejectionCounts);

  return {
    generatedCandidates,
    acceptedCandidates: numberValue(normalizationOutput.acceptedCount) || results.accepted,
    rejectedCandidates: numberValue(normalizationOutput.rejectedCount) || results.rejected,
    programmeSignals: numberValue(resolutionOutput.programmeSignalCount),
    opportunitiesCreatedOrMatched: numberValue(resolutionOutput.opportunityCount),
    searchCalls: numberValue(usage.webSearchCallCount),
    consultedUrls: Array.isArray(usage.consultedUrls) ? usage.consultedUrls.length : 0,
    rejectionCounts: Object.fromEntries(Object.entries(rawRejectionCounts)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number")),
    zeroResultReason: typeof monitorOutput.zeroResultReason === "string"
      ? monitorOutput.zeroResultReason
      : typeof agentOutput.zeroResultReason === "string"
        ? agentOutput.zeroResultReason
        : generatedCandidates === 0 && monitor?.status === "succeeded"
          ? "The monitor searched successfully but returned no current concrete project signal."
          : null,
  };
}
