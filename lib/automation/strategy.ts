import type { SourceProposal } from "@/lib/automation/contracts";

export interface LeadStrategyInput {
  workspaceId: string;
  name: string;
  description: string;
  signalAreas: string[];
  sectors: string[];
  organizationTypes: string[];
  regions: string[];
  languages: string[];
  projectTypes: string[];
  services: string[];
  impactThemes: string[];
  keywords: string[];
  exclusions: string[];
  projectClues: string[];
  minimumProjectBudgetEur: number;
  preferredBudgetMinEur: number;
  preferredBudgetMaxEur: number;
  largeProjectReviewEur: number;
  lookbackDays: number;
  resultLimit: number;
  runCostLimit: number;
  dailyCostLimit: number;
  timezone: string;
  monitorHour: number;
}

export const defaultLeadStrategy = (workspaceId = "demo"): LeadStrategyInput => ({
  workspaceId,
  name: "Dutch agency opportunities",
  description: "Find early, evidence-backed digital work where YipYip can still shape the brief.",
  signalAreas: ["pitching", "newsletters", "strategy", "hiring", "announcements"],
  sectors: ["public services", "culture", "health", "education"],
  organizationTypes: ["municipality", "public body", "foundation", "social enterprise"],
  regions: ["Netherlands"],
  languages: ["nl", "en"],
  projectTypes: ["websites", "digital products", "platforms", "apps", "redesigns", "campaigns"],
  services: ["strategy", "service design", "product design", "software delivery"],
  impactThemes: ["accessibility", "public value", "inclusion"],
  keywords: ["digital strategy", "platform", "redesign", "service journey", "agency review"],
  exclusions: ["completed", "awarded", "closed pitch", "unrelated vacancy"],
  projectClues: ["approved roadmap", "new programme", "supplier exploration", "funding award"],
  minimumProjectBudgetEur: 30_000,
  preferredBudgetMinEur: 50_000,
  preferredBudgetMaxEur: 100_000,
  largeProjectReviewEur: 250_000,
  lookbackDays: 90,
  resultLimit: 5,
  runCostLimit: 0.5,
  dailyCostLimit: 2.5,
  timezone: "Europe/Amsterdam",
  monitorHour: 7,
});

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort();
}

export function buildSearchPlanSnapshot(strategy: LeadStrategyInput, version: number) {
  return {
    version,
    generatedFrom: "lead_strategy",
    region: normalizeList(strategy.regions),
    languages: normalizeList(strategy.languages),
    signalAreas: normalizeList(strategy.signalAreas),
    projectTypes: normalizeList(strategy.projectTypes),
    services: normalizeList(strategy.services),
    positiveTerms: normalizeList([...strategy.keywords, ...strategy.projectClues]),
    exclusions: normalizeList(strategy.exclusions),
    commercialFit: {
      minimumProjectBudgetEur: Math.max(0, strategy.minimumProjectBudgetEur),
      preferredBudgetMinEur: Math.max(strategy.minimumProjectBudgetEur, strategy.preferredBudgetMinEur),
      preferredBudgetMaxEur: Math.max(strategy.preferredBudgetMinEur, strategy.preferredBudgetMaxEur),
      largeProjectReviewEur: Math.max(strategy.preferredBudgetMaxEur, strategy.largeProjectReviewEur),
    },
    limits: {
      lookbackDays: Math.max(1, Math.min(365, strategy.lookbackDays)),
      resultLimit: Math.max(1, Math.min(25, strategy.resultLimit)),
      runCostLimitEur: Math.max(0, strategy.runCostLimit),
      dailyCostLimitEur: Math.max(0, strategy.dailyCostLimit),
    },
  } as const;
}

export function sourceSuppressionFingerprint(proposal: SourceProposal): string {
  const url = new URL(proposal.baseUrl);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const details = [
    proposal.classification,
    proposal.publicAccess ? "public" : "restricted",
    proposal.policyChecks.robotsConcern ? "robots" : "robots-ok",
    proposal.policyChecks.termsConcern ? "terms" : "terms-ok",
    ...proposal.sampleEvidence.map((sample) => new URL(sample.url).pathname.toLowerCase()).sort(),
  ].join(":");
  return `${host}:${proposal.sourceFamily.trim().toLowerCase().replace(/\s+/g, "-")}:${details}`;
}

export function evaluateSourceReputation(proposal: SourceProposal) {
  const primary = proposal.classification === "primary" ? 0.25 : proposal.classification === "secondary" ? 0.16 : 0.08;
  const evidence = Math.min(0.25, proposal.sampleEvidence.length * 0.08);
  const access = proposal.publicAccess ? 0.18 : 0;
  const policy = proposal.policyChecks.robotsConcern || proposal.policyChecks.termsConcern
    ? 0
    : proposal.policyChecks.personalDataRisk === "low" ? 0.17 : 0.08;
  const confidence = proposal.confidence * 0.15;
  const score = Math.round(Math.min(1, primary + evidence + access + policy + confidence) * 100) / 100;
  return {
    score,
    reviewable: proposal.publicAccess && !proposal.policyChecks.robotsConcern && !proposal.policyChecks.termsConcern && score >= 0.65,
    reasons: [
      `${proposal.classification} source`,
      `${proposal.sampleEvidence.length} relevant sample${proposal.sampleEvidence.length === 1 ? "" : "s"}`,
      proposal.publicAccess ? "publicly accessible" : "access is not public",
      proposal.policyChecks.robotsConcern || proposal.policyChecks.termsConcern ? "policy concern requires resolution" : "no declared access concern",
    ],
  };
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

function localTimeToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const desired = Date.UTC(year, month - 1, day, hour, 0, 0);
  let guess = desired;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = zonedParts(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    guess += desired - observedAsUtc;
  }
  return new Date(guess);
}

export function nextWeekdayRun(from: Date, hour = 7, timeZone = "Europe/Amsterdam"): Date {
  const local = zonedParts(from, timeZone);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day));
  for (let offset = 0; offset < 8; offset += 1) {
    const candidateDate = new Date(date);
    candidateDate.setUTCDate(date.getUTCDate() + offset);
    const weekday = candidateDate.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const candidate = localTimeToUtc(candidateDate.getUTCFullYear(), candidateDate.getUTCMonth() + 1, candidateDate.getUTCDate(), hour, timeZone);
    if (candidate > from) return candidate;
  }
  throw new Error("Could not calculate the next weekday run.");
}
