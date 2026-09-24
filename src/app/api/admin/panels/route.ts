import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { normalizePanelName } from "@/lib/departments";
import {
  addInterviewPanel,
  countPanelSlotReferences,
  getInterviewPanels,
  removeInterviewPanel,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z
  .object({
    action: z.enum(["add", "remove"]),
    /** panel name - required for action=remove */
    name: z.string().max(40).optional(),
  })
  .refine((v) => v.action === "add" || (v.name?.trim() ?? "") !== "", {
    message: "name is required for action=remove",
  });

/**
 * GET /api/admin/panels - roster of interview panels for parallel
 * shortlist slots. Always at least ["Panel 1"] (the drive default).
 */
export async function GET() {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  try {
    const panels = await getInterviewPanels();
    return NextResponse.json({ panels });
  } catch (err) {
    console.error("[api/admin/panels] GET failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * POST /api/admin/panels - { action: "add" } appends the next "Panel N";
 * { action: "remove", name } deletes one (refused while live SHORTLISTED
 * slots reference it, or when it is the last panel standing).
 */
export async function POST(req: Request) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "add") {
      const result = await addInterviewPanel();
      if ("error" in result) {
        return NextResponse.json(
          { error: "PANEL_LIMIT", message: "Maximum panel count reached." },
          { status: 409 }
        );
      }
      return NextResponse.json({ panels: result.panels, added: result.added });
    }

    const name = normalizePanelName(parsed.data.name);
    if (!name) {
      return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
    }
    const panels = await getInterviewPanels();
    if (!panels.includes(name)) {
      return NextResponse.json({ error: "UNKNOWN_PANEL" }, { status: 404 });
    }
    if (panels.length <= 1) {
      return NextResponse.json(
        { error: "LAST_PANEL", message: "The drive always keeps at least one panel." },
        { status: 409 }
      );
    }
    const referenced = await countPanelSlotReferences(name);
    if (referenced > 0) {
      return NextResponse.json(
        {
          error: "PANEL_IN_USE",
          message: `${name} still runs ${referenced} scheduled slot${referenced === 1 ? "" : "s"} - move them first.`,
          slots: referenced,
        },
        { status: 409 }
      );
    }
    const updated = await removeInterviewPanel(name);
    return NextResponse.json({ panels: updated, removed: name });
  } catch (err) {
    console.error("[api/admin/panels] POST failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
