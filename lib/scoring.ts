import type { DimensionName } from "@/lib/domain";

export interface DimensionInput {
  name: DimensionName;
  score: number;
  confidence: number;
}

export interface ScoringPolicy {
  version: string;
  weights: Record<DimensionName, number>;
  firstThreshold: number;
  finalThreshold: number;
  reviewBand: [number, number];
  confidenceFloor: number;
  minimumDimensionScore: Partial<Record<DimensionName, number>>;
  minimumDimensionConfidence: Partial<Record<DimensionName, number>>;
  commercial: CommercialThresholds;
}

export interface CommercialThresholds {
  minimumProjectBudgetEur: number;
  preferredBudgetMinEur: number;
  preferredBudgetMaxEur: number;
  largeProjectReviewEur: number;
}

export type CommercialEvidenceStatus = "confirmed" | "proxy" | "unknown" | "conflicting";
export type AddressableScopeStatus = "bounded" | "unbounded" | "unknown";

export interface CommercialFitInput {
  budgetEvidenceStatus: CommercialEvidenceStatus;
  totalProjectValueEur: number | null;
  addressableScopeValueEur: number | null;
  addressableScopeStatus: AddressableScopeStatus;
  confidence: number;
  evidenceRefs: string[];
  explanation: string;
}

export interface ScoreResult {
  score: number;
  confidence: number;
  decision: "reject" | "research" | "review" | "qualify";
  hardExclusion?: string;
}

export const initialPolicy: ScoringPolicy = {
  version: "2026-09-24.2",
  weights: {
    "Social impact": 0.12,
    "Technical fit": 0.16,
    "Budget fit": 0.16,
    "Timing fit": 0.13,
    Availability: 0.1,
    "Delivery fit": 0.16,
    "Commercial access": 0.1,
    "Evidence confidence": 0.07,
  },
  firstThreshold: 58,
  finalThreshold: 72,
  reviewBand: [66, 76],
  confidenceFloor: 0.62,
  minimumDimensionScore: { "Budget fit": 6, "Delivery fit": 6 },
  minimumDimensionConfidence: { "Budget fit": 0.65, "Delivery fit": 0.65 },
  commercial: {
    minimumProjectBudgetEur: 30_000,
    preferredBudgetMinEur: 50_000,
    preferredBudgetMaxEur: 100_000,
    largeProjectReviewEur: 250_000,
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function interpolate(value: number, from: number, to: number, start: number, end: number) {
  if (to <= from) return end;
  const progress = clamp((value - from) / (to - from), 0, 1);
  return start + ((end - start) * progress);
}

export function budgetFitScore(
  valueEur: number,
  thresholds: CommercialThresholds = initialPolicy.commercial,
): number {
  if (!Number.isFinite(valueEur) || valueEur < thresholds.minimumProjectBudgetEur) return 0;
  if (valueEur < thresholds.preferredBudgetMinEur) {
    return interpolate(
      valueEur,
      thresholds.minimumProjectBudgetEur,
      thresholds.preferredBudgetMinEur,
      6,
      9,
    );
  }
  if (valueEur <= thresholds.preferredBudgetMaxEur) return 10;
  if (valueEur <= thresholds.largeProjectReviewEur) {
    return interpolate(
      valueEur,
      thresholds.preferredBudgetMaxEur,
      thresholds.largeProjectReviewEur,
      9,
      7,
    );
  }
  return 6;
}

export function applyCommercialBudgetScore(
  dimensions: DimensionInput[],
  commercialFit: CommercialFitInput,
  policy: ScoringPolicy = initialPolicy,
): DimensionInput[] {
  const supportedAmount = commercialFit.addressableScopeValueEur;
  const deterministicCap = supportedAmount !== null
    ? budgetFitScore(supportedAmount, policy.commercial)
    : commercialFit.budgetEvidenceStatus === "proxy"
      ? 6
      : commercialFit.budgetEvidenceStatus === "conflicting"
        ? 2
        : 4;
  return dimensions.map((dimension) => dimension.name === "Budget fit"
    ? { ...dimension, score: Math.min(dimension.score, deterministicCap), confidence: Math.min(dimension.confidence, commercialFit.confidence) }
    : dimension);
}

export function calculateScore(
  dimensions: DimensionInput[],
  policy: ScoringPolicy = initialPolicy,
  hardExclusion?: string,
): ScoreResult {
  if (hardExclusion) {
    return { score: 0, confidence: 1, decision: "reject", hardExclusion };
  }

  const resultByName = new Map(dimensions.map((dimension) => [dimension.name, dimension]));
  const weightedScore = Object.entries(policy.weights).reduce((total, [name, weight]) => {
    const result = resultByName.get(name as DimensionName);
    return total + clamp(result?.score ?? 0, 0, 10) * weight;
  }, 0);
  const confidenceWeight = dimensions.reduce(
    (total, dimension) => total + (policy.weights[dimension.name] ?? 0),
    0,
  );
  const confidence =
    confidenceWeight === 0
      ? 0
      : dimensions.reduce(
          (total, dimension) =>
            total + clamp(dimension.confidence, 0, 1) * (policy.weights[dimension.name] ?? 0),
          0,
        ) / confidenceWeight;
  const score = Math.round(weightedScore * 10);
  const roundedConfidence = Math.round(confidence * 100) / 100;

  if (score < policy.firstThreshold) {
    return { score, confidence: roundedConfidence, decision: "reject" };
  }
  if (score < policy.finalThreshold) {
    return { score, confidence: roundedConfidence, decision: "research" };
  }
  if (
    roundedConfidence < policy.confidenceFloor ||
    (score >= policy.reviewBand[0] && score <= policy.reviewBand[1])
  ) {
    return { score, confidence: roundedConfidence, decision: "review" };
  }
  return { score, confidence: roundedConfidence, decision: "qualify" };
}
