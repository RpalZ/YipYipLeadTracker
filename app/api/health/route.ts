import { NextResponse } from "next/server";

import { hasSupabaseEnv } from "@/lib/supabase/config";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "yipyip-early-signal",
    database: hasSupabaseEnv() ? "configured" : "demo",
    timestamp: new Date().toISOString(),
  });
}
