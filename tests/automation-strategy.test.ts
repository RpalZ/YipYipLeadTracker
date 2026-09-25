import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSourceReputation, buildSearchPlanSnapshot, defaultLeadStrategy, nextWeekdayRun, sourceSuppressionFingerprint } from "../lib/automation/strategy";
import type { SourceProposal } from "../lib/automation/contracts";

const proposal: SourceProposal = {
  name: "Example public newsroom",
  sourceFamily: "Announcements",
  jurisdiction: "NL",
  baseUrl: "https://www.example.nl/news/",
  classification: "primary",
  publicAccess: true,
  observedUpdateFrequency: "Weekly",
  signalAreas: ["announcements"],
  coverageRationale: "Publishes early programme and strategy announcements.",
  sampleEvidence: [
    { title: "Digital roadmap", url: "https://example.nl/news/roadmap", relevance: "Names a forthcoming platform programme." },
    { title: "Service redesign", url: "https://example.nl/news/service", relevance: "Signals a funded redesign." },
  ],
  policyChecks: { permittedMethod: "public_web_search", robotsConcern: false, termsConcern: false, personalDataRisk: "low", note: "Public pages." },
  confidence: 0.84,
  estimatedMonthlyCostEur: 1,
};

test("a lead strategy generates a stable internal search plan", () => {
  const strategy = defaultLeadStrategy("workspace-1");
  const snapshot = buildSearchPlanSnapshot({ ...strategy, keywords: ["Platform", "platform", " Roadmap "] }, 3);
  assert.equal(snapshot.version, 3);
  assert.deepEqual(snapshot.positiveTerms.filter((term) => term === "platform"), ["platform"]);
  assert.equal(snapshot.limits.resultLimit, 5);
});

test("source reputation remains deterministic and separate from runtime health", () => {
  const result = evaluateSourceReputation(proposal);
  assert.equal(result.reviewable, true);
  assert.ok(result.score >= 0.65);
  assert.match(sourceSuppressionFingerprint(proposal), /^example\.nl:announcements:primary:public:/);
});

test("policy concerns prevent a candidate from being reviewable", () => {
  const result = evaluateSourceReputation({ ...proposal, policyChecks: { ...proposal.policyChecks, robotsConcern: true } });
  assert.equal(result.reviewable, false);
});

test("weekday schedules skip weekends", () => {
  assert.equal(nextWeekdayRun(new Date("2026-09-25T08:00:00Z"), 7, "UTC").toISOString(), "2026-09-28T07:00:00.000Z");
});

test("Europe/Amsterdam weekday schedules remain at 07:00 through DST changes", () => {
  assert.equal(nextWeekdayRun(new Date("2026-03-27T08:00:00Z"), 7).toISOString(), "2026-03-30T05:00:00.000Z");
  assert.equal(nextWeekdayRun(new Date("2026-10-23T08:00:00Z"), 7).toISOString(), "2026-10-26T06:00:00.000Z");
});
