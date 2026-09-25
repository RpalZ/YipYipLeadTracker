import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { researchOutputSchema, sourceScoutOutputSchema } from "../lib/automation/contracts";
import { discoveryAgentOutputSchema } from "../lib/discovery/contracts";

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
