const ITEMS = [
  "TECHNICAL",
  "MANAGEMENT",
  "DESIGN & SOCIAL MEDIA",
  "RECRUITMENTS '26",
  "ZERO SPECTATORS",
  "INNOVATE",
  "LEAD",
  "BUILD",
];

function Row({ reverse = false, ariaHidden = false }: { reverse?: boolean; ariaHidden?: boolean }) {
  const content = [...ITEMS, ...ITEMS];
  return (
    <div className="flex overflow-hidden border-y border-border bg-card/40 py-2.5" aria-hidden={ariaHidden}>
      <div className={`marquee-track ${reverse ? "reverse" : ""}`}>
        {content.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="mx-5 inline-flex items-center gap-5 font-mono text-xs tracking-[0.3em] text-muted-foreground"
          >
            <span className={i % 4 === 0 ? "text-primary" : undefined}>{item}</span>
            <span className="text-primary/50">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Marquee() {
  return (
    <section aria-label="Domains ticker">
      <Row />
    </section>
  );
}
