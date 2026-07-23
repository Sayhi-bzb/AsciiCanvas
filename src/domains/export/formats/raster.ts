import {
  BACKGROUND_COLOR,
  GRID_COLOR,
  COLOR_PRIMARY_TEXT,
} from "@/shared/lib/constants";
import type {
  GridMap,
  SelectionArea,
} from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import { getSelectionsBoundingBox } from "@/shared/utils/selection";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawGridLines,
  drawTextCell,
  setTextRenderStyle,
  loadRenderFonts,
} from "@/shared/metrics";

const MONOCHROME_EXPORT_COLOR = COLOR_PRIMARY_TEXT;
const resolveExportColor = (color: string, includeColor: boolean) => {
  return includeColor ? color : MONOCHROME_EXPORT_COLOR;
};

const getGridGraphemes = (grid: GridMap) =>
  Array.from(grid.values(), (cell) => cell.char);
export const createSelectionPngBlob = async (
  grid: GridMap,
  selections: SelectionArea[],
  showGrid: boolean = true,
  includeColor: boolean = true
) => {
  if (selections.length === 0) return null;
  await loadRenderFonts(getGridGraphemes(grid));

  const { minX, maxX, minY, maxY } = getSelectionsBoundingBox(selections);
  const padding = 1;

  const cols = maxX - minX + 1 + padding * 2;
  const rows = maxY - minY + 1 + padding * 2;

  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const width = cols * cellWidth;
  const height = rows * cellHeight;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (showGrid) {
    drawGridLines(ctx, {
      startX: 0,
      endX: cols,
      startY: 0,
      endY: rows,
      width,
      height,
      color: GRID_COLOR,
    });
  }

  setTextRenderStyle(ctx);

  for (let y = minY - padding; y <= maxY + padding; y++) {
    for (let x = minX - padding; x <= maxX + padding; x++) {
      const cell = grid.get(GridManager.toKey(x, y));
      if (!cell) continue;

      const drawX = (x - (minX - padding)) * cellWidth;
      const drawY = (y - (minY - padding)) * cellHeight;
      drawTextCell(ctx, cell, drawX, drawY, {
        color: resolveExportColor(cell.color, includeColor),
      });
    }
  }

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png", 1.0)
  );
};

export const createPngBlobFromGrid = async (
  grid: GridMap,
  showGrid: boolean = false,
  includeColor: boolean = true
) => {
  if (grid.size === 0) return null;
  await loadRenderFonts(getGridGraphemes(grid));
  const { minX, maxX, minY, maxY } = GridManager.getGridBounds(grid);
  const padding = 2;
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const width = (maxX - minX + 1 + padding * 2) * cellWidth;
  const height = (maxY - minY + 1 + padding * 2) * cellHeight;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  if (showGrid) {
    const gridWidth = maxX - minX + 1 + padding * 2;
    const gridHeight = maxY - minY + 1 + padding * 2;
    drawGridLines(ctx, {
      startX: 0,
      endX: gridWidth,
      startY: 0,
      endY: gridHeight,
      width,
      height,
      color: GRID_COLOR,
      lineWidth: 0.5,
    });
  }

  setTextRenderStyle(ctx);

  GridManager.iterate(grid, (cell, x, y) => {
    const drawX = (x - minX + padding) * cellWidth;
    const drawY = (y - minY + padding) * cellHeight;
    drawTextCell(ctx, cell, drawX, drawY, {
      color: resolveExportColor(cell.color, includeColor),
    });
  });

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png", 1.0)
  );
};
