"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Send,
  BarChart3,
  FolderOpen,
  Hash,
  FileQuestion,
  Workflow,
  Layers,
  Share2,
  Keyboard,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { openShortcuts } from "@/components/nexus/shortcuts-overlay";

export const PALETTE_EVENT = "nexus:open-palette";

/** Dispatch from anywhere (e.g. the header ⌘K chip) to open the palette. */
export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PALETTE_EVENT));
  }
}

/**
 * NEXUS command palette — ⌘K / Ctrl+K from anywhere on the portal.
 * Terminal-flavoured launcher for pages and landing sections. Selection
 * closes the palette before navigating so the dialog never fights the
 * scroll target.
 */
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, []);

  /** Close first, then navigate — in-page anchors scroll, others route. */
  const run = React.useCallback(
    (action: () => void) => {
      setOpen(false);
      requestAnimationFrame(action);
    },
    []
  );

  const go = React.useCallback(
    (href: string) => {
      run(() => {
        if (href.includes("#")) {
          const [path, hash] = href.split("#");
          if (pathname === path) {
            const el = document.getElementById(hash);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              return;
            }
          }
        }
        router.push(href);
      });
    },
    [pathname, router, run]
  );

  const share = React.useCallback(() => {
    run(() => {
      const url = window.location.origin;
      navigator.clipboard
        ?.writeText(url)
        .then(() => toast.success("LINK_COPIED", { description: `${url} — pass it on.` }))
        .catch(() => toast.error("CLIPBOARD_BLOCKED", { description: url }));
    });
  }, [run]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="$ nexus --run"
      description="Terminal command palette — jump to any page, section or domain"
      showCloseButton={false}
      className="overflow-hidden rounded-none border-primary/30 font-mono shadow-[0_0_80px_rgba(96,165,250,0.18)] sm:max-w-xl"
    >
      <div
        aria-hidden="true"
        className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-3 py-1.5 font-mono text-[9px] tracking-[0.25em] text-muted-foreground"
      >
        <span>NEXUS://RUNNER v26.9</span>
        <span className="flex items-center gap-1.5">
          <span className="status-dot" />
          READY
        </span>
      </div>
      <CommandInput placeholder="> type a command… (pages, sections, actions)" />
      <CommandList>
        <CommandEmpty>
          <span className="font-mono text-xs text-muted-foreground">
            command not found — try &quot;stats&quot;, &quot;apply&quot; or &quot;faq&quot;
          </span>
        </CommandEmpty>

        <CommandGroup heading="$ cd · pages">
          <PaletteItem icon={<Home />} label="home" hint="/" onRun={() => go("/")} />
          <PaletteItem
            icon={<Send />}
            label="initiate_application"
            hint="/apply"
            onRun={() => go("/apply")}
          />
          <PaletteItem
            icon={<BarChart3 />}
            label="live_stats"
            hint="/stats"
            onRun={() => go("/stats")}
          />
          <PaletteItem
            icon={<FolderOpen />}
            label="review_console"
            hint="/review · core only"
            onRun={() => go("/review")}
          />
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="$ jump · landing sections">
          <PaletteItem
            icon={<Hash />}
            label="cat manifesto.txt"
            hint="/#about"
            onRun={() => go("/#about")}
          />
          <PaletteItem
            icon={<Layers />}
            label="ls domains/"
            hint="/#departments"
            onRun={() => go("/#departments")}
          />
          <PaletteItem
            icon={<Workflow />}
            label="run pipeline --how"
            hint="/#process"
            onRun={() => go("/#process")}
          />
          <PaletteItem
            icon={<FileQuestion />}
            label="man faq"
            hint="/#faq"
            onRun={() => go("/#faq")}
          />
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="$ share">
          <PaletteItem
            icon={<Share2 />}
            label="copy_invite_link"
            hint="portal URL → clipboard"
            onRun={share}
          />
          <PaletteItem
            icon={<Keyboard />}
            label="man nexus_keys"
            hint="? · keyboard shortcuts"
            onRun={() =>
              run(() => {
                // palette must close before the man page opens
                requestAnimationFrame(openShortcuts);
              })
            }
          />
        </CommandGroup>
      </CommandList>

      <div
        aria-hidden="true"
        className="flex items-center justify-between border-t border-border/60 bg-secondary/30 px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] text-muted-foreground"
      >
        <span>
          <KeyCap>↑</KeyCap> <KeyCap>↓</KeyCap> navigate · <KeyCap>↵</KeyCap> run ·{" "}
          <KeyCap>?</KeyCap> keys · <KeyCap>esc</KeyCap> close
        </span>
        <span className="hidden sm:inline">
          <KeyCap>⌘</KeyCap>+<KeyCap>K</KeyCap> toggle
        </span>
      </div>
    </CommandDialog>
  );
}

function PaletteItem({
  icon,
  label,
  hint,
  onRun,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onRun: () => void;
}) {
  return (
    <CommandItem
      value={`${label} ${hint}`}
      onSelect={onRun}
      className="group rounded-none font-mono text-xs data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
    >
      <span className="text-primary/70 transition-colors group-data-[selected=true]:text-primary">
        {icon}
      </span>
      <span className="ml-1">{label}</span>
      <CommandShortcut className="text-[9px] tracking-widest text-muted-foreground/70">
        {hint}
      </CommandShortcut>
    </CommandItem>
  );
}

/** Tiny keyboard-key chip used in the palette footer. */
function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center border border-border bg-card px-1 py-px font-mono text-[9px] text-muted-foreground">
      {children}
    </kbd>
  );
}
