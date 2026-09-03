import type { Metadata } from "next";
import { getAuthSession, googleConfigured } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { SignInGate } from "@/components/nexus/sign-in-gate";
import { AdminDenied } from "@/components/nexus/admin-denied";
import { AdminDashboard } from "@/components/nexus/admin-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "REVIEW_CONSOLE // NEXUS Recruitments '26",
  robots: { index: false, follow: false },
};

export default async function ReviewPage() {
  const session = await getAuthSession();
  const email = session?.user?.email ?? null;

  if (!email) {
    return <SignInGate googleConfigured={googleConfigured} variant="admin" />;
  }
  if (!isAdminEmail(email)) {
    return <AdminDenied email={email} />;
  }

  return <AdminDashboard />;
}
