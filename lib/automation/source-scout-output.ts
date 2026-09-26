import {
  sourceProposalSchema,
  sourceScoutOutputSchema,
  type SourceProposal,
  type SourceScoutOutput,
  type SourceScoutWireOutput,
} from "@/lib/automation/contracts";

export interface SourceScoutContractIssue {
  path: string;
  code: string;
  disposition: "normalized" | "rejected";
}

export interface NormalizedSourceScoutResult {
  output: SourceScoutOutput | null;
  generatedCount: number;
  rejectedCount: number;
  issues: SourceScoutContractIssue[];
}

function boundedText(value: string, max: number, path: string, issues: SourceScoutContractIssue[]): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  issues.push({ path, code: "text_truncated", disposition: "normalized" });
  return trimmed.slice(0, max).trimEnd();
}

function nullableText(
  value: string | null,
  max: number,
  path: string,
  issues: SourceScoutContractIssue[],
): string | null {
  if (value === null) return null;
  const normalized = boundedText(value, max, path, issues);
  return normalized || null;
}

function uniqueBoundedValues(
  values: string[],
  maxItems: number,
  maxLength: number,
  path: string,
  issues: SourceScoutContractIssue[],
): string[] {
  const normalized = [...new Set(values
    .map((value, index) => boundedText(value, maxLength, `${path}.${index}`, issues))
    .filter(Boolean))];
  if (normalized.length > maxItems) {
    issues.push({ path, code: "items_truncated", disposition: "normalized" });
  }
  return normalized.slice(0, maxItems);
}

function normalizeProposal(
  proposal: SourceScoutWireOutput["proposals"][number],
  index: number,
  issues: SourceScoutContractIssue[],
): SourceProposal | null {
  const path = `proposals.${index}`;
  const proposalIssues: SourceScoutContractIssue[] = [];
  const signalAreas = [...new Set(proposal.signalAreas)];
  if (signalAreas.length !== proposal.signalAreas.length) {
    proposalIssues.push({ path: `${path}.signalAreas`, code: "duplicates_removed", disposition: "normalized" });
  }
  if (signalAreas.length > 9) {
    proposalIssues.push({ path: `${path}.signalAreas`, code: "items_truncated", disposition: "normalized" });
  }
  if (proposal.sampleEvidence.length > 2) {
    proposalIssues.push({ path: `${path}.sampleEvidence`, code: "items_truncated", disposition: "normalized" });
  }

  const candidate = {
    name: boundedText(proposal.name, 180, `${path}.name`, proposalIssues),
    sourceFamily: boundedText(proposal.sourceFamily, 80, `${path}.sourceFamily`, proposalIssues),
    jurisdiction: nullableText(proposal.jurisdiction, 80, `${path}.jurisdiction`, proposalIssues),
    baseUrl: proposal.baseUrl.trim(),
    classification: proposal.classification,
    publicAccess: proposal.publicAccess,
    observedUpdateFrequency: nullableText(
      proposal.observedUpdateFrequency,
      120,
      `${path}.observedUpdateFrequency`,
      proposalIssues,
    ),
    signalAreas: signalAreas.slice(0, 9),
    coverageGap: proposal.coverageGap,
    noveltyReason: boundedText(proposal.noveltyReason, 300, `${path}.noveltyReason`, proposalIssues),
    coverageRationale: boundedText(proposal.coverageRationale, 300, `${path}.coverageRationale`, proposalIssues),
    sampleEvidence: proposal.sampleEvidence.slice(0, 2).map((item, evidenceIndex) => ({
      title: boundedText(item.title, 180, `${path}.sampleEvidence.${evidenceIndex}.title`, proposalIssues),
      url: item.url.trim(),
      relevance: boundedText(item.relevance, 300, `${path}.sampleEvidence.${evidenceIndex}.relevance`, proposalIssues),
    })),
    policyChecks: {
      ...proposal.policyChecks,
      note: boundedText(proposal.policyChecks.note, 250, `${path}.policyChecks.note`, proposalIssues),
    },
    confidence: proposal.confidence,
    estimatedMonthlyCostEur: proposal.estimatedMonthlyCostEur,
  };
  const parsed = sourceProposalSchema.safeParse(candidate);
  if (!parsed.success) {
    issues.push(...proposalIssues);
    issues.push(...parsed.error.issues.map((issue) => ({
      path: [path, ...issue.path.map(String)].join("."),
      code: issue.code,
      disposition: "rejected" as const,
    })));
    return null;
  }
  issues.push(...proposalIssues);
  return parsed.data;
}

export function normalizeSourceScoutOutput(
  wireOutput: SourceScoutWireOutput,
  observedSearchQueries: string[] = [],
): NormalizedSourceScoutResult {
  const issues: SourceScoutContractIssue[] = [];
  const searchQueries = uniqueBoundedValues(
    [...observedSearchQueries, ...wireOutput.searchQueries],
    12,
    300,
    "searchQueries",
    issues,
  );
  const proposals: SourceProposal[] = [];
  let rejectedCount = 0;

  wireOutput.proposals.forEach((proposal, index) => {
    const normalized = normalizeProposal(proposal, index, issues);
    if (!normalized) {
      rejectedCount += 1;
      return;
    }
    if (proposals.length >= 5) {
      rejectedCount += 1;
      issues.push({ path: `proposals.${index}`, code: "too_many_items", disposition: "rejected" });
      return;
    }
    proposals.push(normalized);
  });

  const output = sourceScoutOutputSchema.safeParse({ searchQueries, proposals });
  if (!output.success) {
    issues.push(...output.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      code: issue.code,
      disposition: "rejected" as const,
    })));
    return { output: null, generatedCount: wireOutput.proposals.length, rejectedCount, issues };
  }
  if (wireOutput.proposals.length > 0 && output.data.proposals.length === 0) {
    return { output: null, generatedCount: wireOutput.proposals.length, rejectedCount, issues };
  }
  return { output: output.data, generatedCount: wireOutput.proposals.length, rejectedCount, issues };
}

export function summarizeSourceScoutContractIssues(issues: SourceScoutContractIssue[]): string {
  const rejected = issues.filter((issue) => issue.disposition === "rejected");
  const selected = (rejected.length > 0 ? rejected : issues).slice(0, 4);
  return selected.map((issue) => `${issue.path || "output"}:${issue.code}`).join(", ") || "unknown_contract_mismatch";
}
