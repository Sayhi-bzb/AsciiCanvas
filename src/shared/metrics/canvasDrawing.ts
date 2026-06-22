import type { GridCell } from "@/shared/types";
import { effectiveCellStyle } from "@/shared/utils/ansi";
import { getCellOccupancy } from "./cellOccupancy";
import {
  alignCanvasCoordinate,
  DEFAULT_GRID_RENDER_METRICS,
  getCanvasFont,
  getTextCellAnchor,
  type GridRenderMetrics,
} from "./renderMetrics";

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

export const drawTextCell = (
  ctx: CanvasRenderingContext2D,
  cell: GridCell,
  x: number,
  y: number,
  options?: {
    color?: string;
    zoom?: number;
    metrics?: GridRenderMetrics;
  }
) => {
  const zoom = options?.zoom ?? 1;
  const metrics = options?.metrics ?? DEFAULT_GRID_RENDER_METRICS;
  const style = effectiveCellStyle(cell);
  const anchor = getTextCellAnchor(x, y, cell.char, zoom, metrics);
  const cellWidth = metrics.cellWidth * zoom;
  const cellHeight = metrics.cellHeight * zoom;
  const cellPixelWidth = cellWidth * getCellOccupancy(cell.char);

  if (style.bgColor) {
    ctx.fillStyle = style.bgColor;
    ctx.fillRect(x, y, cellPixelWidth, cellHeight);
  }

  ctx.save();
  ctx.font = getCanvasFont(metrics, zoom, {
    bold: !!style.attrs?.bold,
    italic: !!style.attrs?.italic,
  });
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = options?.color ?? style.color;
  ctx.fillText(cell.char, Math.round(anchor.x), Math.round(anchor.y));

  const lineWidth = Math.max(1, Math.round(zoom));
  ctx.strokeStyle = options?.color ?? style.color;
  ctx.lineWidth = lineWidth;
  if (style.attrs?.underline) {
    const underlineY = alignCanvasCoordinate(y + cellHeight * 0.82, lineWidth);
    ctx.beginPath();
    ctx.moveTo(x, underlineY);
    ctx.lineTo(x + cellPixelWidth, underlineY);
    ctx.stroke();
  }
  if (style.attrs?.strike) {
    const strikeY = alignCanvasCoordinate(y + cellHeight * 0.54, lineWidth);
    ctx.beginPath();
    ctx.moveTo(x, strikeY);
    ctx.lineTo(x + cellPixelWidth, strikeY);
    ctx.stroke();
  }
  ctx.restore();
};

export const getCellTextOffset = (
  char: string,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
) => {
  return getCellOccupancy(char) > 1 ? metrics.cellWidth : metrics.cellWidth / 2;
};
