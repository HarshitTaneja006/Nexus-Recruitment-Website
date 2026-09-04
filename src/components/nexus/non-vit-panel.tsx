"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { AlertTriangle, LogOut } from "lucide-react";
import { VIT_EMAIL_HINT } from "@/lib/vit";

/** Shown when a student signs in with a non-VIT Google account. */
export function NonVitPanel({ email }: { email: string }) {
  return (
    <section className="grid-backdrop" aria-label="Invalid email">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <div className="terminal-panel w-full p-8">
          <AlertTriangle
            className="mx-auto h-10 w-10 text-warn"
            aria-hidden="true"
          />
          <h1 className="mt-4 font-mono text-xl font-bold tracking-wide text-warn">
            ACCESS_DENIED - NON_VIT_EMAIL
          </h1>
          <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
            signed in as: <span className="text-foreground">{email}</span>
          </p>
          <p className="mt-4 font-sans text-sm leading-relaxed text-muted-foreground">
            The recruitment drive is only open to VIT students. Sign out and
            authenticate again with your student Google account matching{" "}
            <span className="font-mono text-foreground">{VIT_EMAIL_HINT}</span>.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/apply" })}
              className="inline-flex h-10 items-center gap-2 border border-destructive/60 bg-destructive/10 px-4 font-mono text-xs font-bold tracking-widest text-destructive transition-colors hover:bg-destructive hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              SIGN_OUT
            </button>
            <Link
              href="/"
              className="inline-flex h-10 items-center border border-border px-4 font-mono text-xs tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              ← BACK_HOME
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
