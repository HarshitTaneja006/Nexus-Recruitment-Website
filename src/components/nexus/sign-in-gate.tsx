"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, ShieldCheck, Terminal } from "lucide-react";
import { toast } from "sonner";
import { isValidVitEmail, parseVitEmail, VIT_EMAIL_HINT } from "@/lib/vit";
import { cn } from "@/lib/utils";

/**
 * Auth gate shown when no session exists.
 * - Production: real Google OAuth (GOOGLE_CLIENT_ID / SECRET configured).
 * - Sandbox/dev: a terminal-style simulated Google sign-in that enforces
 *   the exact same VIT email rule, so the full journey is testable.
 * - variant "admin": copy targets the review console instead of applicants.
 */
export function SignInGate({
  googleConfigured,
  variant = "student",
}: {
  googleConfigured: boolean;
  variant?: "student" | "admin";
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = variant === "admin";
  const parsed = useMemo(() => {
    const trimmed = email.trim();
    if (!trimmed) return null;
    return isValidVitEmail(trimmed) ? parseVitEmail(trimmed) : false;
  }, [email]);

  const handleSandboxSignIn = async () => {
    const value = email.trim().toLowerCase();
    if (!isValidVitEmail(value)) {
      toast.error("Invalid VIT email", {
        description: `Format must be ${VIT_EMAIL_HINT}`,
      });
      return;
    }
    setLoading(true);
    try {
      const res = await signIn("vit-sandbox", { email: value, redirect: false });
      if (res?.error) {
        toast.error("Sign-in rejected", {
          description: "Only VIT student emails can enter the drive.",
        });
        return;
      }
      toast.success("Identity verified", {
        description: isAdmin
          ? "Checking the admin allowlist…"
          : "Deriving your profile from your VIT email…",
      });
      router.refresh();
    } catch {
      toast.error("Sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative grid-backdrop" aria-label="Sign in">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-14 sm:px-6 md:py-20">
        <p className="section-tag self-start">
          <span className="text-primary">00</span>
          <span className="text-muted-foreground">/</span>{" "}
          {isAdmin ? "ADMIN AUTH REQUIRED" : "AUTH REQUIRED"}
        </p>
        <h1 className="mt-4 font-mono text-2xl font-bold tracking-tight sm:text-3xl">
          {isAdmin ? "$ sudo review --auth" : "$ google-auth --vit-only"}
        </h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground sm:text-base">
          {isAdmin ? (
            <>
              The <span className="text-foreground">review console</span> is
              restricted to allowlisted core-team emails. Sign in with your VIT
              student Google account - access is checked against{" "}
              <span className="font-mono text-foreground">ADMIN_EMAILS</span>.
            </>
          ) : (
            <>
              Sign in with your{" "}
              <span className="text-foreground">VIT student Google account</span>.
              Your <span className="text-foreground">name</span>,{" "}
              <span className="text-foreground">year of study</span> and{" "}
              <span className="text-foreground">email</span> are derived
              automatically from your email - you never type them.
            </>
          )}
        </p>

        {/* derivation preview */}
        <div className="terminal-panel mt-6 p-4" aria-hidden={!parsed || typeof parsed !== "object"}>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            $ derive --identity
          </p>
          <div className="mt-3 grid gap-2 font-mono text-xs sm:grid-cols-3">
            {(
              [
                ["NAME", typeof parsed === "object" && parsed ? parsed.fullName : "---"],
                [
                  "YEAR",
                  typeof parsed === "object" && parsed ? `${parsed.yearOfStudy}${ordinalSuffix(parsed.yearOfStudy)}` : "---",
                ],
                ["EMAIL", typeof parsed === "object" && parsed ? parsed.email : "---"],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="border border-border bg-background/60 px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  {label}
                </p>
                <p className={cn("mt-1 truncate", value === "---" ? "text-muted-foreground/50" : "text-primary")}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
            format: {VIT_EMAIL_HINT}
          </p>
        </div>

        {googleConfigured ? (
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/apply" })}
            disabled={loading}
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 border border-primary bg-primary px-6 font-mono text-sm font-bold tracking-widest text-primary-foreground shadow-[0_0_28px_rgba(96,165,250,0.3)] transition-all hover:shadow-[0_0_44px_rgba(96,165,250,0.5)] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <GoogleG />
            )}
            SIGN_IN_WITH_GOOGLE
          </button>
        ) : (
          <div className="terminal-panel mt-8">
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3 py-2">
              <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                google-oauth · sandbox mode
              </span>
              <span className="border border-warn/40 bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.15em] text-warn">
                DEV_ONLY
              </span>
            </div>
            <div className="space-y-4 p-4">
              <label htmlFor="vit-email" className="block font-mono text-xs text-muted-foreground">
                <span className="text-primary">$</span> enter your VIT student email
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="vit-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="firstname.lastname2026@vitstudent.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSandboxSignIn();
                  }}
                  className="h-11 flex-1 border border-input bg-background/80 px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  aria-invalid={parsed === false}
                  aria-describedby="vit-email-hint"
                />
                <button
                  type="button"
                  onClick={handleSandboxSignIn}
                  disabled={loading || parsed !== undefined && !parsed}
                  className="inline-flex h-11 items-center justify-center gap-2 border border-primary bg-primary/15 px-5 font-mono text-xs font-bold tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  AUTHENTICATE
                </button>
              </div>
              <p
                id="vit-email-hint"
                aria-live="polite"
                className={cn(
                  "font-mono text-[10px]",
                  parsed === false ? "text-destructive" : "text-muted-foreground/70"
                )}
              >
                {parsed === false
                  ? "✗ does not match firstname.lastnameYYYY@vitstudent.ac.in"
                  : "ℹ sandbox mode simulates Google OAuth locally - production uses real Google sign-in."}
              </p>
            </div>
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden="true" />
          Your email is used only for identity derivation and application review.
          Answers auto-save locally, so a glitch never costs you your progress.
        </p>
      </div>
    </section>
  );
}

function ordinalSuffix(n: number): string {
  if (n === 1) return "ST";
  if (n === 2) return "ND";
  if (n === 3) return "RD";
  return "TH";
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5.04c1.94 0 3.28.84 4.04 1.54l2.95-2.88C17.17 2.02 14.82 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.44 2.67C6.47 6.98 9 5.04 12 5.04z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45c-.28 1.48-1.12 2.73-2.4 3.57l3.36 2.6c1.96-1.8 3.09-4.46 3.09-8.36z"
      />
      <path
        fill="#FBBC05"
        d="M5.62 14.26a7.06 7.06 0 0 1 0-4.52L2.18 7.07a12 12 0 0 0 0 9.86l3.44-2.67z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.36-2.6c-.93.62-2.12 1-3.92 1-3 0-5.53-1.94-6.38-4.6l-3.44 2.67C3.99 20.53 7.7 23 12 23z"
      />
    </svg>
  );
}
