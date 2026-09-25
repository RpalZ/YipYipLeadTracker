import { timingSafeEqual } from "node:crypto";

import { processOneAutomationStage } from "@/lib/automation/worker";
import { automationRuntimeReadiness } from "@/lib/automation/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request, expected: string): boolean {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const runtimeConfig = automationRuntimeReadiness();
  if (!runtimeConfig.ready) return Response.json({ ok: false, error: runtimeConfig.reason }, { status: 503 });
  if (!authorized(request, runtimeConfig.cronSecret)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const result = await processOneAutomationStage();
  return Response.json({ ok: true, ...result });
}
