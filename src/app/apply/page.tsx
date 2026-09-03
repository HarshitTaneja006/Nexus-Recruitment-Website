import type { Metadata } from "next";
import { getAuthSession, googleConfigured } from "@/lib/auth";
import { isValidVitEmail, parseVitEmail } from "@/lib/vit";
import { isAdminEmail } from "@/lib/admin";
import { SignInGate } from "@/components/nexus/sign-in-gate";
import { NonVitPanel } from "@/components/nexus/non-vit-panel";
import { AdminBlockedApply } from "@/components/nexus/admin-blocked-apply";
import { ApplyClient } from "@/components/nexus/apply-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "INITIATE_APPLICATION // NEXUS Recruitments '26",
  description:
    "Sign in with your VIT student email and submit your application to NEXUS — Technical, Management or Design and Social Media.",
};

export default async function ApplyPage() {
  const session = await getAuthSession();
  const email = session?.user?.email ?? null;

  // 1. Not signed in → auth gate
  if (!session || !email) {
    return <SignInGate googleConfigured={googleConfigured} />;
  }

  // 2. Signed in with a non-VIT account → friendly lockout
  if (!isValidVitEmail(email)) {
    return <NonVitPanel email={email} />;
  }

  // 3. Core team has no business applying — redirect their energy
  if (isAdminEmail(email)) {
    return <AdminBlockedApply />;
  }

  // 4. Valid VIT identity (everything derived from the email)
  const profile = parseVitEmail(email)!;
  return <ApplyClient profile={profile} />;
}
