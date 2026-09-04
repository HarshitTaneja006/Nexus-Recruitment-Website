import Link from "next/link";

/**
 * Admins don't apply to their own drive - this is what they see instead of
 * the application form. Required by core: the exact string below.
 */
export function AdminBlockedApply() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-20 sm:px-6">
      <div
        className="terminal-panel border-warn/50 p-8 text-center"
        role="alert"
        aria-label="Admins cannot apply"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-warn">
          $ auth --role=core · EPERM
        </p>
        <h1 className="mt-4 break-words font-mono text-2xl font-bold tracking-wide text-warn sm:text-3xl">
          OPEN REVIEW DASH,
          <br />
          U DUMBOO
        </h1>
        <p className="mt-4 font-sans text-sm leading-relaxed text-muted-foreground">
          You are signed in with a core-team email on the{" "}
          <span className="font-mono text-foreground">ADMIN_EMAILS</span>{" "}
          allowlist. Applying to your own drive would be a conflict of
          interest - and honestly, a little suspicious.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/review"
            className="inline-flex h-12 items-center gap-2 border border-primary bg-primary px-6 font-mono text-sm font-bold tracking-widest text-primary-foreground shadow-[0_0_28px_rgba(96,165,250,0.35)] transition-all hover:shadow-[0_0_44px_rgba(96,165,250,0.55)]"
          >
            $ ./review --dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center border border-border px-5 font-mono text-xs tracking-widest text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            BACK_HOME
          </Link>
        </div>
        <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50">
          exit code 77 · permission denied: applicant role required
        </p>
      </div>
    </div>
  );
}
