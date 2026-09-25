import { Dashboard } from "@/components/dashboard";
import { resolveDemoMode } from "@/lib/demo-mode";
import { getDashboardData } from "@/lib/data/opportunities";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string | string[] }>;
}) {
  const { demo } = await searchParams;
  const data = await getDashboardData({ demoMode: resolveDemoMode(demo) });
  return <Dashboard data={data} />;
}
