import type { GridMap, Point } from "@/shared/types";
import type { CanvasLinkHit } from "../hooks/interaction/core/linkHitTesting";
import { GridManager } from "@/shared/utils/grid";
import {
  drawCellBackground,
  drawCellText,
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
  grid: GridMap | null,
  viewBounds: ViewBounds,
  zoom: number,
  offset: Point,
  options: DrawGridLayerOptions = {}
) => {
  if (!grid || grid.size === 0) return;
  const { alpha = 1, hoveredLink = null } = options;

  ctx.save();
  ctx.globalAlpha = alpha;
  setTextRenderStyle(ctx, zoom);

  for (let y = viewBounds.startY; y <= viewBounds.endY; y++) {
    for (let x = viewBounds.startX; x <= viewBounds.endX; x++) {
      const cell = grid.get(GridManager.toKey(x, y));
      if (!cell) continue;
      const style = effectiveCellStyle(cell);
      if (cell.char === " " && !style.bgColor && !style.attrs) continue;
      const pos = GridManager.gridToScreen(x, y, offset.x, offset.y, zoom);
      drawCellBackground(ctx, cell, pos.x, pos.y, { zoom });
    }
  }

  for (let y = viewBounds.startY; y <= viewBounds.endY; y++) {
    for (let x = viewBounds.startX; x <= viewBounds.endX; x++) {
      const cell = grid.get(GridManager.toKey(x, y));
      if (!cell) continue;
      const style = effectiveCellStyle(cell);
      if (cell.char === " " && !style.attrs) continue;
      const pos = GridManager.gridToScreen(x, y, offset.x, offset.y, zoom);
      drawCellText(ctx, cell, pos.x, pos.y, {
        zoom,
        underline:
          !!cell.href &&
          !!hoveredLink &&
          hoveredLink.href === cell.href &&
          hoveredLink.y === y &&
          x >= hoveredLink.startX &&
          x <= hoveredLink.endX,
      });
    }
  }
  ctx.restore();
};
