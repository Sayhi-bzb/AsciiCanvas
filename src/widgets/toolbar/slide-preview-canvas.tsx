"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type { Slide } from "@/domains/slides/public";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import { drawSlideCanvas } from "./slide-canvas-renderer";

export function SlidePreviewCanvas({
  slide,
}: {
  slide: Slide;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
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
        slide,
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
  }, [resolvedTheme, slide]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="slide-preview-canvas"
      className="pointer-events-none absolute inset-0 block size-full"
    />
  );
}
