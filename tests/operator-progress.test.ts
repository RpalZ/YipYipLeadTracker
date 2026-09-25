import assert from "node:assert/strict";
import test from "node:test";

import { formatOperatorElapsed, formatOperatorRetryTime, getOperatorStagePresentation } from "../lib/automation/operator-progress";

test("operator stage presentation distinguishes live web-search stages", () => {
  assert.equal(getOperatorStagePresentation("source_scout").usesWebSearch, true);
  assert.equal(getOperatorStagePresentation("source_monitor").usesWebSearch, true);
  assert.equal(getOperatorStagePresentation("research").usesWebSearch, true);
  assert.equal(getOperatorStagePresentation("normalize").usesWebSearch, false);
  assert.match(getOperatorStagePresentation("gap_analysis").description, /missing information/i);
});

test("operator stage presentation remains readable for a future stage", () => {
  assert.equal(getOperatorStagePresentation("future_stage").label, "future stage");
  assert.equal(getOperatorStagePresentation().label, "Starting the live worker");
});

test("operator elapsed time is stable and never negative", () => {
  assert.equal(formatOperatorElapsed(-12), "0:00");
  assert.equal(formatOperatorElapsed(9.8), "0:09");
  assert.equal(formatOperatorElapsed(125), "2:05");
});

test("operator retry time is explicit and Amsterdam-local", () => {
  assert.equal(formatOperatorRetryTime("2026-09-24T14:27:31.000Z"), "24 Sept, 16:27");
  assert.equal(formatOperatorRetryTime("not-a-date"), "scheduled");
});
