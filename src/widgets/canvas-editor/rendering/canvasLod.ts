import type { GridCell } from "@/shared/types";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import { effectiveCellStyle } from "@/shared/utils/ansi";

export type CanvasContentLod = "full" | "simplified" | "density";

export const resolveCanvasContentLod = (zoom: number): CanvasContentLod => {
  const cellWidth = DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom;
  if (cellWidth >= 8) return "full";
  if (cellWidth >= 3) return "simplified";
  return "density";
};

export const shouldDrawCanvasGrid = (zoom: number) =>
  DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom >= 4;

export const getCanvasLodCell = (
  cell: GridCell,
  lod: CanvasContentLod
): { cell: GridCell; drawBackground: boolean; drawText: boolean } => {
  const style = effectiveCellStyle(cell);
  if (lod === "density") {
    return {
      cell: {
        char: " ",
        color: style.color,
        bgColor: style.bgColor ?? style.color,
      },
      drawBackground: cell.char !== " " || !!style.bgColor || !!style.attrs,
      drawText: false,
    };
  }
  const drawBackground = cell.char !== " " || !!style.bgColor || !!style.attrs;
  const drawText = cell.char !== " " || !!style.attrs;
  if (lod === "full" || !cell.attrs?.underline && !cell.attrs?.strike) {
    return { cell, drawBackground, drawText };
  }
  const attrs = {
    ...(cell.attrs.bold ? { bold: true as const } : {}),
    ...(cell.attrs.italic ? { italic: true as const } : {}),
    ...(cell.attrs.inverse ? { inverse: true as const } : {}),
  };
  return {
    cell: {
      ...cell,
      ...(Object.keys(attrs).length > 0 ? { attrs } : { attrs: undefined }),
    },
    drawBackground,
    drawText,
  };
};
