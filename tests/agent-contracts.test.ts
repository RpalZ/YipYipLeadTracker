import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { researchOutputSchema, sourceScoutOutputSchema, sourceScoutWireOutputSchema } from "../lib/automation/contracts";
import { discoveryAgentOutputSchema } from "../lib/discovery/contracts";
import { RESEARCH_MAX_WEB_SEARCH_CALLS, SOURCE_SCOUT_MAX_WEB_SEARCH_CALLS, openAIWebSearchProviderData } from "../lib/automation/vendor-limits";

test("agent output schemas do not emit the unsupported JSON Schema uri format", () => {
  const serialized = JSON.stringify({
    sourceScout: z.toJSONSchema(sourceScoutOutputSchema),
    sourceMonitor: z.toJSONSchema(discoveryAgentOutputSchema),
  });

  assert.equal(serialized.includes('"format":"uri"'), false);
});

test("research value emits only typed strict-schema branches", () => {
  const schema = z.toJSONSchema(researchOutputSchema) as {
    properties?: {
      findings?: {
        items?: {
          properties?: {
            value?: { anyOf?: Array<{ type?: string }> };
          };
        };
      };
    };
  };
  const branches = schema.properties?.findings?.items?.properties?.value?.anyOf ?? [];
  assert.deepEqual(branches.map((branch) => branch.type), ["string", "null"]);
  assert.equal(branches.every((branch) => typeof branch.type === "string"), true);
});

test("Source Scout provider schema is structural while the application contract remains bounded", () => {
  const wire = JSON.stringify(z.toJSONSchema(sourceScoutWireOutputSchema));
  const application = JSON.stringify(z.toJSONSchema(sourceScoutOutputSchema));

  assert.equal(wire.includes('"maxLength"'), false);
  assert.equal(wire.includes('"maxItems"'), false);
  assert.equal(wire.includes('"minimum"'), false);
  assert.equal(application.includes('"maxLength"'), true);
  assert.equal(application.includes('"maxItems"'), true);
  assert.equal(application.includes('"minimum"'), true);
});

test("focused research sends a deterministic hosted-tool call ceiling", () => {
  assert.equal(RESEARCH_MAX_WEB_SEARCH_CALLS, 3);
  assert.deepEqual(openAIWebSearchProviderData(RESEARCH_MAX_WEB_SEARCH_CALLS), {
    include: ["web_search_call.action.sources"],
    max_tool_calls: 3,
  });
});

test("Source Scout exploration remains bounded while allowing broader coverage", () => {
  assert.equal(SOURCE_SCOUT_MAX_WEB_SEARCH_CALLS, 6);
  assert.deepEqual(openAIWebSearchProviderData(SOURCE_SCOUT_MAX_WEB_SEARCH_CALLS), {
    include: ["web_search_call.action.sources"],
    max_tool_calls: 6,
  });
});
