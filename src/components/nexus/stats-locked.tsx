import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * Rendered on /stats while the public funnel is sealed (stats_public=0).
 * Core sees the live console instead - this view is for everyone else.
 */
export function StatsLocked() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-lg">
        <div className="terminal-panel border-warn/40 p-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-warn">
            $ tail --stats · EACCES
          </p>
          <Lock className="mx-auto mt-5 h-10 w-10 text-warn" aria-hidden="true" />
          <h1 className="mt-4 font-mono text-xl font-bold tracking-wide">
            STATS_CONSOLE_SEALED
          </h1>
          <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
            The live funnel is <span className="font-mono text-foreground">sealed by the core team</span>.
            Aggregate numbers - totals, velocity, per-department pipeline - stay
            private until they decide to open the console.
          </p>
          <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
            Your application is still very much alive: track its exact status on
            your application page.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/apply"
              className="inline-flex h-11 items-center gap-2 border border-primary bg-primary px-5 font-mono text-xs font-bold tracking-widest text-primary-foreground transition-shadow hover:shadow-[0_0_28px_rgba(96,165,250,0.4)]"
            >
              ./MY_APPLICATION
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center border border-border px-5 font-mono text-xs tracking-widest text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              BACK_HOME
            </Link>
          </div>
          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50">
            core can unlock this from the review console · secret required
          </p>
        </div>
      </div>
    </div>
  );
}
