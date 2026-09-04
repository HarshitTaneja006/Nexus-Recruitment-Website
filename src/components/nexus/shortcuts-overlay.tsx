"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const SHORTCUTS_EVENT = "nexus:open-shortcuts";

/** Dispatch from anywhere (palette, header, console) to open the man page. */
export function openShortcuts() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SHORTCUTS_EVENT));
  }
}

const GOTO_MS = 1200;

const NAV_ROWS = [
  { second: "h", seq: "g h", label: "go home", href: "/", desc: "landing console" },
  { second: "a", seq: "g a", label: "go apply", href: "/apply", desc: "initiate application" },
  { second: "s", seq: "g s", label: "go stats", href: "/stats", desc: "live funnel" },
  { second: "r", seq: "g r", label: "go review", href: "/review", desc: "core-only console" },
] as const;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT"
  );
}

/**
 * NEXUS keyboard man page - press ? anywhere (or `man nexus_keys` in the
 * palette) to read it. Also owns the vim-style `g <key>` quick-nav: the
 * sequence fires when the second key lands within GOTO_MS of the first.
 */
export function ShortcutsOverlay() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const pendingGo = React.useRef<{ key: string; at: number } | null>(null);

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(SHORTCUTS_EVENT, onOpen);

    const onKey = (e: KeyboardEvent) => {
      // `?` toggles this man page (guarded against typing contexts)
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      // vim-style `g <key>` quick-nav
      if (e.metaKey || e.ctrlKey || e.altKey) {
        pendingGo.current = null;
        return;
      }
      if (isTypingTarget(e.target)) {
        pendingGo.current = null;
        return;
      }

      const now = Date.now();
      const pending = pendingGo.current;
      pendingGo.current = null;

      if (pending && now - pending.at <= GOTO_MS) {
        const row = NAV_ROWS.find((r) => r.second === e.key.toLowerCase());
        if (row) {
          e.preventDefault();
          setOpen(false);
          router.push(row.href);
          return;
        }
      }
      if (e.key.toLowerCase() === "g") {
        pendingGo.current = { key: "g", at: now };
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(SHORTCUTS_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-none border-primary/30 bg-background p-0 font-mono shadow-[0_0_80px_rgba(96,165,250,0.18)] sm:max-w-lg"
      >
        <DialogHeader className="space-y-0 border-b border-border/60 bg-secondary/30 px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 font-mono text-sm font-bold tracking-tight">
            <Keyboard className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-primary glow-text">$</span> man nexus-keys
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] tracking-widest text-muted-foreground">
            KEYBOARD_REFERENCE · NEXUS(1) · v26.9
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
          <ManSection tag="$ GLOBAL">
            <ManRow keys={["⌘", "K"]} altKeys={["Ctrl", "K"]} label="command palette" desc="jump anywhere · copy invite" />
            <ManRow keys={["?"]} label="this man page" desc="toggle the keyboard reference" />
            <ManRow keys={["esc"]} label="close overlays" desc="palette · dialogs · man pages" />
          </ManSection>

          <ManSection tag="$ NAV · vim-style go-to">
            {NAV_ROWS.map((row) => (
              <ManRow
                key={row.seq}
                keys={row.seq.split(" ")}
                label={row.label}
                desc={row.desc}
              />
            ))}
          </ManSection>

          <ManSection tag="$ CONSOLE · /review only">
            <ManRow keys={["/"]} label="focus grep box" desc="filter transmissions by name or id" />
          </ManSection>
        </div>

        <div
          aria-hidden="true"
          className="flex items-center justify-between border-t border-border/60 bg-secondary/30 px-4 py-2 font-mono text-[9px] tracking-[0.2em] text-muted-foreground"
        >
          <span>
            <KeyCap>g</KeyCap> then a key within {GOTO_MS / 1000}s
          </span>
          <span className="flex items-center gap-1.5">
            <span className="status-dot" />
            <KeyCap>esc</KeyCap> exit
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManSection({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <p className="mb-2 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{tag}</p>
      <div className="divide-y divide-border/50 border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

function ManRow({
  keys,
  altKeys,
  label,
  desc,
}: {
  keys: string[];
  altKeys?: string[];
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-primary/5">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1">
          {keys.map((k) => (
            <KeyCap key={k}>{k}</KeyCap>
          ))}
        </span>
        {altKeys ? (
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
            or
            {altKeys.map((k) => (
              <KeyCap key={k}>{k}</KeyCap>
            ))}
          </span>
        ) : null}
        <span className="text-[11px] tracking-wide text-foreground">{label}</span>
      </div>
      <span className="hidden text-right text-[9px] tracking-widest text-muted-foreground sm:inline">
        {desc}
      </span>
    </div>
  );
}

/** Tiny keyboard-key chip (matches the palette footer styling). */
function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center border border-border bg-background px-1 py-px font-mono text-[9px] text-muted-foreground shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
      {children}
    </kbd>
  );
}
