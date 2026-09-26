import assert from "node:assert/strict";
import test from "node:test";

import type { SourceProposal, SourceSignalArea } from "../lib/automation/contracts";
import {
  buildSourceCoverageContext,
  selectDiverseSourceProposals,
  sourceDomain,
} from "../lib/automation/source-coverage";

function proposal(
  name: string,
  domain: string,
  gap: SourceSignalArea,
  family: string = gap,
  confidence = 0.8,
): SourceProposal {
  return {
    name,
    sourceFamily: family,
    jurisdiction: "NL",
    baseUrl: `https://${domain}/`,
    classification: "primary",
    publicAccess: true,
    observedUpdateFrequency: "weekly",
    signalAreas: [gap],
    coverageGap: gap,
    noveltyReason: `Adds ${gap} coverage from ${domain}.`,
    coverageRationale: `Publishes recurring ${gap} signals relevant to YipYip.`,
    sampleEvidence: [{ title: "Relevant signal", url: `https://${domain}/signal`, relevance: "Shows recurring relevant activity." }],
    policyChecks: {
      permittedMethod: "public_web_search",
      robotsConcern: false,
      termsConcern: false,
      personalDataRisk: "low",
      note: "Public pages only.",
    },
    confidence,
    estimatedMonthlyCostEur: 1,
  };
}

test("coverage inventory prioritizes missing strategy areas and deduplicates domains", () => {
  const context = buildSourceCoverageContext(
    ["pitching", "newsletters", "strategy", "hiring", "announcements"],
    [
      { name: "Existing", baseUrl: "https://www.example.nl/path", sourceFamily: "newsroom", signalAreas: ["announcements"], status: "proposed" },
      { name: "Approved duplicate", baseUrl: "https://example.nl/", sourceFamily: "newsroom", signalAreas: ["strategy"], status: "approved" },
      { name: "Rejected", baseUrl: "https://rejected.nl", sourceFamily: "pitch", signalAreas: ["pitching"], status: "rejected" },
    ],
  );

  assert.equal(context.existingSources.length, 1);
  assert.deepEqual(context.existingSources[0].signalAreas.sort(), ["announcements", "strategy"]);
  assert.deepEqual(context.uncoveredAreas, ["pitching", "newsletters", "hiring"]);
  assert.deepEqual(context.rejectedDomains, ["rejected.nl"]);
  assert.equal(context.priorityAreas[0], "pitching");
});

test("proposal selection rejects existing and repeated domains", () => {
  const context = buildSourceCoverageContext(["pitching", "hiring"], [
    { name: "Existing", baseUrl: "https://example.nl", sourceFamily: "pitching", signalAreas: ["pitching"], status: "approved" },
  ]);
  const duplicate = proposal("Duplicate", "new.example", "hiring");
  const result = selectDiverseSourceProposals([
    proposal("Existing again", "www.example.nl", "pitching"),
    duplicate,
    { ...duplicate, name: "Repeated in run" },
  ], context);

  assert.deepEqual(result.accepted.map((item) => item.name), ["Duplicate"]);
  assert.equal(result.rejectionCounts.existing_domain, 1);
  assert.equal(result.rejectionCounts.duplicate_domain, 1);
});

test("proposal selection favors coverage priorities and limits concentration", () => {
  const context = buildSourceCoverageContext(
    ["pitching", "newsletters", "strategy", "hiring", "announcements"],
    [{ name: "Covered", baseUrl: "https://covered.nl", sourceFamily: "newsroom", signalAreas: ["announcements"], status: "approved" }],
  );
  const result = selectDiverseSourceProposals([
    proposal("Pitch one", "pitch-1.nl", "pitching", "procurement"),
    proposal("Pitch two", "pitch-2.nl", "pitching", "procurement"),
    proposal("Pitch three", "pitch-3.nl", "pitching", "procurement"),
    proposal("Newsletter", "newsletter.nl", "newsletters", "newsletter"),
    proposal("Strategy", "strategy.nl", "strategy", "strategy"),
    proposal("Hiring", "hiring.nl", "hiring", "jobs"),
    proposal("Announcement", "announcement.nl", "announcements", "newsroom"),
  ], context);

  assert.equal(result.accepted.length, 5);
  assert.equal(result.accepted.some((item) => item.coverageGap === "newsletters"), true);
  assert.equal(result.accepted.some((item) => item.coverageGap === "strategy"), true);
  assert.equal(result.accepted.some((item) => item.coverageGap === "hiring"), true);
  assert.equal(result.accepted.filter((item) => item.coverageGap === "pitching").length, 2);
  assert.equal(result.rejectionCounts.coverage_concentration, 1);
  assert.equal(result.rejectionCounts.proposal_limit, 1);
});

test("coverage utilities accept only canonicalizable HTTPS domains and configured gaps", () => {
  assert.equal(sourceDomain("http://example.nl"), null);
  assert.equal(sourceDomain("https://www.Example.nl/path"), "example.nl");
  const context = buildSourceCoverageContext(["pitching"], []);
  const result = selectDiverseSourceProposals([proposal("Wrong gap", "other.nl", "hiring")], context);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejectionCounts.outside_strategy, 1);
});
