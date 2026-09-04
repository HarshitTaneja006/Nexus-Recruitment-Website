import { cn } from "@/lib/utils";

/**
 * ANSI-shadow lettering. NOTE: the S is the real ANSI-shadow S (middle bar +
 * lower-right stub) - using the E glyph there rendered the wordmark as
 * "NEXUE", which is exactly what it looked like.
 */
export const NEXUS_ASCII = String.raw`███╗   ██╗███████╗██╗   ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗ ██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

export function AsciiLogo({ className }: { className?: string }) {
  return (
    <pre
      aria-label="NEXUS"
      role="img"
      className={cn(
        "select-none overflow-x-auto font-mono leading-[1.15] text-primary glow-text",
        "text-[7px] sm:text-[10px] md:text-[13px] lg:text-base",
        className
      )}
    >
      {NEXUS_ASCII}
    </pre>
  );
}
