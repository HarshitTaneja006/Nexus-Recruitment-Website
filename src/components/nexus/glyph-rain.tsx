"use client";

import { useEffect, useRef } from "react";

/**
 * Glyph rain backdrop — Nexus-style digital rain in the brand's
 * phosphor-blue palette. Fully local, pauses when the tab is hidden
 * and renders a single static frame for reduced-motion users.
 */
export function GlyphRain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const GLYPHS = "アイウエオカキクケコ01<>{}[]$#@=%*+-/\\|;:.^".split("");
    const FONT_SIZE = 14;
    let columns = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;
    const INTERVAL = 80;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.floor(parent.clientWidth / FONT_SIZE);
      drops = Array.from({ length: columns }, () =>
        Math.floor((Math.random() * parent.clientHeight) / FONT_SIZE)
      );
      if (reduced) drawFrame(true);
    };

    const drawFrame = (clear = false) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.fillStyle = "rgba(5, 8, 13, 0.14)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT_SIZE}px monospace`;
      for (let i = 0; i < columns; i++) {
        const char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;
        // head glyph brighter
        ctx.fillStyle = Math.random() > 0.975
          ? "rgba(147, 197, 253, 0.9)"
          : "rgba(96, 165, 250, 0.38)";
        ctx.fillText(char, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      if (clear) {
        ctx.fillStyle = "rgba(5, 8, 13, 0.55)";
        ctx.fillRect(0, 0, w, h);
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < INTERVAL) return;
      last = t;
      drawFrame();
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    if (reduced) {
      drawFrame(true);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_85%)] ${className ?? ""}`}
    />
  );
}
