"use client";

import { useEffect, useRef } from "react";
import type { Slide } from "@/domains/slides/public";
import { drawSlideCanvas } from "./slide-canvas-renderer";

export function SlidePreviewCanvas({
  slide,
}: {
  slide: Slide;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      const { width, height } = canvas.getBoundingClientRect();
      drawSlideCanvas({
        canvas,
        slide,
        size: slide.size,
        viewportWidth: width,
        viewportHeight: height,
        padding: 0,
        backdropColor: "#ffffff",
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
  }, [slide]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="slide-preview-canvas"
      className="pointer-events-none absolute inset-0 block size-full"
    />
  );
}
