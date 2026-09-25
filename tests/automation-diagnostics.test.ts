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

test("automation diagnostics redact credentials and constrain log messages", () => {
  const details = describeAutomationError(new Error("Bearer private-token sk-exampleSecret123456789\nrequest failed"));
  assert.equal(details.message.includes("private-token"), false);
  assert.equal(details.message.includes("exampleSecret"), false);
  assert.match(details.message, /\[redacted/);
  assert.ok(details.message.length <= 500);
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
