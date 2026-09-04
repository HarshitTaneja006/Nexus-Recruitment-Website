"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Lock, LogOut } from "lucide-react";

/** Shown when a signed-in VIT email is not on the ADMIN_EMAILS allowlist. */
export function AdminDenied({ email }: { email: string }) {
  return (
    <section className="grid-backdrop" aria-label="Access denied">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <div className="terminal-panel w-full p-8">
          <Lock className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
          <h1 className="mt-4 font-mono text-xl font-bold tracking-wide text-destructive">
            403 - NOT_ON_ALLOWLIST
          </h1>
          <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
            signed in as: <span className="text-foreground">{email}</span>
          </p>
          <p className="mt-4 font-sans text-sm leading-relaxed text-muted-foreground">
            The review console is limited to NEXUS core-team members. If you
            should have access, ask an admin to add your email to{" "}
            <span className="font-mono text-foreground">ADMIN_EMAILS</span> and
            re-deploy.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/review" })}
              className="inline-flex h-10 items-center gap-2 border border-border px-4 font-mono text-xs tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              SWITCH_ACCOUNT
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
