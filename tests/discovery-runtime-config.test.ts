import assert from "node:assert/strict";
import test from "node:test";

import { resolveDiscoveryRuntimeConfig } from "../lib/discovery/runtime-config";

test("uses the default OpenAI endpoint when OPENAI_BASE_URL is unset", () => {
  assert.deepEqual(resolveDiscoveryRuntimeConfig({
    DISCOVERY_AGENT_ENABLED: "true",
    OPENAI_API_KEY: "test-key",
  }), {
    ready: true,
    apiKey: "test-key",
  });
});

test("normalizes a configured OpenAI-compatible base URL", () => {
  assert.deepEqual(resolveDiscoveryRuntimeConfig({
    DISCOVERY_AGENT_ENABLED: "true",
    OPENAI_API_KEY: " test-key ",
    OPENAI_BASE_URL: " https://gateway.example.com/openai/v1/ ",
  }), {
    ready: true,
    apiKey: "test-key",
    baseURL: "https://gateway.example.com/openai/v1",
  });
});

test("allows an HTTP localhost base URL for local development", () => {
  assert.equal(resolveDiscoveryRuntimeConfig({
    DISCOVERY_AGENT_ENABLED: "true",
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: "http://127.0.0.1:11434/v1",
  }).ready, true);
});

test("rejects malformed, unsupported, or credential-bearing base URLs", () => {
  for (const baseURL of [
    "not-a-url",
    "file:///tmp/openai",
    "https://user:password@gateway.example.com/v1",
    "https://gateway.example.com/v1#responses",
  ]) {
    const result = resolveDiscoveryRuntimeConfig({
      DISCOVERY_AGENT_ENABLED: "true",
      OPENAI_API_KEY: "test-key",
      OPENAI_BASE_URL: baseURL,
    });
    assert.equal(result.ready, false, baseURL);
  }
});

test("keeps feature and credential readiness checks", () => {
  assert.deepEqual(resolveDiscoveryRuntimeConfig({}), {
    ready: false,
    reason: "Discovery agent is disabled by configuration.",
  });
  assert.deepEqual(resolveDiscoveryRuntimeConfig({ DISCOVERY_AGENT_ENABLED: "true" }), {
    ready: false,
    reason: "OPENAI_API_KEY is not configured.",
  });
});
