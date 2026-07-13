"use client";

import { useEffect, useRef } from "react";
import type { GridMap } from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import {
  BACKGROUND_COLOR,
  GRID_COLOR,
  COLOR_PRIMARY_TEXT,
} from "@/shared/lib/constants";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawGridLines,
  drawTextCell,
  setTextRenderStyle,
} from "@/shared/metrics";

type ExportPreviewProps = {
  grid: GridMap;
  showGrid: boolean;
  showColor: boolean;
};

export function ExportPreview({ grid, showGrid, showColor }: ExportPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || grid.size === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { minX, maxX, minY, maxY } = GridManager.getGridBounds(grid);
    const padding = 2;
    const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
    const contentWidth = (maxX - minX + 1 + padding * 2) * cellWidth;
    const contentHeight = (maxY - minY + 1 + padding * 2) * cellHeight;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    const scale = Math.min(
      displayWidth / contentWidth,
      displayHeight / contentHeight
    );
    const offsetX = (displayWidth - contentWidth * scale) / 2;
    const offsetY = (displayHeight - contentHeight * scale) / 2;

    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (showGrid) {
      const gw = maxX - minX + 1 + padding * 2;
      const gh = maxY - minY + 1 + padding * 2;
      drawGridLines(ctx, {
        startX: 0,
        endX: gw,
        startY: 0,
        endY: gh,
        width: contentWidth,
        height: contentHeight,
        color: GRID_COLOR,
        lineWidth: 0.5,
      });
    }

    setTextRenderStyle(ctx);

    GridManager.iterate(grid, (cell, x, y) => {
      const drawX = (x - minX + padding) * cellWidth;
      const drawY = (y - minY + padding) * cellHeight;
      drawTextCell(ctx, cell, drawX, drawY, {
        color: showColor ? cell.color : COLOR_PRIMARY_TEXT,
      });
    });
    ctx.restore();
  }, [grid, showColor, showGrid]);

  return <canvas ref={canvasRef} className="w-full h-full rounded-lg" />;
}
