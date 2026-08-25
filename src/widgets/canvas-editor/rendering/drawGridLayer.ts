import type { Point } from "@/shared/types";
import type { CanvasSurfaceReader } from "@/domains/canvas/public";
import type { CanvasLinkHit } from "../hooks/interaction/core/linkHitTesting";
import { GridManager } from "@/shared/utils/grid";
import {
  drawCellBatch,
  getCellOccupancy,
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

  const visibleCells: Parameters<typeof drawCellBatch>[1][number][] = [];
  const queryBounds = {
    x: viewBounds.startX,
    y: viewBounds.startY,
    width: viewBounds.endX - viewBounds.startX + 1,
    height: viewBounds.endY - viewBounds.startY + 1,
  };
  for (const span of reader.query(queryBounds)) {
    let x = span.x;
    for (const cell of span.cells) {
      const width = getCellOccupancy(cell.char);
      const style = cell.char === " " ? effectiveCellStyle(cell) : null;
      const drawBackground = cell.char !== " " || !!style?.bgColor || !!style?.attrs;
      const drawText = cell.char !== " " || !!style?.attrs;
      if (drawBackground || drawText) {
        const pos = GridManager.gridToScreen(
          x,
          span.y,
          offset.x,
          offset.y,
          zoom
        );
        visibleCells.push({
          cell,
          x: pos.x,
          y: pos.y,
          drawBackground,
          drawText,
          options: {
            zoom,
            underline:
              !!cell.href &&
              !!hoveredLink &&
              hoveredLink.href === cell.href &&
              hoveredLink.y === span.y &&
              x >= hoveredLink.startX &&
              x <= hoveredLink.endX,
          },
        });
      }
      x += width;
    }
  }

  drawCellBatch(ctx, visibleCells);
  ctx.restore();
};
