"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { DRIVE, DRIVE_DEADLINE } from "@/lib/drive";
import { useDriveOpen } from "@/lib/drive-client";
import { openCommandPalette } from "@/components/nexus/command-palette";

const NAV_LINKS = [
  { href: "/#about", label: "ABOUT" },
  { href: "/#departments", label: "DEPARTMENTS" },
  { href: "/#process", label: "PROCESS" },
  { href: "/#faq", label: "FAQ" },
  { href: "/stats", label: "STATS" },
];

function IstClock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const update = () =>
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).format(new Date())
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span suppressHydrationWarning className="tabular-nums">
      {time ?? "--:--:--"} IST
    </span>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Live T-MINUS to the drive deadline (IST-pinned), ticking every second. */
function DeadlineCountdown({ open }: { open: boolean }) {
  const [txt, setTxt] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const diff = DRIVE_DEADLINE.getTime() - Date.now();
      if (diff <= 0) {
        setTxt(null);
        return;
      }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTxt(`${d}d ${pad2(h)}:${pad2(m)}:${pad2(s)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!open || !txt) {
    return (
      <span className="text-destructive" suppressHydrationWarning>
        WINDOW.SHUT
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1.5 tabular-nums"
      title={`Applications close ${DRIVE_DEADLINE.toISOString()} — lock in before the window shuts`}
      suppressHydrationWarning
    >
      {/* static, non-ticking text for screen readers */}
      <span className="sr-only">
        Applications close 24 September 2026, 11:59 PM IST
      </span>
      <span aria-hidden="true" className="flex items-center gap-1.5">
        <span className="text-muted-foreground">T-MINUS</span>
        <span className="text-warn">{txt}</span>
      </span>
    </span>
  );
}

export function SiteHeader() {
  const open = useDriveOpen();
  // mac assumption on the server (⌘); corrected on the client without an effect
  const [isMac] = useState(() =>
    typeof navigator === "undefined"
      ? true
      : /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      {/* status strip */}
      <div className="flex h-7 items-center justify-between gap-4 border-b border-border/60 px-3 font-mono text-[10px] tracking-wider text-muted-foreground sm:px-6">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="status-dot" aria-hidden="true" />
            <span className="ok-text">SYS.ONLINE</span>
          </span>
          <span className="hidden sm:inline">NODE: {DRIVE.node}</span>
          <span className={open ? "text-primary" : "text-destructive"}>
            DRIVE: {open ? "OPEN" : "CLOSED"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden lg:inline">{DRIVE.coordinates}</span>
          <span className="hidden md:inline" aria-label={open ? "Time left to apply" : "Applications closed"}>
            <DeadlineCountdown open={open} />
          </span>
          <IstClock />
        </div>
      </div>

      {/* nav row */}
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-3 sm:px-6"
      >
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-mono text-lg font-bold tracking-tight"
        >
          <Image
            src="/logo.png"
            alt="NEXUS Logo"
            width={24}
            height={24}
            className="h-6 w-6 rounded object-contain transition-transform group-hover:scale-105"
            priority
          />
          <span className="flex items-baseline gap-1">
            <span className="text-foreground group-hover:text-primary transition-colors">
              NEXUS
            </span>
            <span className="text-primary glow-text">_</span>
          </span>
          <span className="hidden text-[10px] font-normal uppercase tracking-[0.25em] text-muted-foreground sm:inline">
            {"// "}{DRIVE.label}
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 font-mono text-xs tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              ./<span className="ml-0.5">{link.label}</span>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* command-palette launcher — keycap chip, no ambiguous icon */}
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Open command menu (Control or Command K)"
            title="Command menu — press Ctrl/⌘ + K"
            className="group inline-flex h-9 items-center gap-2 border border-border bg-card/60 pl-1.5 pr-2 font-mono transition-all hover:border-primary/60 hover:bg-primary/10 hover:shadow-[0_0_16px_rgba(96,165,250,0.25)]"
          >
            <span className="flex items-center gap-1" aria-hidden="true" suppressHydrationWarning>
              <kbd suppressHydrationWarning className="inline-flex h-6 min-w-[22px] items-center justify-center border border-border bg-secondary px-1 font-mono text-[10px] text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                {isMac ? "⌘" : "Ctrl"}
              </kbd>
              <kbd className="inline-flex h-6 min-w-[22px] items-center justify-center border border-border bg-secondary px-1 font-mono text-[10px] text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                K
              </kbd>
            </span>
            <span className="hidden text-[10px] tracking-[0.2em] text-muted-foreground transition-colors group-hover:text-primary sm:inline">
              MENU
            </span>
          </button>
          <Link
            href="/apply"
            className="inline-flex h-9 items-center border border-primary/60 bg-primary/10 px-3 font-mono text-xs font-semibold tracking-wider text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_24px_rgba(96,165,250,0.4)] sm:px-4"
          >
            <span className="hidden sm:inline">./</span>JOIN_US
          </Link>
        </div>
      </nav>
    </header>
  );
}
