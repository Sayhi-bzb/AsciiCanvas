import { useEffect, useRef } from "react";
import type {
  StructuredTemplatePreview,
} from "@/domains/structured-content/public";
import { cn } from "@/shared/lib/utils";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawCellBackground,
  drawCellText,
  prepareCanvasSurface,
} from "@/shared/metrics";
import type { GridCell } from "@/shared/types";

type StructuredTemplatePreviewGridProps = {
  preview: StructuredTemplatePreview;
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
  className?: string;
};

export function StructuredTemplatePreviewGrid({
  preview,
  cellWidth,
  cellHeight,
  fontSize,
  className,
}: StructuredTemplatePreviewGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const width = preview.width * cellWidth;
  const height = preview.height * cellHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || preview.width === 0 || preview.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const metrics = {
      ...DEFAULT_GRID_RENDER_METRICS,
      cellWidth,
      cellHeight,
      fontSize,
    };
    const toGridCell = (
      cell: StructuredTemplatePreview["rows"][number][number]
    ): GridCell => ({
      char: cell.char,
      color: cell.color ?? "#000000",
      bgColor: cell.bgColor,
      attrs: cell.attrs,
    });

    prepareCanvasSurface(canvas, ctx, width, height, dpr);
    preview.rows.forEach((row, y) => {
      row.forEach((cell, x) => {
        drawCellBackground(ctx, toGridCell(cell), x * cellWidth, y * cellHeight, {
          metrics,
        });
      });
    });
    preview.rows.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.char === " " && !cell.attrs) return;
        drawCellText(ctx, toGridCell(cell), x * cellWidth, y * cellHeight, {
          metrics,
        });
      });
    });
  }, [cellHeight, cellWidth, fontSize, height, preview, width]);

  if (preview.width === 0 || preview.height === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="structured-template-preview-grid"
      className={cn("block font-mono", className)}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
      aria-hidden="true"
    />
  );
}
