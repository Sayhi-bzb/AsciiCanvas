"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { Slide } from "@/domains/slides/public";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import { drawSlideCanvas } from "./slide-canvas-renderer";

export function SlidePreviewCanvas({
  slide,
  contentRevision = 0,
  loadGrid,
}: {
  slide: Slide;
  contentRevision?: number;
  loadGrid?: () => Slide["grid"];
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { rootMargin: "240px 0px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const defaultTextColor =
        getComputedStyle(document.body)
          .getPropertyValue("--foreground")
          .trim() || COLOR_PRIMARY_TEXT;
      drawSlideCanvas({
        canvas,
        slide: loadGrid ? { ...slide, grid: loadGrid() } : slide,
        size: slide.size,
        viewportWidth: width,
        viewportHeight: height,
        padding: 0,
        backdropColor: null,
        pageColor: null,
        defaultTextColor,
      });
    };

    render();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(render);
    observer?.observe(canvas);
    document.fonts?.addEventListener("loadingdone", render);

    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener("loadingdone", render);
    };
  }, [contentRevision, loadGrid, resolvedTheme, slide, visible]);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0">
      {visible ? (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          data-testid="slide-preview-canvas"
          className="block size-full"
        />
      ) : null}
    </div>
  );
}
