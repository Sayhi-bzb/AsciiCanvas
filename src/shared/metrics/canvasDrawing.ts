import type { GridCell } from "@/shared/types";
import { effectiveCellStyle } from "@/shared/utils/ansi";
import { getCellOccupancy } from "./cellOccupancy";
import { resolveRenderFontRoute, type RenderFontRoute } from "./fontRouting";
import {
  alignCanvasCoordinate,
  DEFAULT_GRID_RENDER_METRICS,
  getCanvasFont,
  getTextCellAnchor,
  type GridRenderMetrics,
} from "./renderMetrics";

export type ResolvedCellVisual = {
  char: string;
  color: string;
  bgColor?: string;
  attrs: GridCell["attrs"];
  occupancy: number;
  fontRoute: RenderFontRoute;
};

export type CanvasCellDrawOptions = {
  color?: string;
  underline?: boolean;
  zoom?: number;
  metrics?: GridRenderMetrics;
};

export type CanvasCellDrawEntry = {
  cell: GridCell;
  x: number;
  y: number;
  options?: CanvasCellDrawOptions;
  drawBackground?: boolean;
  drawText?: boolean;
};

export const resolveCellVisual = (cell: GridCell): ResolvedCellVisual => {
  const style = effectiveCellStyle(cell);
  return {
    char: cell.char,
    color: style.color,
    bgColor: style.bgColor,
    attrs: style.attrs,
    occupancy: getCellOccupancy(cell.char),
    fontRoute: resolveRenderFontRoute(cell.char),
  };
};

export const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  options: {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
    offsetX?: number;
    offsetY?: number;
    width: number;
    height: number;
    zoom?: number;
    color: string;
    lineWidth?: number;
    metrics?: GridRenderMetrics;
  }
) => {
  const {
    startX,
    endX,
    startY,
    endY,
    offsetX = 0,
    offsetY = 0,
    width,
    height,
    zoom = 1,
    color,
    lineWidth = 1,
    metrics = DEFAULT_GRID_RENDER_METRICS,
  } = options;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  for (let x = startX; x <= endX; x++) {
    const posX = alignCanvasCoordinate(x * metrics.cellWidth * zoom + offsetX, lineWidth);
    ctx.moveTo(posX, 0);
    ctx.lineTo(posX, height);
  }
  for (let y = startY; y <= endY; y++) {
    const posY = alignCanvasCoordinate(y * metrics.cellHeight * zoom + offsetY, lineWidth);
    ctx.moveTo(0, posY);
    ctx.lineTo(width, posY);
  }
  ctx.stroke();
};

export const setTextRenderStyle = (
  ctx: CanvasRenderingContext2D,
  zoom = 1,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
) => {
  ctx.font = getCanvasFont(metrics, zoom);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
};

const drawResolvedCellBackground = (
  ctx: CanvasRenderingContext2D,
  visual: ResolvedCellVisual,
  x: number,
  y: number,
  options?: Pick<CanvasCellDrawOptions, "zoom" | "metrics">
) => {
  if (!visual.bgColor) return;
  const zoom = options?.zoom ?? 1;
  const metrics = options?.metrics ?? DEFAULT_GRID_RENDER_METRICS;
  const cellWidth = metrics.cellWidth * zoom;
  const cellHeight = metrics.cellHeight * zoom;
  const cellPixelWidth = cellWidth * visual.occupancy;
  ctx.fillStyle = visual.bgColor;
  ctx.fillRect(x, y, cellPixelWidth, cellHeight);
};

const drawResolvedCellText = (
  ctx: CanvasRenderingContext2D,
  visual: ResolvedCellVisual,
  x: number,
  y: number,
  options?: CanvasCellDrawOptions
) => {
  const zoom = options?.zoom ?? 1;
  const metrics = options?.metrics ?? DEFAULT_GRID_RENDER_METRICS;
  const anchor = getTextCellAnchor(x, y, visual.char, zoom, metrics);
  const cellWidth = metrics.cellWidth * zoom;
  const cellHeight = metrics.cellHeight * zoom;
  const cellPixelWidth = cellWidth * visual.occupancy;

  ctx.save();
  ctx.font = getCanvasFont(metrics, zoom, {
    bold: !!visual.attrs?.bold,
    italic: !!visual.attrs?.italic,
    route: visual.fontRoute,
  });
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = options?.color ?? visual.color;
  ctx.fillText(visual.char, Math.round(anchor.x), Math.round(anchor.y));

  const lineWidth = Math.max(1, Math.round(zoom));
  ctx.strokeStyle = options?.color ?? visual.color;
  ctx.lineWidth = lineWidth;
  if (visual.attrs?.underline || options?.underline) {
    const underlineY = alignCanvasCoordinate(y + cellHeight * 0.82, lineWidth);
    ctx.beginPath();
    ctx.moveTo(x, underlineY);
    ctx.lineTo(x + cellPixelWidth, underlineY);
    ctx.stroke();
  }
  if (visual.attrs?.strike) {
    const strikeY = alignCanvasCoordinate(y + cellHeight * 0.54, lineWidth);
    ctx.beginPath();
    ctx.moveTo(x, strikeY);
    ctx.lineTo(x + cellPixelWidth, strikeY);
    ctx.stroke();
  }
  ctx.restore();
};

export const drawTextCell = (
  ctx: CanvasRenderingContext2D,
  cell: GridCell,
  x: number,
  y: number,
  options?: CanvasCellDrawOptions
) => {
  const visual = resolveCellVisual(cell);
  drawResolvedCellBackground(ctx, visual, x, y, options);
  drawResolvedCellText(ctx, visual, x, y, options);
};

export const drawCellBackground = (
  ctx: CanvasRenderingContext2D,
  cell: GridCell,
  x: number,
  y: number,
  options?: Pick<CanvasCellDrawOptions, "zoom" | "metrics">
) => {
  drawResolvedCellBackground(ctx, resolveCellVisual(cell), x, y, options);
};

export const drawCellText = (
  ctx: CanvasRenderingContext2D,
  cell: GridCell,
  x: number,
  y: number,
  options?: CanvasCellDrawOptions
) => {
  drawResolvedCellText(ctx, resolveCellVisual(cell), x, y, options);
};

export const drawCellBatch = (
  ctx: CanvasRenderingContext2D,
  entries: readonly CanvasCellDrawEntry[]
) => {
  const plan = entries.map((entry) => ({
    ...entry,
    visual: resolveCellVisual(entry.cell),
  }));
  plan.forEach(({ visual, x, y, options, drawBackground = true }) => {
    if (drawBackground) drawResolvedCellBackground(ctx, visual, x, y, options);
  });
  plan.forEach(({ visual, x, y, options, drawText = true }) => {
    if (drawText) drawResolvedCellText(ctx, visual, x, y, options);
  });
};
