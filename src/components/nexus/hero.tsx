"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AsciiLogo } from "./ascii-logo";
import { GlyphRain } from "./glyph-rain";
import { DRIVE, DRIVE_DEADLINE } from "@/lib/drive";

const TERMINAL_LINES = [
  "$ ./apply --status",
  "  drive ................. OPEN",
  `  deadline .............. ${DRIVE_DEADLINE.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · 23:59 IST`,
  "  departments ........... technical / management / design_social_media",
  "  auth .................. google · vitstudent.ac.in only",
  "  live funnel ........... /stats · core-gated",
  "  review console ........ /review · core-team allowlist",
];

interface Stats {
  total: number;
  generatedAt: string;
}

export function Hero() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = reduced ? 10 : 420;
    const timers: ReturnType<typeof setTimeout>[] = [];
    TERMINAL_LINES.forEach((_, i) =>
      timers.push(setTimeout(() => setVisibleLines(i + 1), i * step))
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative overflow-hidden border-b border-border grid-backdrop" aria-label="Hero">
      <GlyphRain />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,#05080d_75%)]" />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="status-dot" aria-hidden="true" />
            $ whoami — student tech collective · vit chennai
          </p>

          <AsciiLogo />

          <h1 className="mt-6 font-mono text-xl font-bold tracking-[0.18em] text-foreground sm:text-2xl">
            INNOVATE <span className="text-primary">◆</span> LEAD{" "}
            <span className="text-primary">◆</span> BUILD
          </h1>

          <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-muted-foreground sm:text-lg">
            {DRIVE.label} are <span className="text-primary">live</span>. One
            club, three departments, zero spectator mode. We architect web
            platforms, train neural models, balance budgets and design the
            stories that ship them — together.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/apply"
              className="group inline-flex h-11 items-center gap-2 border border-primary bg-primary px-5 font-mono text-sm font-bold tracking-wider text-primary-foreground shadow-[0_0_28px_rgba(96,165,250,0.35)] transition-all hover:shadow-[0_0_44px_rgba(96,165,250,0.55)]"
            >
              ./INITIATE_APPLICATION
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <a
              href="#departments"
              className="inline-flex h-11 items-center border border-border bg-secondary/60 px-5 font-mono text-sm tracking-wider text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              ./INSPECT_DOMAINS
            </a>
          </div>

          <dl className="mt-10 grid max-w-xl grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
            {[
              ["119+", "ACTIVE MEMBERS"],
              ["15+", "EVENTS SHIPPED"],
              ["03", "DEPARTMENTS"],
              [stats ? String(stats.total).padStart(3, "0") : "———", "APPLICATIONS"],
            ].map(([value, label]) => (
              <div key={label} className="bg-card px-4 py-3">
                <dt className="sr-only">{label}</dt>
                <dd className="font-mono text-xl font-bold text-primary tabular-nums sm:text-2xl">
                  {value}
                </dd>
                <dd className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* terminal window */}
        <div className="terminal-panel relative" aria-label="Drive status terminal">
          <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3 py-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              nexus@vitc: ~/recruitments
            </span>
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]" />
            </span>
          </div>
          <div className="min-h-[220px] space-y-1.5 px-4 py-4 font-mono text-[11px] leading-relaxed sm:text-xs" aria-live="polite">
            {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
              <p
                key={i}
                className={
                  line.startsWith("$")
                    ? "text-primary"
                    : line.startsWith("  drive")
                      ? "ok-text"
                      : "text-muted-foreground"
                }
              >
                {line}
              </p>
            ))}
            {visibleLines === TERMINAL_LINES.length && (
              <p className="cursor-blink text-primary" aria-hidden="true">
                &nbsp;
              </p>
            )}
            <noscript>
              <pre>{TERMINAL_LINES.join("\n")}</pre>
            </noscript>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>ENGINE: RECRUIT/2.6</span>
            <span className="text-primary/70">MODE: LIVE</span>
          </div>
        </div>
      </div>
    </section>
  );
}
