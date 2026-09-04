"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DRIVE_DEADLINE } from "@/lib/drive";
import { useDriveOpen } from "@/lib/drive-client";

interface Remaining {
  d: number;
  h: number;
  m: number;
  s: number;
}

function getRemaining(): Remaining {
  const diff = Math.max(0, DRIVE_DEADLINE.getTime() - Date.now());
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff / 3_600_000) % 24),
    m: Math.floor((diff / 60_000) % 60),
    s: Math.floor((diff / 1_000) % 60),
  };
}

export function CtaBand() {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const open = useDriveOpen();

  useEffect(() => {
    // defer to avoid sync setState in effect body
    const raf = requestAnimationFrame(() => setRemaining(getRemaining()));
    const id = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  const units: [string, number][] = remaining
    ? [
        ["DAYS", remaining.d],
        ["HRS", remaining.h],
        ["MIN", remaining.m],
        ["SEC", remaining.s],
      ]
    : [];

  return (
    <section className="relative overflow-hidden border-b border-border" aria-label="Call to action">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(96,165,250,0.08),transparent_60%)]" />
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 md:py-20">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          $ ./join --nexus
        </p>
        <h2 className="mt-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          READY TO{" "}
          <span className="text-primary glow-text">COMPILE?</span>
          <span className="cursor-blink" aria-hidden="true" />
        </h2>
        <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground sm:text-base">
          Applications are reviewed as they land - the earlier you transmit,
          the longer your answers stay in a reviewer&apos;s memory.
        </p>

        {open ? (
          <>
            <div
              className="mt-8 grid grid-cols-4 gap-px border border-border bg-border"
              role="timer"
              aria-label="Time remaining until the drive closes"
            >
              {units.map(([label, value]) => (
                <div key={label} className="bg-card px-3 py-3 sm:px-6 sm:py-4">
                  <p className="font-mono text-2xl font-bold text-primary tabular-nums sm:text-3xl">
                    {String(value).padStart(2, "0")}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] tracking-[0.25em] text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/apply"
              className="mt-8 inline-flex h-12 items-center gap-2 border border-primary bg-primary px-7 font-mono text-sm font-bold tracking-widest text-primary-foreground shadow-[0_0_34px_rgba(96,165,250,0.4)] transition-all hover:shadow-[0_0_56px_rgba(96,165,250,0.6)]"
            >
              ./INITIATE_APPLICATION →
            </Link>
            <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
              closes 24 SEP 2026 · 23:59 IST
            </p>
          </>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="border border-destructive/50 bg-destructive/10 px-6 py-4 font-mono text-sm text-destructive">
              DRIVE_CLOSED - see you next cycle.
            </p>
            <Link
              href="/apply"
              className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              ./CHECK_STATUS - review an already submitted application
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
