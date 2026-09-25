import assert from "node:assert/strict";
import test from "node:test";

import { resolveAutomationExecutionTiming, resolveAutomationRuntimeConfig, resolveAutomationWorkerConfig } from "../lib/automation/runtime-config";

const configured = {
  AUTOMATION_ENABLED: "true",
  AUTOMATION_CRON_SECRET: "cron-secret",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  OPENAI_API_KEY: "openai-key",
  APP_BASE_URL: "http://localhost:3000",
};

test("automation is disabled by default and requires every server secret", () => {
  assert.equal(resolveAutomationRuntimeConfig({}).ready, false);
  assert.equal(resolveAutomationRuntimeConfig({ ...configured, AUTOMATION_CRON_SECRET: "" }).ready, false);
  assert.equal(resolveAutomationRuntimeConfig(configured).ready, true);
});

test("interactive worker readiness does not require hosted Cron configuration", () => {
  assert.deepEqual(resolveAutomationWorkerConfig({
    AUTOMATION_ENABLED: "true",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    OPENAI_API_KEY: "openai-key",
  }), {
    ready: true,
    serviceRoleKey: "service-key",
    apiKey: "openai-key",
    agentTimeoutSeconds: 150,
    stageLeaseSeconds: 180,
  });
  assert.equal(resolveAutomationWorkerConfig({
    AUTOMATION_ENABLED: "true",
    OPENAI_API_KEY: "openai-key",
  }).ready, false);
});

test("automation accepts a configurable compatible API base URL", () => {
  assert.deepEqual(resolveAutomationRuntimeConfig({ ...configured, OPENAI_BASE_URL: "https://gateway.example/v1/" }), {
    ready: true,
    cronSecret: "cron-secret",
    serviceRoleKey: "service-key",
    apiKey: "openai-key",
    appBaseURL: "http://localhost:3000",
    baseURL: "https://gateway.example/v1",
    agentTimeoutSeconds: 150,
    stageLeaseSeconds: 180,
  });
  assert.equal(resolveAutomationRuntimeConfig({ ...configured, OPENAI_BASE_URL: "file:///tmp/api" }).ready, false);
});

test("automation timing is bounded and keeps the stage lease beyond the agent deadline", () => {
  assert.deepEqual(resolveAutomationExecutionTiming(), { agentTimeoutSeconds: 150, stageLeaseSeconds: 180 });
  assert.deepEqual(resolveAutomationExecutionTiming("210"), { agentTimeoutSeconds: 210, stageLeaseSeconds: 240 });
  assert.throws(() => resolveAutomationExecutionTiming("29"), /integer from 30 to 240/);
  assert.throws(() => resolveAutomationExecutionTiming("241"), /integer from 30 to 240/);
  assert.equal(resolveAutomationWorkerConfig({
    AUTOMATION_ENABLED: "true",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    OPENAI_API_KEY: "openai-key",
    AUTOMATION_AGENT_TIMEOUT_SECONDS: "not-a-number",
  }).ready, false);
});
