import assert from "node:assert/strict";
import test from "node:test";

import { automationErrorIsRetryable, describeAutomationError, writeAutomationLog } from "../lib/automation/diagnostics";

test("automation diagnostics classify incomplete provider responses", () => {
  assert.deepEqual(
    describeAutomationError(new Error('OpenAI Responses request ended with unsuccessful terminal state "response.incomplete".')),
    {
      code: "provider_incomplete",
      name: "Error",
      message: 'OpenAI Responses request ended with unsuccessful terminal state "response.incomplete".',
    },
  );
});

test("schema and authentication failures do not waste identical retries", () => {
  const schema = describeAutomationError(new Error("400 Invalid schema for response_format 'output'"));
  const timeout = describeAutomationError(new Error("Request timed out"));
  assert.equal(schema.code, "provider_schema");
  assert.equal(automationErrorIsRetryable(schema), false);
  assert.equal(automationErrorIsRetryable(timeout), true);
});

test("a hosted web-search limit violation is terminal", () => {
  const limit = describeAutomationError(new Error("Researcher exceeded the 3-call hosted web-search limit."));
  assert.equal(limit.code, "tool_limit");
  assert.equal(automationErrorIsRetryable(limit), false);
});

test("model output contract mismatches retry once, then stop", () => {
  const mismatch = describeAutomationError(new Error("Invalid output type: final assistant output did not match the expected schema."));
  assert.equal(mismatch.code, "provider_output_schema");
  assert.equal(automationErrorIsRetryable(mismatch, 1), true);
  assert.equal(automationErrorIsRetryable(mismatch, 2), false);

  const rejected = describeAutomationError(new Error(
    "Source Scout output contract could not produce a safe result (proposals.0.baseUrl:too_big).",
  ));
  assert.equal(rejected.code, "provider_output_contract");
  assert.equal(automationErrorIsRetryable(rejected, 2), false);
});

test("automation diagnostics redact credentials and constrain log messages", () => {
  const details = describeAutomationError(new Error("Bearer private-token sk-exampleSecret123456789\nrequest failed"));
  assert.equal(details.message.includes("private-token"), false);
  assert.equal(details.message.includes("exampleSecret"), false);
  assert.match(details.message, /\[redacted/);
  assert.ok(details.message.length <= 500);
});

test("automation diagnostics preserve sanitized PostgREST error fields", () => {
  assert.deepEqual(
    describeAutomationError({
      code: "42501",
      message: "permission denied for view opportunity_dashboard",
      details: "Authenticated role could not read the view.",
      hint: "Grant SELECT to authenticated.",
      operation: "opportunity_dashboard.select",
    }),
    {
      code: "authorization",
      name: "PostgrestError",
      message: "permission denied for view opportunity_dashboard",
      details: "Authenticated role could not read the view.",
      hint: "Grant SELECT to authenticated.",
      operation: "opportunity_dashboard.select",
    },
  );
});

test("handled automation fallbacks can log as warnings without a dev error overlay", () => {
  const original = console.warn;
  let output = "";
  console.warn = (value?: unknown) => { output = String(value); };
  try {
    writeAutomationLog("warn", "dashboard.load_failed", {
      operation: "opportunity_dashboard.select",
      errorCode: "authorization",
    });
  } finally {
    console.warn = original;
  }

  assert.match(output, /^\[automation\] /);
  assert.match(output, /"operation":"opportunity_dashboard.select"/);
  assert.match(output, /"errorCode":"authorization"/);
});

test("automation failures are emitted to the server terminal as structured stderr", () => {
  const original = console.error;
  let output = "";
  console.error = (value?: unknown) => { output = String(value); };
  try {
    writeAutomationLog("error", "stage.failed", {
      workflowId: "workflow-1",
      stage: "source_scout",
      errorCode: "provider_incomplete",
    });
  } finally {
    console.error = original;
  }

  assert.match(output, /^\[automation\] /);
  assert.match(output, /"event":"stage.failed"/);
  assert.match(output, /"errorCode":"provider_incomplete"/);
});
