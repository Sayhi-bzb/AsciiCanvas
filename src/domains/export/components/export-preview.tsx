"use client";

import { useEffect, useRef } from "react";
import type { GridMap } from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  FONT_SIZE,
  BACKGROUND_COLOR,
  GRID_COLOR,
  COLOR_PRIMARY_TEXT,
} from "@/shared/lib/constants";

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
    const contentWidth = (maxX - minX + 1 + padding * 2) * CELL_WIDTH;
    const contentHeight = (maxY - minY + 1 + padding * 2) * CELL_HEIGHT;

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
      ctx.beginPath();
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      const gw = maxX - minX + 1 + padding * 2;
      const gh = maxY - minY + 1 + padding * 2;
      for (let x = 0; x <= gw; x++) {
        ctx.moveTo(x * CELL_WIDTH, 0);
        ctx.lineTo(x * CELL_WIDTH, contentHeight);
      }
      for (let y = 0; y <= gh; y++) {
        ctx.moveTo(0, y * CELL_HEIGHT);
        ctx.lineTo(contentWidth, y * CELL_HEIGHT);
      }
      ctx.stroke();
    }

    ctx.font = `${FONT_SIZE}px 'Maple Mono NF CN', monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    GridManager.iterate(grid, (cell, x, y) => {
      const drawX = (x - minX + padding) * CELL_WIDTH;
      const drawY = (y - minY + padding) * CELL_HEIGHT;
      const wide = GridManager.isWideChar(cell.char);
      ctx.fillStyle = showColor ? cell.color : COLOR_PRIMARY_TEXT;
      ctx.fillText(
        cell.char,
        drawX + (wide ? CELL_WIDTH : CELL_WIDTH / 2),
        drawY + CELL_HEIGHT / 2
      );
    });
    ctx.restore();
  }, [grid, showColor, showGrid]);

  return <canvas ref={canvasRef} className="w-full h-full rounded-lg" />;
}
