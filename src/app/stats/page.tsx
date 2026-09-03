import type { Metadata } from "next";
import { StatsView } from "@/components/nexus/stats-view";
import { StatsLocked } from "@/components/nexus/stats-locked";
import { DEPARTMENTS } from "@/lib/departments";
import { isStatsPublic } from "@/lib/storage";
import { getAdminSession } from "@/lib/admin";

type StatsSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: StatsSearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const deptParam = typeof sp.dept === "string" ? sp.dept : "";
  const dept = DEPARTMENTS.find((d) => d.id === deptParam);
  const ogPath = dept ? `/api/og/stats?dept=${dept.id}` : "/api/og/stats";

  return {
    title: "LIVE_STATS // NEXUS Recruitments '26",
    description:
      "Live, privacy-safe recruitment funnel for NEXUS VIT Chennai — per-department review pipeline, drive velocity and cohort mix. Aggregates only, no personal data.",
    openGraph: {
      title: dept
        ? `NEXUS stats — d ${dept.dir}/ · live funnel`
        : "NEXUS stats — the live funnel",
      description: dept
        ? `Live ${dept.name} pipeline for the NEXUS '26 drive at VIT Chennai — aggregates only, zero PII.`
        : "Live, privacy-safe recruitment funnel for the NEXUS '26 drive at VIT Chennai — aggregates only, zero PII.",
      images: [{ url: ogPath, width: 1200, height: 630, alt: "NEXUS live recruitment stats" }],
    },
    twitter: {
      card: "summary_large_image",
      title: dept
        ? `NEXUS stats — d ${dept.dir}/ · live funnel`
        : "NEXUS stats — the live funnel",
      images: [ogPath],
    },
  };
}

export default async function StatsPage() {
  // The funnel is SEALED unless core unlocked it — admins always see it.
  const unlocked = (await isStatsPublic()) || Boolean(await getAdminSession());

  return (
    // layout already owns the single <main> landmark (#main-content)
    <div className="flex-1">
      {unlocked ? <StatsView /> : <StatsLocked />}
    </div>
  );
}
