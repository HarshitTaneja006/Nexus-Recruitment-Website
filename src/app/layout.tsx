import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BootSequence } from "@/components/nexus/boot-sequence";
import { SiteHeader } from "@/components/nexus/site-header";
import { SiteFooter } from "@/components/nexus/site-footer";
import { CommandPalette } from "@/components/nexus/command-palette";
import { ShortcutsOverlay } from "@/components/nexus/shortcuts-overlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexus.runs-on.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "NEXUS // RECRUITMENTS '26 — VIT Chennai",
  description:
    "Recruitment drive of NEXUS — the Student Tech Collective at VIT Chennai. Innovate. Lead. Build. Sign in with your VIT student email and apply to Technical, Management or Design and Social Media.",
  keywords: [
    "NEXUS",
    "VIT Chennai",
    "recruitments",
    "tech club",
    "technical",
    "management",
    "design",
    "social media",
  ],
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png" }
    ],
    apple: "/logo.png",
  },
  alternates: { canonical: "/" },
  openGraph: {
    title: "NEXUS // RECRUITMENTS '26",
    description:
      "One club, three departments, zero spectator mode. Applications are open for the Student Tech Collective at VIT Chennai.",
    url: "/",
    siteName: "NEXUS Recruitments '26",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/og.png",
        width: 1344,
        height: 768,
        alt: "NEXUS Recruitments '26 — terminal banner with ./initiate_application prompt",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS // RECRUITMENTS '26",
    description:
      "One club, three departments, zero spectator mode. Applications open for the Student Tech Collective at VIT Chennai.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05080d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-mono antialiased bg-background text-foreground`}
      >
        <BootSequence />
        <div className="crt-overlay" aria-hidden="true" />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:border focus:border-primary focus:bg-background focus:px-3 focus:py-2 focus:font-mono focus:text-xs focus:text-primary"
        >
          SKIP_TO_CONTENT
        </a>
        <div className="relative flex min-h-screen flex-col">
          <SiteHeader />
          <main id="main-content" className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        <Toaster theme="dark" position="bottom-right" closeButton />
        <CommandPalette />
        <ShortcutsOverlay />
      </body>
    </html>
  );
}
