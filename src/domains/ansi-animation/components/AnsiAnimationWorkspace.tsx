"use client";

import { useEffect, useMemo, useRef } from "react";
import { Code2, MonitorPlay } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { cn } from "@/shared/lib/utils";
import { DEFAULT_GRID_RENDER_METRICS, drawTextCell, setTextRenderStyle } from "@/shared/metrics";
import { renderAnsiAnimationDocument } from "../utils/ansi-buffer";

const FALLBACK_SCRIPT =
  "\u001b[38;2;94;234;212mANSI Animation\u001b[0m\n\n\u001b[3;1HWrite terminal sequences here.";

function AnsiPreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ansiAnimation = useCanvasStore((state) => state.ansiAnimation);
  const frame = useMemo(
    () =>
      ansiAnimation
        ? renderAnsiAnimationDocument(ansiAnimation)
        : { width: 80, height: 25, cells: [] },
    [ansiAnimation]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ansiAnimation) return;

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
    ctx.fillStyle = ansiAnimation.background;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
    const sourceWidth = frame.width * cellWidth;
    const sourceHeight = frame.height * cellHeight;
    const padding = 16;
    const scale = Math.min(
      (displayWidth - padding * 2) / sourceWidth,
      (displayHeight - padding * 2) / sourceHeight,
      1.4
    );
    const offsetX = (displayWidth - sourceWidth * scale) / 2;
    const offsetY = (displayHeight - sourceHeight * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.fillStyle = ansiAnimation.background;
    ctx.fillRect(0, 0, sourceWidth, sourceHeight);
    setTextRenderStyle(ctx);
    frame.cells.forEach(([key, cell]) => {
      const [x, y] = key.split(",").map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      drawTextCell(ctx, cell, x * cellWidth, y * cellHeight, {
        color: cell.color,
      });
    });
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, sourceWidth, sourceHeight);
    ctx.restore();
  }, [ansiAnimation, frame]);

  return (
    <div className="min-h-0 min-w-0 flex-1 rounded-lg border border-border bg-background">
      <canvas ref={canvasRef} className="h-full w-full rounded-lg" />
    </div>
  );
}

export function AnsiAnimationWorkspace() {
  const {
    ansiAnimation,
    setAnsiAnimationScript,
    updateAnsiAnimationDocument,
  } = useCanvasStore(
    useShallow((state) => ({
      ansiAnimation: state.ansiAnimation,
      setAnsiAnimationScript: state.setAnsiAnimationScript,
      updateAnsiAnimationDocument: state.updateAnsiAnimationDocument,
    }))
  );

  const script = ansiAnimation?.script ?? "";

  useEffect(() => {
    if (!ansiAnimation || ansiAnimation.script) return;
    setAnsiAnimationScript(FALLBACK_SCRIPT);
  }, [ansiAnimation, setAnsiAnimationScript]);

  if (!ansiAnimation) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
        No ANSI animation document is active.
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background pt-20 text-foreground">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-24 lg:grid-cols-[minmax(22rem,0.9fr)_minmax(28rem,1.1fr)]">
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Code2 className="size-4" />
              Script
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                aria-label="Width"
                inputMode="numeric"
                value={ansiAnimation.width}
                onChange={(event) =>
                  updateAnsiAnimationDocument({
                    width: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                  })
                }
                className="h-7 w-14 rounded-md border border-border bg-background px-2 text-right font-mono"
              />
              <span>x</span>
              <input
                aria-label="Height"
                inputMode="numeric"
                value={ansiAnimation.height}
                onChange={(event) =>
                  updateAnsiAnimationDocument({
                    height: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                  })
                }
                className="h-7 w-14 rounded-md border border-border bg-background px-2 text-right font-mono"
              />
            </div>
          </div>
          <textarea
            value={script}
            onChange={(event) => setAnsiAnimationScript(event.target.value)}
            spellCheck={false}
            className={cn(
              "min-h-0 flex-1 resize-none bg-background p-4 font-mono text-xs leading-relaxed outline-none",
              "selection:bg-primary selection:text-primary-foreground"
            )}
          />
        </section>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <MonitorPlay className="size-4" />
              Preview
            </div>
            <div className="text-[11px] text-muted-foreground">
              {ansiAnimation.width} x {ansiAnimation.height} · {ansiAnimation.fps} FPS
            </div>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <AnsiPreviewCanvas />
          </div>
        </section>
      </div>
    </div>
  );
}
