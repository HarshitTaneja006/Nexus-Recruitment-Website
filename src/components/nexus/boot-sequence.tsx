"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NEXUS_ASCII } from "./ascii-logo";

const BOOT_LINES = [
  "$ nexus --recruitments --init",
  "[ ok ] auth module ............ loaded",
  "[ ok ] department registry .... 3 departments",
  "[ ok ] draft autosave ......... armed",
  "[ ok ] whatsapp field ......... required",
  "> welcome, applicant. drive is live.",
];

const SESSION_KEY = "nexus-boot-done";

/**
 * Full-screen boot sequence, in the spirit of nexus.runs-on.dev.
 * Auto-dismisses; any key/click skips. Runs once per browser session.
 */
export function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    let alreadyBooted = false;
    try {
      alreadyBooted = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (alreadyBooted) return;

    // defer first paint of the overlay to avoid sync setState in effect
    const showRaf = requestAnimationFrame(() => setVisible(true));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lineDelay = reduced ? 10 : 260;

    BOOT_LINES.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => setLineCount(i + 1), i * lineDelay)
      );
    });

    const total = BOOT_LINES.length * lineDelay;
    const startedAt = performance.now();
    let raf: number;
    const tick = () => {
      const pct = Math.min(100, ((performance.now() - startedAt) / total) * 100);
      setProgress(Math.round(pct));
      if (pct < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    timers.current.push(setTimeout(dismiss, total + 1400));

    const onKey = () => dismiss();
    window.addEventListener("keydown", onKey);

    return () => {
      timers.current.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(showRaf);
      window.removeEventListener("keydown", onKey);
    };
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="System booting"
      onClick={dismiss}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-background px-6"
    >
      <div className="w-full max-w-xl">
        <pre
          aria-hidden="true"
          className="mb-6 overflow-hidden font-mono text-[7px] leading-[1.15] text-primary glow-text sm:text-[10px] md:text-xs"
        >
{NEXUS_ASCII}
        </pre>

        <div className="space-y-1 font-mono text-[11px] sm:text-xs" aria-live="polite">
          {BOOT_LINES.slice(0, lineCount).map((line, i) => (
            <p
              key={i}
              className={
                line.startsWith("[ ok ]")
                  ? "text-muted-foreground"
                  : line.startsWith(">")
                    ? "ok-text"
                    : "text-foreground"
              }
            >
              {line}
            </p>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span>INITIALIZING</span>
          <div className="h-2 flex-1 border border-border bg-muted">
            <div
              className="h-full bg-primary/70 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-10 text-right text-primary">{progress}%</span>
        </div>

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
          press any key to skip
        </p>
      </div>
    </div>
  );
}
