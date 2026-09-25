import { ReviewWorkspace } from "@/components/review-workspace";
import { getDashboardData } from "@/lib/data/opportunities";
import { resolveDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

export default async function ReviewedPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string | string[] }>;
}) {
  const { demo } = await searchParams;
  const data = await getDashboardData({ demoMode: resolveDemoMode(demo) });
  return <ReviewWorkspace data={data} />;
}
