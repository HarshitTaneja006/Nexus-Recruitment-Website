import { SectionHeading } from "./section-heading";

const PRINCIPLES = [
  {
    cmd: "BUILD_IN_PUBLIC",
    body: "Repos open, demos monthly. If it isn't shipped, it's a sketch.",
  },
  {
    cmd: "TEACH_FORWARD",
    body: "Every member mentors someone within a semester. Knowledge compounds.",
  },
  {
    cmd: "ZERO_SPECTATORS",
    body: "Everyone ships something in their first 60 days. That's the only rule.",
  },
];

export function Manifesto() {
  return (
    <section id="about" className="border-b border-border" aria-label="Manifesto">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <SectionHeading
          index="01"
          tag="MANIFESTO"
          title={
            <>
              Not a club. A <span className="text-primary glow-soft">compiler</span> for
              builders.
            </>
          }
          subtitle="NEXUS takes curious students in, runs them through workshops, hack nights and real project teams, and outputs engineers who can ship. The loop below is our operating system."
        />

        <div className="grid gap-px border border-border bg-border md:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <article
              key={p.cmd}
              className="group bg-card p-6 transition-colors hover:bg-secondary/70"
            >
              <p className="font-mono text-[10px] text-muted-foreground">
                0{i + 1} <span className="text-primary">$</span>
              </p>
              <h3 className="mt-2 font-mono text-base font-bold tracking-wider text-foreground group-hover:text-primary transition-colors">
                {p.cmd}
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
