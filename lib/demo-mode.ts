import type { DashboardData } from "@/lib/domain";
import { demoOpportunities } from "@/lib/demo-data";

export type DemoMode = "empty" | "sample";

export function resolveDemoMode(value: string | string[] | undefined): DemoMode | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "empty" || candidate === "sample" ? candidate : null;
}

export function createDemoDashboardData(
  demoMode: DemoMode,
  generatedAt = new Date().toISOString(),
): DashboardData {
  const empty = demoMode === "empty";

  return {
    opportunities: empty ? [] : demoOpportunities,
    mode: "demo",
    demoMode,
    generatedAt,
    notice: empty
      ? "Empty demo workspace. No projects have been added."
      : "Sample demo workspace. Sign in to load your YipYip workspace.",
  };
}
