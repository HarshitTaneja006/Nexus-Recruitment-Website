import { SectionHeading } from "./section-heading";
import { DRIVE_DEADLINE } from "@/lib/drive";

const STEPS = [
  {
    num: "01",
    cmd: "./apply",
    title: "Authenticate & Compile Answers",
    body: "Sign in with Google using your VIT email (firstname.lastnameYYYY@vitstudent.ac.in). Name, year and email are derived automatically - you just pick a department, drop your WhatsApp number and answer.",
  },
  {
    num: "02",
    cmd: "./screen",
    title: "Department Review",
    body: "Department leads read every submission against your answers' depth, honesty and signal. Drafts save themselves - polish until the deadline.",
  },
  {
    num: "03",
    cmd: "./interview",
    title: "Talk Like A Builder",
    body: "A short technical + fit conversation with department seniors. Expect 'why', 'show me', and one curveball that tests how you think.",
  },
  {
    num: "04",
    cmd: "./onboard",
    title: "Ship In 60",
    body: "Accepted? You get a mentor, a repo, and one rule: ship something real in your first 60 days. Zero spectators.",
  },
];

export function Process() {
  const deadlineLabel = DRIVE_DEADLINE.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <section id="process" className="border-b border-border" aria-label="Recruitment process">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <SectionHeading
          index="03"
          tag="EXECUTION_PIPELINE"
          title={
            <>
              How the drive <span className="text-primary glow-soft">executes</span>
            </>
          }
          subtitle={`Applications close ${deadlineLabel} at 23:59 IST. The pipeline runs exactly as advertised - no ghosting, no black holes.`}
        />

        <ol className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.num}
              className="terminal-panel relative flex min-w-0 flex-col overflow-hidden p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-2xl font-bold text-primary/90 tabular-nums">
                  {step.num}
                </span>
                <span className="min-w-0 truncate border border-border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.15em] text-muted-foreground/70">
                  step {i + 1}/{STEPS.length}
                </span>
              </div>
              <p className="mt-3 font-mono text-xs text-primary">
                $ {step.cmd}
              </p>
              <h3 className="mt-1.5 break-words font-mono text-sm font-bold tracking-wide">
                {step.title}
              </h3>
              <p className="mt-2 flex-1 break-words font-sans text-[13px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 bg-background px-0.5 font-mono text-primary xl:inline"
                >
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
