"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Repeat } from "lucide-react";
import type { AnimationCanvasSize, AnimationTimeline, GridCell } from "@/shared/types";
import {
  BACKGROUND_COLOR,
  COLOR_PRIMARY_TEXT,
} from "@/shared/lib/constants";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { getAnimationFrameDelayMs } from "@/domains/animation/public";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawTextCell,
  setTextRenderStyle,
} from "@/shared/metrics";

type AnimationExportPreviewProps = {
  size: AnimationCanvasSize;
  timeline: AnimationTimeline;
  showColor?: boolean;
};

const PREVIEW_PADDING = 12;

export function AnimationExportPreview({
  size,
  timeline,
  showColor = true,
}: AnimationExportPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const currentFrame = timeline.frames[frameIndex] ?? timeline.frames[0];
  const frameCount = timeline.frames.length;

  const frameMap = useMemo(() => {
    return new Map<string, GridCell>(currentFrame?.grid ?? []);
  }, [currentFrame]);

  useEffect(() => {
    const resetId = window.requestAnimationFrame(() => {
      setFrameIndex(0);
      setIsPlaying(true);
    });
    return () => window.cancelAnimationFrame(resetId);
  }, [timeline]);

  useEffect(() => {
    if (!isPlaying || frameCount <= 1) return;

    const delay = getAnimationFrameDelayMs(timeline.fps);
    const timerId = window.setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next < frameCount) return next;
        if (timeline.loop) return 0;
        setIsPlaying(false);
        return frameCount - 1;
      });
    }, delay);

    return () => window.clearInterval(timerId);
  }, [frameCount, isPlaying, timeline.fps, timeline.loop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (!displayWidth || !displayHeight) return;

    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
    const sourceWidth = size.width * cellWidth;
    const sourceHeight = size.height * cellHeight;
    const scale = Math.min(
      (displayWidth - PREVIEW_PADDING * 2) / sourceWidth,
      (displayHeight - PREVIEW_PADDING * 2) / sourceHeight
    );
    const offsetX = (displayWidth - sourceWidth * scale) / 2;
    const offsetY = (displayHeight - sourceHeight * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, sourceWidth, sourceHeight);
    setTextRenderStyle(ctx);

    frameMap.forEach((cell, key) => {
      const [x, y] = key.split(",").map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const drawX = x * cellWidth;
      const drawY = y * cellHeight;
      drawTextCell(ctx, cell, drawX, drawY, {
        color: showColor ? cell.color : COLOR_PRIMARY_TEXT,
      });
    });

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, sourceWidth, sourceHeight);
    ctx.restore();
  }, [frameMap, showColor, size.height, size.width]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            tone={isPlaying ? "primary" : "neutral"}
            size="sm"
            shape="square"
            className={cn(
              "size-7 shadow-none",
              !isPlaying && "bg-transparent hover:bg-accent/45"
            )}
            onClick={() => setIsPlaying((prev) => !prev)}
            aria-label={isPlaying ? "Pause preview" : "Play preview"}
          >
            {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            GIF Preview
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
          <span>
            {frameIndex + 1} / {frameCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat className="size-3.5" />
            {timeline.loop ? "Loop" : "Once"}
          </span>
          <span>{timeline.fps} FPS</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_58%)] p-3">
        <canvas ref={canvasRef} className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}
