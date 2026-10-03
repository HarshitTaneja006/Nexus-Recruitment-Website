import type { Metadata } from "next";
import { getAuthSession, googleConfigured } from "@/lib/auth";
import { isValidVitEmail } from "@/lib/vit";
import { isAdminEmail } from "@/lib/admin";
import { SignInGate } from "@/components/nexus/sign-in-gate";
import { NonVitPanel } from "@/components/nexus/non-vit-panel";
import { Round1Client } from "@/components/nexus/round1-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ROUND_1 // NEXUS Recruitments '26",
  description:
    "Technical Round 1 project screen - read the brief and submit your GitHub, report and deploy links before the deadline.",
  robots: { index: false, follow: false },
};

export default async function Round1Page() {
  const session = await getAuthSession();
  const email = session?.user?.email ?? null;

  if (!session || !email) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <SignInGate googleConfigured={googleConfigured} />
      </main>
    );
  }
  if (!isValidVitEmail(email)) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <NonVitPanel email={email} />
      </main>
    );
  }
  if (isAdminEmail(email)) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <section className="terminal-panel" aria-label="Admin notice">
          <div className="border-b border-border bg-secondary/50 px-4 py-2">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
              $ round1 --project
            </span>
          </div>
          <p className="p-6 font-mono text-xs leading-relaxed text-muted-foreground">
            Core accounts don&apos;t have a Round 1 screen - open the review
            console (/review) to manage deadlines and submissions.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Round1Client />
    </main>
  );
}
