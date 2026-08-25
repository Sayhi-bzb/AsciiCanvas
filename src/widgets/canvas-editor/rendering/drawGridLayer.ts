import type { Point } from "@/shared/types";
import type { CanvasSurfaceReader } from "@/domains/canvas/public";
import type { CanvasLinkHit } from "../hooks/interaction/core/linkHitTesting";
import { GridManager } from "@/shared/utils/grid";
import {
  drawCellBatch,
  setTextRenderStyle,
} from "@/shared/metrics";
import { effectiveCellStyle } from "@/shared/utils/ansi";

type ViewBounds = ReturnType<typeof GridManager.getViewportGridBounds>;

type DrawGridLayerOptions = {
  alpha?: number;
  hoveredLink?: CanvasLinkHit | null;
};

export const drawGridLayer = (
  ctx: CanvasRenderingContext2D,
  reader: CanvasSurfaceReader | null,
  viewBounds: ViewBounds,
  zoom: number,
  offset: Point,
  options: DrawGridLayerOptions = {}
) => {
  if (!reader) return;
  const { alpha = 1, hoveredLink = null } = options;

  ctx.save();
  ctx.globalAlpha = alpha;
  setTextRenderStyle(ctx, zoom);

  const visibleCells = [] as Array<{
    x: number;
    y: number;
    cell: NonNullable<ReturnType<CanvasSurfaceReader["getCell"]>>;
    screenX: number;
    screenY: number;
    drawBackground: boolean;
    drawText: boolean;
  }>;
  for (let y = viewBounds.startY; y <= viewBounds.endY; y++) {
    for (let x = viewBounds.startX; x <= viewBounds.endX; x++) {
      const cell = reader.getCell({ x, y });
      if (!cell) continue;
      const style = effectiveCellStyle(cell);
      const drawBackground = cell.char !== " " || !!style.bgColor || !!style.attrs;
      const drawText = cell.char !== " " || !!style.attrs;
      if (!drawBackground && !drawText) continue;
      const pos = GridManager.gridToScreen(x, y, offset.x, offset.y, zoom);
      visibleCells.push({
        x,
        y,
        cell,
        screenX: pos.x,
        screenY: pos.y,
        drawBackground,
        drawText,
      });
    }
  }

  drawCellBatch(
    ctx,
    visibleCells.map(({ x, y, cell, screenX, screenY, drawBackground, drawText }) => ({
      cell,
      x: screenX,
      y: screenY,
      drawBackground,
      drawText,
      options: {
        zoom,
        underline:
          !!cell.href &&
          !!hoveredLink &&
          hoveredLink.href === cell.href &&
          hoveredLink.y === y &&
          x >= hoveredLink.startX &&
          x <= hoveredLink.endX,
      },
    }))
  );
  ctx.restore();
};
