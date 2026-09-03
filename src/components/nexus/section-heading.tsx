import { cn } from "@/lib/utils";

export function SectionHeading({
  index,
  tag,
  title,
  subtitle,
  className,
}: {
  index: string;
  tag: string;
  title: React.ReactNode;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-10", className)}>
      <p className="section-tag">
        <span className="text-primary">{index}</span>
        <span className="text-muted-foreground">/</span>
        {tag}
      </p>
      <h2 className="mt-4 font-mono text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
