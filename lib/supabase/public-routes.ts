const explicitDemoModes = new Set(["empty", "sample"]);

export function isSessionlessPublicRoute(url: URL): boolean {
  if (url.pathname === "/login") return true;
  if (url.pathname === "/api/internal/automation/tick") return true;
  const demoMode = url.searchParams.get("demo");
  if (url.pathname === "/") return explicitDemoModes.has(demoMode ?? "");
  if (url.pathname === "/reviewed") return explicitDemoModes.has(demoMode ?? "");
  return url.pathname === "/sources" && demoMode === "empty";
}
