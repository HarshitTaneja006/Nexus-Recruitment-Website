import Link from "next/link";
import Image from "next/image";
import { DRIVE } from "@/lib/drive";
import { DEPARTMENTS } from "@/lib/departments";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card/40">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="NEXUS Logo"
              width={24}
              height={24}
              className="h-6 w-6 rounded object-contain"
            />
            <p className="font-mono text-lg font-bold">
              NEXUS<span className="text-primary glow-text">_</span>
            </p>
          </div>
          <p className="mt-2 max-w-xs font-mono text-xs leading-relaxed text-muted-foreground">
            Student Tech Collective at VIT Chennai. One club, three
            departments, zero spectator mode.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">
            innovate ◆ lead ◆ build
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            $ ls domains/
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-xs">
            {DEPARTMENTS.map((d) => (
              <li key={d.id}>
                <Link
                  href="/#departments"
                  className="text-muted-foreground transition-colors hover:text-accent-foreground"
                >
                  d {d.dir}/ <span className="text-muted-foreground/50">- {d.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="font-mono text-xs text-muted-foreground">
          <p className="text-[10px] uppercase tracking-[0.25em]">SYS.INFO</p>
          <ul className="mt-3 space-y-1.5">
            <li>
              NODE: <span className="text-foreground">{DRIVE.node}</span>
            </li>
            <li>{DRIVE.coordinates}</li>
            <li>
              MAINFRAME:{" "}
              <a
                href="https://nexus.runs-on.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                nexus.runs-on.dev
              </a>
            </li>
            <li>
              STATS:{" "}
              <Link href="/stats" className="text-primary/80 hover:text-primary hover:underline">
                /stats
              </Link>{" "}
              <span className="text-muted-foreground/50">· core-gated · no-pii</span>
            </li>
            <li>
              REVIEW:{" "}
              <Link href="/review" className="text-primary/80 hover:text-primary hover:underline">
                /review
              </Link>{" "}
              <span className="text-muted-foreground/50">· core only</span>
            </li>
            <li className="ok-text flex items-center gap-2 pt-1">
              <span className="status-dot" aria-hidden="true" /> ALL SYSTEMS NOMINAL
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 font-mono text-[10px] text-muted-foreground sm:flex-row sm:px-6">
          <span>© 2026 NEXUS - VIT CHENNAI. ALL PROCESSING LOCAL.</span>
          <span>
            BUILD:{" "}
            <span className="text-primary">{DRIVE.label}</span> · CYCLE {DRIVE.cycle}
          </span>
        </div>
      </div>
    </footer>
  );
}
