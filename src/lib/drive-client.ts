"use client";

import { useEffect, useState } from "react";
import { isDriveOpen } from "@/lib/drive";

/**
 * Client-side drive-open state with a preview override:
 * append `?preview=closed` to any URL to render the post-deadline UI
 * (landing CTA, apply lock, receipt "final" note) without waiting for
 * the real deadline. Server APIs always use the real clock.
 */
export function useDriveOpen(): boolean {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const read = () => {
      const preview =
        new URLSearchParams(window.location.search).get("preview") === "closed";
      setOpen(preview ? false : isDriveOpen());
    };
    const raf = requestAnimationFrame(read);
    window.addEventListener("popstate", read);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("popstate", read);
    };
  }, []);

  return open;
}
