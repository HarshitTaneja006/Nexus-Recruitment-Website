"use client";

import { Cloud, CloudUpload, HardDriveDownload } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "synced" | "error";

/**
 * Compact autosave status chip. aria-live so screen readers announce
 * that the student's work is being preserved.
 */
export function AutosaveIndicator({
  state,
  localAt,
  serverAt,
  className,
}: {
  state: SaveState;
  localAt: string | null;
  serverAt: string | null;
  className?: string;
}) {
  const time = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-IN", { hour12: false })
      : null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 border border-border bg-card/80 px-2.5 py-1.5 font-mono text-[10px] tracking-wider",
        state === "error" ? "text-warn" : "text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {state === "saving" ? (
        <>
          <CloudUpload className="h-3.5 w-3.5 animate-pulse text-primary" aria-hidden="true" />
          <span className="text-primary">SAVING…</span>
        </>
      ) : state === "error" ? (
        <>
          <HardDriveDownload className="h-3.5 w-3.5 text-warn" aria-hidden="true" />
          <span className="text-warn">SAVED_LOCALLY (server sync retrying)</span>
        </>
      ) : (
        <>
          <Cloud className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
          <span className="ok-text">DRAFT_SAVED</span>
          <span suppressHydrationWarning>
            local {time(localAt) ?? "-"}
            {serverAt ? ` · server ${time(serverAt)}` : ""}
          </span>
        </>
      )}
    </div>
  );
}
