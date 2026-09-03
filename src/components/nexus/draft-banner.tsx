"use client";

import { Trash2, X } from "lucide-react";

/**
 * Informs the student that their previous answers were restored.
 * Data recovery is automatic — the banner just makes it visible and
 * offers an explicit DISCARD for fresh starts.
 */
export function DraftBanner({
  recoveredAt,
  source,
  onKeep,
  onDiscard,
}: {
  recoveredAt: string;
  source: "local" | "server";
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const when = new Date(recoveredAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div
      role="status"
      className="flex flex-col gap-3 border border-ok/40 bg-ok/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="font-mono text-[11px] leading-relaxed text-foreground">
        <span className="ok-text">DRAFT_RECOVERED</span>{" "}
        <span className="text-muted-foreground">
          — restored your in-progress answers ({source === "server" ? "server mirror" : "this device"})
          saved {when}. Nothing was lost.
        </span>
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="border border-border px-2.5 py-1 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          KEEP <X className="inline h-3 w-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-1.5 border border-destructive/50 bg-destructive/10 px-2.5 py-1 font-mono text-[10px] tracking-widest text-destructive transition-colors hover:bg-destructive hover:text-white"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" /> DISCARD
        </button>
      </div>
    </div>
  );
}
