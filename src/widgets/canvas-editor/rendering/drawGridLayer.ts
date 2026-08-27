import type { Point } from "@/shared/types";
import type { CanvasSurfaceReader } from "@/domains/canvas/public";
import type { CanvasLinkHit } from "../hooks/interaction/core/linkHitTesting";
import { GridManager } from "@/shared/utils/grid";
import {
  drawCellBatch,
  getCellOccupancy,
  setTextRenderStyle,
} from "@/shared/metrics";
import {
  getCanvasLodCell,
  resolveCanvasContentLod,
  type CanvasContentLod,
} from "./canvasLod";
import type { CharDeskCanvasContext } from "@chardesk/rendering/canvas";

type ViewBounds = ReturnType<typeof GridManager.getViewportGridBounds>;

type DrawGridLayerOptions = {
  alpha?: number;
  hoveredLink?: CanvasLinkHit | null;
  lod?: CanvasContentLod;
  content?: "all" | "background" | "text";
};

export type DrawGridLayerResult = {
  cells: number;
  glyphs: number;
};

export const drawGridLayer = (
  ctx: CharDeskCanvasContext,
  reader: CanvasSurfaceReader | null,
  viewBounds: ViewBounds,
  zoom: number,
  offset: Point,
  options: DrawGridLayerOptions = {}
): DrawGridLayerResult => {
  if (!reader) return { cells: 0, glyphs: 0 };
  const { alpha = 1, hoveredLink = null } = options;
  const content = options.content ?? "all";
  const lod = options.lod ?? resolveCanvasContentLod(zoom);

  ctx.save();
  ctx.globalAlpha = alpha;
  setTextRenderStyle(ctx, zoom);

  const visibleCells: Parameters<typeof drawCellBatch>[1][number][] = [];
  let glyphs = 0;
  const queryBounds = {
    x: viewBounds.startX - 1,
    y: viewBounds.startY,
    width: viewBounds.endX - viewBounds.startX + 2,
    height: viewBounds.endY - viewBounds.startY + 1,
  };
  for (const span of reader.query(queryBounds)) {
    let x = span.x;
    for (const cell of span.cells) {
      const width = getCellOccupancy(cell.char);
      const lodCell = getCanvasLodCell(cell, lod);
      const drawBackground = lodCell.drawBackground && content !== "text";
      const drawText = lodCell.drawText && content !== "background";
      const intersectsView =
        x + width > viewBounds.startX && x <= viewBounds.endX;
      if (intersectsView && (drawBackground || drawText)) {
        if (drawText) glyphs += 1;
        const pos = GridManager.gridToScreen(
          x,
          span.y,
          offset.x,
          offset.y,
          zoom
        );
        visibleCells.push({
          cell: lodCell.cell,
          x: pos.x,
          y: pos.y,
          drawBackground,
          drawText,
          options: {
            zoom,
            underline:
              lod === "full" &&
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
  return {
    cells: visibleCells.length,
    glyphs,
  };
};
