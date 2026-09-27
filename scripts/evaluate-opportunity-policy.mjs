// Offline retrospective analysis. No provider calls. Writes only with --persist-local.
// Run with Node's --env-file and --import tsx. Supply explicit workspace UUIDs.
import { createClient } from "@supabase/supabase-js";
import { calculateScore } from "../lib/scoring.ts";
import { buildReadinessSnapshot } from "../lib/readiness-snapshot.ts";
import { historicalReadinessInput, historicalReadinessCoverage, readinessApplicability } from "../lib/readiness.ts";

const args = process.argv.slice(2);
const shadow = args.includes("--shadow");
const persist = args.includes("--persist-local");
const workspaceIds = args.filter((arg) => !arg.startsWith("--"));
if (args.some((arg) => arg.startsWith("--") && !["--shadow", "--persist-local"].includes(arg))) throw new Error("Unknown option.");
if (persist && (!shadow || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname))) throw new Error("Persistence requires --shadow and a loopback Supabase URL.");
if (!workspaceIds.length || workspaceIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
  throw new Error("Supply explicit workspace UUIDs; unscoped evaluation is not allowed.");
}
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function read(table, columns, workspaceId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from(table).select(columns)
      .eq("workspace_id", workspaceId).order("id").range(offset, offset + 499);
    if (error) throw new Error(`${table}: ${error.code ?? "query_failed"}`);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
const counts = (values) => values.reduce((out, value) => ({ ...out, [value]: (out[value] ?? 0) + 1 }), {});

for (const workspaceId of workspaceIds) {
  const [opportunities, assessments, policies, stages, findings, workflows, leads] = await Promise.all([
    read("opportunities", "id,title,lifecycle_status", workspaceId),
    read("assessments", "id,opportunity_id,assessment_type,created_at,score_policy_id,dimension_results,overall_score,overall_confidence,decision,qualification_checks,commercial_fit,evidence_snapshot,execution_metadata", workspaceId),
    read("score_policies", "id,version,weights,thresholds", workspaceId),
    read("automation_stage_runs", "id,workflow_run_id,stage,status,output_snapshot", workspaceId),
    read("research_findings", "id,opportunity_id,status,field,value,source_refs,attempt_summary,created_at", workspaceId),
    read("automation_workflow_runs", "id,opportunity_id,status,estimated_cost", workspaceId),
    read("leads", "id,opportunity_id,origin,status", workspaceId),
  ]);
  const policiesById = new Map(policies.map((p) => [p.id, p]));
  const outputs = new Map(stages.filter((s) => s.output_snapshot?.assessmentId)
    .map((s) => [s.output_snapshot.assessmentId, s]));
  const compare = (a) => {
    const stored = policiesById.get(a.score_policy_id);
    const checks = a.qualification_checks?.checks;
    const required = ["sector", "actionability", "commercial", "capability", "fitAxis", "timing", "contact", "capacity", "delivery", "outreach", "score"];
    if (!stored || !Array.isArray(a.dimension_results) || required.some((key) => !checks?.[key])) {
      return { eligible: false, reason: "missing_policy_or_gate_snapshot" };
    }
    const policyA = { version: stored.version, weights: stored.weights, ...stored.thresholds };
    if (!Number.isFinite(policyA.finalThreshold) || !Array.isArray(policyA.reviewBand)) {
      return { eligible: false, reason: "missing_score_thresholds" };
    }
    // Change one variable only: remove the score review band ABOVE the final threshold.
    // All frozen non-score checks, evidence, confidence, and hard rejections stay intact.
    const policyB = { ...policyA, reviewBand: [policyA.reviewBand[0], policyA.finalThreshold - 1] };
    const hard = a.qualification_checks.hardRejection || undefined;
    const scoreA = calculateScore(a.dimension_results, policyA, hard);
    const scoreB = calculateScore(a.dimension_results, policyB, hard);
    const otherBlockers = Object.entries(checks).filter(([key, value]) => key !== "score" && value !== "passed");
    const canQualify = (score) => !hard && score.decision === "qualify" && otherBlockers.length === 0;
    return {
      eligible: true, score: scoreA.score, scoreDecisionA: scoreA.decision, scoreDecisionB: scoreB.decision,
      replayScoreMatches: scoreA.score === Number(a.overall_score),
      qualifiesA: canQualify(scoreA), qualifiesB: canQualify(scoreB),
      blockers: otherBlockers.map(([key, value]) => `${key}:${value}`),
      hardRejection: hard ?? null,
      // Keep historical route separate: old code may have routed the same score differently.
      recordedRoute: outputs.get(a.id)?.output_snapshot?.route?.lifecycleStatus ?? null,
    };
  };
  const rows = await Promise.all(opportunities.map(async (o) => {
    const history = assessments.filter((a) => a.opportunity_id === o.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const final = history.find((a) => a.assessment_type === "final");
    const finalStage = final && outputs.get(final.id);
    const initialStage = finalStage && stages.find((s) => s.workflow_run_id === finalStage.workflow_run_id
      && s.stage === "first_assessment" && s.status === "succeeded");
    const initial = initialStage && assessments.find((a) => a.id === initialStage.output_snapshot?.assessmentId);
    const research = findings.filter((f) => f.opportunity_id === o.id);
    const sources = new Set(research.flatMap((f) => Array.isArray(f.source_refs) ? f.source_refs : []));
    const consulted = new Set(research.flatMap((f) => f.attempt_summary?.consultedUrls ?? []));
    let shadowComparison = null;
    if (shadow && final) {
      // Map structured fields only. Never infer favorable claims from prose or later findings.
      const raw = historicalReadinessInput(finalStage?.output_snapshot?.assessment);
      const mapping = raw ? null : historicalReadinessCoverage(finalStage?.output_snapshot?.assessment, research.filter((f) => f.created_at <= final.created_at));
      const evidence = Array.isArray(final.evidence_snapshot) ? final.evidence_snapshot : [];
      const allowedEvidenceRefs = Array.isArray(final.execution_metadata?.readinessEvidenceRefs) ? final.execution_metadata.readinessEvidenceRefs : [...new Set([
        ...evidence.flatMap((item) => typeof item === "string" ? [item] : [item.id, item.url].filter((ref) => typeof ref === "string")),
        ...research.filter((f) => f.created_at <= final.created_at).flatMap((f) => Array.isArray(f.source_refs) ? f.source_refs : []),
      ])];
      const minimum = policiesById.get(final.score_policy_id)?.thresholds?.commercial?.minimumProjectBudgetEur;
      const snapshot = buildReadinessSnapshot(Number.isFinite(minimum) ? raw : null, {
        allowedEvidenceRefs, minimumBudgetEur: minimum ?? 30000, evaluatedAt: final.created_at,
        hardRejection: final.qualification_checks?.hardRejection || undefined,
      });
      const view = { id: "offline", assessmentId: final.id, createdAt: final.created_at, input: snapshot.input, result: snapshot.result, labels: [] };
      shadowComparison = { result: snapshot.result, applicability: readinessApplicability(view, history[0]?.id),
        coverageGaps: [...(!raw ? ["missing_structured_readiness_input"] : []), ...(!Number.isFinite(minimum) ? ["missing_historical_budget_policy"] : [])],
        fingerprint: snapshot.fingerprint, persisted: persist, mapping };
      if (persist) {
        const { error } = await client.from("conversation_readiness_evaluations").upsert({
          workspace_id: workspaceId, opportunity_id: o.id, assessment_id: final.id,
          policy_version: snapshot.result.policyVersion, input_fingerprint: snapshot.fingerprint,
          input_snapshot: snapshot.input, result: snapshot.result,
          provenance: { source: "offline_structured_replay", context: snapshot.context, mapping, processedAt: new Date().toISOString() },
        }, { onConflict: "assessment_id,input_fingerprint,policy_version", ignoreDuplicates: true });
        if (error) throw new Error(`shadow persistence: ${error.code}`);
      }
    } else if (shadow) shadowComparison = { result: { status: "not_evaluated" }, coverageGaps: ["no_final_assessment"], persisted: false };
    return {
      id: o.id, title: o.title, currentStatus: o.lifecycle_status,
      ...(shadow ? { shadowComparison } : {}),
      assessmentCount: history.length, finalId: final?.id ?? null,
      finalAt: final?.created_at ?? null,
      comparison: final ? compare(final) : { eligible: false, reason: "no_final_assessment" },
      pairedInitialScore: initial?.overall_score ?? null,
      pairedFinalScore: final?.overall_score ?? null,
      researchCount: research.length, researchStatuses: counts(research.map((f) => f.status)),
      uniqueCitedUrls: sources.size, uniqueConsultedUrls: consulted.size,
      estimatedQualificationCostAllRuns: Number(workflows.filter((w) => w.opportunity_id === o.id)
        .reduce((sum, w) => sum + Number(w.estimated_cost), 0).toFixed(6)),
      leadOrigins: counts(leads.filter((l) => l.opportunity_id === o.id).map((l) => l.origin)),
    };
  }));
  console.log(JSON.stringify({
    workspaceId, capturedAt: new Date().toISOString(),
    methodology: "Latest final per opportunity; frozen historic evidence/gates; B only removes score review band above finalThreshold; not a randomized or human-labeled quality test.",
    totals: { opportunities: opportunities.length, assessments: assessments.length, findings: findings.length, leads: leads.length },
    currentStatuses: counts(opportunities.map((o) => o.lifecycle_status)),
    ...(shadow ? { shadowSummary: { statuses: counts(rows.map((row) => row.shadowComparison.result.status)), coverageGaps: counts(rows.flatMap((row) => row.shadowComparison.coverageGaps)), mode: persist ? "local_shadow_only_persistence" : "read_only", methodology: "Structured historical replay, not fresh research. Current applicability is reported separately; no human ground truth is inferred." } } : {}),
    latestFinalComparison: {
      eligible: rows.filter((r) => r.comparison.eligible).length,
      qualifiesA: rows.filter((r) => r.comparison.qualifiesA).length,
      qualifiesB: rows.filter((r) => r.comparison.qualifiesB).length,
      scoreOnlyChanges: rows.filter((r) => r.comparison.eligible && r.comparison.scoreDecisionA !== r.comparison.scoreDecisionB).length,
      replayScoreMismatches: rows.filter((r) => r.comparison.eligible && !r.comparison.replayScoreMatches).length,
      gateBlockers: counts(rows.flatMap((r) => r.comparison.blockers ?? [])),
    }, rows,
  }, null, 2));
}
