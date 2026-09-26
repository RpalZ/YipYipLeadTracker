import assert from "node:assert/strict";
import test from "node:test";

import { formatOperatorElapsed, formatOperatorRetryTime, getOperatorFailurePresentation, getOperatorStagePresentation } from "../lib/automation/operator-progress";

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

test("a queued schema retry is presented as recoverable rather than terminal", () => {
  const presentation = getOperatorFailurePresentation({
    workflowId: "workflow-1",
    stage: "source_scout",
    attempt: 1,
    errorCode: "stage_error",
    reason: "Invalid output type: final assistant output did not match the expected schema.",
    failedAt: "2026-09-25T03:25:57.000Z",
    retryScheduled: true,
    retryAt: "2026-09-25T03:27:57.000Z",
  });
  assert.equal(presentation?.headline, "Attempt failed — retry queued");
  assert.equal(presentation?.tone, "retry");
  assert.match(presentation?.detail ?? "", /Nothing from that attempt was saved/i);
  assert.doesNotMatch(presentation?.detail ?? "", /Invalid output type/i);
});

test("a terminal Source Scout contract failure remains explicit without exposing output", () => {
  const presentation = getOperatorFailurePresentation({
    workflowId: "workflow-2",
    stage: "source_scout",
    attempt: 2,
    errorCode: "provider_output_contract",
    reason: "Source Scout output contract could not produce a safe result (proposals.0.confidence:too_big).",
    failedAt: "2026-09-25T11:46:28.401Z",
    retryScheduled: false,
    retryAt: null,
  });
  assert.equal(presentation?.headline, "Automation needs attention");
  assert.equal(presentation?.tone, "error");
  assert.match(presentation?.detail ?? "", /Nothing from that attempt was saved/i);
  assert.doesNotMatch(presentation?.detail ?? "", /proposals\.0/i);
});
