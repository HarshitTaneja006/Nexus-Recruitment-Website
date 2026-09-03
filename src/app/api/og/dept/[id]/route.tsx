import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { DEPARTMENTS, getDepartment, getDepartmentHex } from "@/lib/departments";
import { getDriveStats, isStatsPublic } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * GET /api/og/dept/[id] — per-department share card for the landing page's
 * domain directories (wired through generateMetadata when /?dept=<id> is
 * shared). Terminal dossier: accent-tinted headline, stack tags, live load
 * count from the drive stats. Aggregates only, zero PII.
 */

const INK = "#05080d";
const PANEL = "#070d16";
const BORDER = "#17263c";
const MUTED = "#7d8fa5";
const TEXT = "#d7e2ee";
const OK = "#4ade80";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dept = getDepartment(id);

  if (!dept) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: INK,
          }}
        >
          <span style={{ fontSize: 32, color: MUTED }}>
            unknown domain — try /api/og/dept/technical
          </span>
        </div>
      ),
      { ...size }
    );
  }

  const hex = getDepartmentHex(dept.id);
  const all = DEPARTMENTS.map((d) => d.id);
  const index = String(all.indexOf(dept.id) + 1).padStart(2, "0");

  let load: number | null = null;
  try {
    // funnel sealed → the dept card ships without the live counter too
    if (await isStatsPublic()) {
      const stats = await getDriveStats();
      load = stats.byDepartment[dept.id] ?? 0;
    }
  } catch {
    load = null;
  }

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
            <span style={{ fontSize: 44, fontWeight: 700, color: hex }}>_</span>
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
            <span style={{ fontSize: 15, letterSpacing: 3, color: OK }}>DRIVE OPEN</span>
          </div>
        </div>

        {/* dossier headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <span style={{ fontSize: 26, color: MUTED }}>$ cat</span>
            <span style={{ fontSize: 26, color: TEXT }}>d/{dept.dir}/</span>
            <span style={{ fontSize: 26, color: MUTED }}>manifesto.txt</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              <span style={{ fontSize: 30, color: hex, fontWeight: 700 }}>
                {index}/04
              </span>
              <span style={{ fontSize: 74, fontWeight: 700, color: TEXT, lineHeight: 1 }}>
                {dept.name}
              </span>
            </div>
            <span style={{ fontSize: 24, letterSpacing: 3, color: hex }}>
              {dept.tagline}
            </span>
          </div>

          {/* stack tags */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {dept.tags.map((tag) => (
              <div
                key={tag}
                style={{
                  display: "flex",
                  border: `1px solid ${BORDER}`,
                  backgroundColor: PANEL,
                  padding: "8px 18px",
                  fontSize: 17,
                  color: MUTED,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: `1px solid ${BORDER}`,
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 22, color: TEXT }}>
              $ ./apply --domain {dept.dir}
            </span>
            <span style={{ fontSize: 17, color: MUTED }}>
              {dept.questions.length}+3 questions · nexus.runs-on.dev
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 15, letterSpacing: 3, color: MUTED }}>
              {load === null ? "DRIVE" : "LIVE LOAD"}
            </span>
            <span style={{ fontSize: 40, fontWeight: 700, color: hex }}>
              {load === null ? "OPEN" : String(load).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 15, letterSpacing: 2, color: MUTED }}>
              · {nowIst} IST
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
