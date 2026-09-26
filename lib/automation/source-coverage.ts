import type { SourceProposal, SourceSignalArea } from "@/lib/automation/contracts";
import { sourceSignalAreas } from "@/lib/automation/contracts";

export const SOURCE_COVERAGE_POLICY_VERSION = "source-coverage-v1";
export const SOURCE_SCOUT_PROPOSAL_LIMIT = 5;
export const SOURCE_SCOUT_MAX_PER_GAP = 2;
export const SOURCE_SCOUT_MAX_PER_FAMILY = 2;

export type SourceCoverageStatus = "approved" | "proposed" | "in_review" | "rejected";

export interface SourceCoverageRecord {
  name: string;
  baseUrl: string;
  sourceFamily: string;
  signalAreas: string[];
  status: SourceCoverageStatus;
}

export interface SourceCoverageContext {
  policyVersion: typeof SOURCE_COVERAGE_POLICY_VERSION;
  targetProposalCount: number;
  strategyAreas: SourceSignalArea[];
  coverageCounts: Record<SourceSignalArea, number>;
  uncoveredAreas: SourceSignalArea[];
  priorityAreas: SourceSignalArea[];
  existingSources: Array<{
    name: string;
    domain: string;
    sourceFamily: string;
    signalAreas: SourceSignalArea[];
    status: Exclude<SourceCoverageStatus, "rejected">;
  }>;
  rejectedDomains: string[];
}

export type SourceProposalRejectionCode =
  | "existing_domain"
  | "duplicate_domain"
  | "outside_strategy"
  | "coverage_concentration"
  | "family_concentration"
  | "proposal_limit";

export interface SourceProposalSelection {
  accepted: SourceProposal[];
  rejected: Array<{ proposal: SourceProposal; code: SourceProposalRejectionCode }>;
  rejectionCounts: Partial<Record<SourceProposalRejectionCode, number>>;
}

const signalAreaSet = new Set<string>(sourceSignalAreas);

export function sourceDomain(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizedAreas(values: string[]): SourceSignalArea[] {
  return [...new Set(values
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is SourceSignalArea => signalAreaSet.has(value)))];
}

const statusPriority: Record<SourceCoverageStatus, number> = {
  approved: 4,
  in_review: 3,
  proposed: 2,
  rejected: 1,
};

export function buildSourceCoverageContext(
  strategySignalAreas: string[],
  records: SourceCoverageRecord[],
): SourceCoverageContext {
  const strategyAreas = normalizedAreas(strategySignalAreas);
  const effectiveAreas = strategyAreas.length ? strategyAreas : [...sourceSignalAreas];
  const recordsByDomain = new Map<string, SourceCoverageRecord & { signalAreas: SourceSignalArea[] }>();

  for (const record of records) {
    const domain = sourceDomain(record.baseUrl);
    if (!domain) continue;
    const normalized = { ...record, signalAreas: normalizedAreas(record.signalAreas) };
    const existing = recordsByDomain.get(domain);
    if (!existing || statusPriority[record.status] > statusPriority[existing.status]) {
      recordsByDomain.set(domain, {
        ...normalized,
        signalAreas: [...new Set([...(existing?.signalAreas ?? []), ...normalized.signalAreas])],
      });
      continue;
    }
    if (record.status !== "rejected" && existing.status !== "rejected") {
      recordsByDomain.set(domain, {
        ...existing,
        signalAreas: [...new Set([...existing.signalAreas, ...normalized.signalAreas])],
      });
    }
  }

  const coverageCounts = Object.fromEntries(sourceSignalAreas.map((area) => [area, 0])) as Record<SourceSignalArea, number>;
  const existingSources: SourceCoverageContext["existingSources"] = [];
  const rejectedDomains: string[] = [];
  for (const [domain, record] of recordsByDomain) {
    if (record.status === "rejected") {
      rejectedDomains.push(domain);
      continue;
    }
    for (const area of record.signalAreas) coverageCounts[area] += 1;
    existingSources.push({
      name: record.name,
      domain,
      sourceFamily: record.sourceFamily,
      signalAreas: record.signalAreas,
      status: record.status,
    });
  }

  const priorityAreas = [...effectiveAreas].sort((left, right) => {
    const coverageDifference = coverageCounts[left] - coverageCounts[right];
    return coverageDifference || effectiveAreas.indexOf(left) - effectiveAreas.indexOf(right);
  });

  return {
    policyVersion: SOURCE_COVERAGE_POLICY_VERSION,
    targetProposalCount: SOURCE_SCOUT_PROPOSAL_LIMIT,
    strategyAreas: effectiveAreas,
    coverageCounts,
    uncoveredAreas: priorityAreas.filter((area) => coverageCounts[area] === 0),
    priorityAreas,
    existingSources: existingSources
      .sort((left, right) => left.domain.localeCompare(right.domain))
      .slice(0, 100),
    rejectedDomains: rejectedDomains.sort().slice(0, 100),
  };
}

function normalizedFamily(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function selectDiverseSourceProposals(
  proposals: SourceProposal[],
  context: SourceCoverageContext,
): SourceProposalSelection {
  const existingDomains = new Set(context.existingSources.map((source) => source.domain));
  const seenDomains = new Set<string>();
  const areaCounts = new Map<SourceSignalArea, number>();
  const familyCounts = new Map<string, number>();
  const accepted: SourceProposal[] = [];
  const rejected: SourceProposalSelection["rejected"] = [];
  const priorityIndex = new Map(context.priorityAreas.map((area, index) => [area, index]));
  const ranked = proposals.map((proposal, index) => ({ proposal, index })).sort((left, right) => {
    const gapDifference = (priorityIndex.get(left.proposal.coverageGap) ?? Number.MAX_SAFE_INTEGER)
      - (priorityIndex.get(right.proposal.coverageGap) ?? Number.MAX_SAFE_INTEGER);
    return gapDifference || right.proposal.confidence - left.proposal.confidence || left.index - right.index;
  });

  const reject = (proposal: SourceProposal, code: SourceProposalRejectionCode) => {
    rejected.push({ proposal, code });
  };

  for (const { proposal } of ranked) {
    const domain = sourceDomain(proposal.baseUrl);
    if (domain && existingDomains.has(domain)) {
      reject(proposal, "existing_domain");
      continue;
    }
    if (domain && seenDomains.has(domain)) {
      reject(proposal, "duplicate_domain");
      continue;
    }
    if (!context.strategyAreas.includes(proposal.coverageGap)) {
      reject(proposal, "outside_strategy");
      continue;
    }
    if ((areaCounts.get(proposal.coverageGap) ?? 0) >= SOURCE_SCOUT_MAX_PER_GAP) {
      reject(proposal, "coverage_concentration");
      continue;
    }
    const family = normalizedFamily(proposal.sourceFamily);
    if ((familyCounts.get(family) ?? 0) >= SOURCE_SCOUT_MAX_PER_FAMILY) {
      reject(proposal, "family_concentration");
      continue;
    }
    if (accepted.length >= context.targetProposalCount) {
      reject(proposal, "proposal_limit");
      continue;
    }
    accepted.push(proposal);
    if (domain) seenDomains.add(domain);
    areaCounts.set(proposal.coverageGap, (areaCounts.get(proposal.coverageGap) ?? 0) + 1);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  }

  return {
    accepted,
    rejected,
    rejectionCounts: rejected.reduce<SourceProposalSelection["rejectionCounts"]>((counts, item) => ({
      ...counts,
      [item.code]: (counts[item.code] ?? 0) + 1,
    }), {}),
  };
}
