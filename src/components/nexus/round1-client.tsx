"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { TechRound1Panel } from "@/components/nexus/tech-round1-panel";
import type { ApplicationRecord } from "@/lib/storage";

/**
 * /round1 gate: eligible (technical SHORTLISTED_R1) students get the
 * project screen; everyone else gets a "not eligible yet" note that
 * links back to their receipt.
 */
export function Round1Client() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; application: ApplicationRecord; deadline: string | null }
    | { kind: "denied" }
  >({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    fetch("/api/round1", { cache: "no-store" })
      .then((res) => {
        if (!alive) return;
        if (!res.ok) {
          setState({ kind: "denied" });
          return;
        }
        return res.json().then(
          (data: { application: ApplicationRecord; deadline: string | null }) => {
            if (alive) setState({ kind: "ready", ...data });
          }
        );
      })
      .catch(() => {
        if (alive) setState({ kind: "denied" });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-secondary/40" />
        ))}
      </div>
    );
  }

  if (state.kind === "denied") {
    return (
      <section className="terminal-panel" aria-label="Round 1 not available">
        <div className="border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            $ round1 --project
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 p-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-mono text-xs text-muted-foreground">
            ROUND_1_NOT_FOUND - this screen opens for technical students
            shortlisted for Round 1.
          </p>
          <Link
            href="/apply"
            className="inline-flex h-10 items-center border border-primary/50 bg-primary/10 px-5 font-mono text-xs font-bold tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            CHECK_STATUS
          </Link>
        </div>
      </section>
    );
  }

  return <TechRound1Panel application={state.application} deadline={state.deadline} />;
}
