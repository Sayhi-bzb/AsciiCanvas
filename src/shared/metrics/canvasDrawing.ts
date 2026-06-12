import type { GridCell } from "@/shared/types";
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
  const anchor = getTextCellAnchor(x, y, cell.char, zoom, metrics);
  ctx.fillStyle = options?.color ?? cell.color;
  ctx.fillText(cell.char, Math.round(anchor.x), Math.round(anchor.y));
};

export const getCellTextOffset = (
  char: string,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
) => {
  return getCellOccupancy(char) > 1 ? metrics.cellWidth : metrics.cellWidth / 2;
};
