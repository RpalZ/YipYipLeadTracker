import type {
  DiscoveryHealth,
  DiscoveryRunHealthInput,
  HealthEvaluation,
} from "@/lib/discovery/contracts";

const POLICY_VERSION = "discovery-health-v1" as const;

export function evaluateDiscoveryHealth({
  enabled,
  currentHealth,
  recentRuns,
}: {
  enabled: boolean;
  currentHealth: DiscoveryHealth;
  recentRuns: DiscoveryRunHealthInput[];
}): HealthEvaluation {
  const latest = recentRuns[0];
  const lastFive = recentRuns.slice(0, 5);
  const recentFailureCount = lastFive.filter((run) => run.status === "failed").length;
  const recentFailureRate = lastFive.length ? recentFailureCount / lastFive.length : 0;
  const consecutiveFailures = recentRuns.findIndex((run) => run.status !== "failed");
  const normalizedFailures = consecutiveFailures === -1 ? recentRuns.length : consecutiveFailures;
  const consecutiveSuccesses = recentRuns.findIndex((run) => run.status !== "succeeded");
  const normalizedSuccesses = consecutiveSuccesses === -1 ? recentRuns.length : consecutiveSuccesses;
  const latestAcceptanceRate = latest?.candidateCount
    ? latest.acceptedCount / latest.candidateCount
    : latest?.status === "succeeded" ? 1 : 0;

  const metrics = {
    recentRunCount: lastFive.length,
    recentFailureCount,
    recentFailureRate,
    consecutiveFailures: normalizedFailures,
    consecutiveSuccesses: normalizedSuccesses,
    latestAcceptanceRate,
  };
  const result = (health: DiscoveryHealth, reason: string): HealthEvaluation => ({
    health,
    reason,
    policyVersion: POLICY_VERSION,
    metrics,
  });

  if (!enabled) return result("paused", "source_or_job_disabled");
  if (!latest) return result("degraded", "awaiting_first_run");
  if (latest.authenticationOrAccessFailure) return result("failing", "authentication_or_access_failure");
  if (normalizedFailures >= 4) return result("failing", "four_consecutive_failures");
  if (currentHealth === "failing" && normalizedSuccesses < 3) {
    return result("degraded", "recovering_after_failure");
  }
  if (latest.status === "partial" || latest.stopReason === "time_limit" || latest.stopReason === "cost_limit") {
    return result("degraded", "latest_run_stopped_partially");
  }
  if (recentFailureCount >= 2) return result("degraded", "two_failures_in_last_five");
  if (latest.candidateCount > 0 && latestAcceptanceRate < 0.8) {
    return result("degraded", "citation_validation_acceptance_below_80_percent");
  }
  if (currentHealth === "failing" && normalizedSuccesses >= 3) {
    return result("healthy", "recovered_after_three_consecutive_successes");
  }
  if (latest.status === "failed") return result("degraded", "latest_run_failed");
  if (recentFailureRate >= 0.2) return result("degraded", "recent_failure_rate_not_below_20_percent");
  return result("healthy", "latest_run_valid_and_recent_failure_rate_below_20_percent");
}
