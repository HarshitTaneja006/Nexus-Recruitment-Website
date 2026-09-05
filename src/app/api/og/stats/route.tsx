import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getDepartment, getDepartmentHex } from "@/lib/departments";
import { APPLICATION_STATUSES, STATUS_META } from "@/lib/status";
import { getDriveStats, isStatsPublic } from "@/lib/storage";
import { getAdminSession } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt =
  "NEXUS Recruitments '26 - live recruitment stats (aggregates only)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * GET /api/og/stats?dept=<id> - live, terminal-styled social card for the
 * public stats console. Dept-scoped when a valid ?dept= is passed (the
 * /stats page wires this through generateMetadata so shared scoped links
 * unfurl with the focused domain's numbers). Aggregates only, zero PII.
 */

const INK = "#05080d";
const PANEL = "#070d16";
const BORDER = "#17263c";
const MUTED = "#7d8fa5";
const TEXT = "#d7e2ee";
const PRIMARY = "#60a5fa";
const OK = "#4ade80";

/** status → hex, mirrored from STATUS_META barClass for the OG renderer */
const STATUS_HEX: Record<string, string> = {
  SUBMITTED: "#38bdf8",
  SHORTLISTED: "#34d399",
  INTERVIEWED: "#a78bfa",
  ACCEPTED: "#4ade80",
  REJECTED: "#ff5f57",
  // legacy audit-trail statuses (display-only)
  WAITLISTED: "#facc15",
  // legacy audit-trail statuses (display-only)
  IN_REVIEW: "#fbbf24",
  NEEDS_INFO: "#fb923c",
  INTERVIEW: "#e879f9",
};

function KpiBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        border: `1px solid ${BORDER}`,
        backgroundColor: PANEL,
        padding: "22px 26px",
      }}
    >
      <span style={{ fontSize: 15, letterSpacing: 4, color: MUTED }}>{label}</span>
      <span
        style={{
          fontSize: 58,
          fontWeight: 700,
          color: accent,
          marginTop: 8,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const deptParam = req.nextUrl.searchParams.get("dept") ?? "";
  const dept = getDepartment(deptParam);

  // Sealed console → aggregate-free teaser card (unless an admin unfurls it).
  const unlocked = (await isStatsPublic()) || Boolean(await getAdminSession());
  if (!unlocked) {
    return sealedCard(dept);
  }

  let stats: Awaited<ReturnType<typeof getDriveStats>> | null = null;
  try {
    stats = await getDriveStats();
  } catch {
    stats = null;
  }

  const bucket = dept ? (stats?.byDepartmentStatus?.[dept.id] ?? {}) : null;
  const total = bucket
    ? Object.values(bucket).reduce((a, b) => a + b, 0)
    : (stats?.total ?? 0);
  const accepted = bucket
    ? (bucket["ACCEPTED"] ?? 0)
    : Object.values(stats?.byDepartmentStatus ?? {}).reduce(
        (acc, b) => acc + (b["ACCEPTED"] ?? 0),
        0
      );
  const acceptRate = total > 0 ? `${Math.round((accepted / total) * 100)}%` : "-";
  const last24h = bucket && dept
    ? (stats?.timelineByDept?.[dept.id]?.at(-1)?.count ?? 0)
    : (stats?.last24h ?? 0);
  const domains = bucket
    ? total > 0
      ? 1
      : 0
    : Object.values(stats?.byDepartment ?? {}).filter((v) => v > 0).length;

  // status split bar (share of the active scope)
  const split = APPLICATION_STATUSES.map((s) => ({
    status: s,
    count: bucket ? (bucket[s] ?? 0) : Object.values(stats?.byDepartmentStatus ?? {}).reduce((acc, b) => acc + (b[s] ?? 0), 0),
  })).filter((s) => s.count > 0);

  const scopeLabel = dept ? `d ${dept.dir}/ - ${dept.name}` : "ALL DOMAINS";
  const scopeHex = dept ? getDepartmentHex(dept.id) : PRIMARY;

  const nowIst = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: INK,
          padding: 56,
          backgroundImage:
            "linear-gradient(rgba(96,165,250,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      >
        {/* top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontSize: 44, fontWeight: 700, color: TEXT }}>NEXUS</span>
            <span style={{ fontSize: 44, fontWeight: 700, color: PRIMARY }}>_</span>
            <span style={{ fontSize: 19, letterSpacing: 5, color: MUTED }}>
              {"// RECRUITMENTS '26 · VIT CHENNAI"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px solid ${BORDER}`,
              padding: "8px 16px",
              backgroundColor: PANEL,
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: OK }} />
            <span style={{ fontSize: 15, letterSpacing: 3, color: OK }}>LIVE · NO-PII</span>
          </div>
        </div>

        {/* scope headline + KPIs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <span style={{ fontSize: 30, color: scopeHex, fontWeight: 700 }}>$ tail --stats</span>
            <span style={{ fontSize: 30, color: TEXT, fontWeight: 700 }}>{scopeLabel}</span>
          </div>

          <div style={{ display: "flex", gap: 18 }}>
            <KpiBox label="TOTAL APPLICATIONS" value={String(total).padStart(2, "0")} accent={scopeHex} />
            <KpiBox label="LAST 24 HOURS" value={String(last24h).padStart(2, "0")} accent={OK} />
            <KpiBox label="DOMAINS ACTIVE" value={String(domains).padStart(2, "0")} accent="#fbbf24" />
            <KpiBox label="ACCEPTANCE" value={acceptRate} accent="#e879f9" />
          </div>

          {/* review-pipeline split bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", height: 26, width: "100%", backgroundColor: "#0f1a28", border: `1px solid ${BORDER}` }}>
              {split.map(({ status, count }) => (
                <div
                  key={status}
                  style={{
                    width: `${(count / Math.max(1, total)) * 100}%`,
                    backgroundColor: STATUS_HEX[status] ?? PRIMARY,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              {split.map(({ status, count }) => (
                <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      backgroundColor: STATUS_HEX[status] ?? PRIMARY,
                    }}
                  />
                  <span style={{ fontSize: 16, letterSpacing: 2, color: MUTED }}>
                    {STATUS_META[status].label} {count}
                  </span>
                </div>
              ))}
              {split.length === 0 ? (
                <span style={{ fontSize: 16, letterSpacing: 2, color: MUTED }}>
                  no applications yet - be the first
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 18, color: PRIMARY }}>
            nexus.runs-on.dev/stats
          </span>
          <span style={{ fontSize: 15, letterSpacing: 2, color: MUTED }}>
            aggregates only · generated {nowIst} IST
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}

/** No-numbers teaser card rendered while the public funnel is sealed. */
function sealedCard(dept: ReturnType<typeof getDepartment>) {
  const scopeHex = dept ? getDepartmentHex(dept.id) : PRIMARY;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: INK,
          padding: 56,
          backgroundImage:
            "linear-gradient(rgba(96,165,250,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontSize: 44, fontWeight: 700, color: TEXT }}>NEXUS</span>
            <span style={{ fontSize: 44, fontWeight: 700, color: PRIMARY }}>_</span>
            <span style={{ fontSize: 19, letterSpacing: 5, color: MUTED }}>
              {"// RECRUITMENTS '26 · VIT CHENNAI"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px solid #facc15`,
              padding: "8px 16px",
              backgroundColor: PANEL,
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: "#facc15" }} />
            <span style={{ fontSize: 15, letterSpacing: 3, color: "#facc15" }}>SEALED · CORE ONLY</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 34, color: TEXT, fontWeight: 700 }}>$ tail --stats</span>
          <span style={{ fontSize: 26, color: scopeHex, fontWeight: 700 }}>
            {dept ? `d ${dept.dir}/ - ${dept.name}` : "ALL DOMAINS"}
          </span>
          <span style={{ fontSize: 20, color: MUTED, maxWidth: 820 }}>
            The live funnel is sealed by the core team. Aggregate numbers unlock when the drive opens its stats console.
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 18, color: PRIMARY }}>nexus.runs-on.dev</span>
          <span style={{ fontSize: 15, letterSpacing: 2, color: MUTED }}>apply now - link in bio</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
