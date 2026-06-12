import type { Point } from "@/shared/types";
import {
  DEFAULT_GRID_RENDER_METRICS,
  type GridRenderMetrics,
} from "./renderMetrics";

export type ViewportState = {
  offset: Point;
  zoom: number;
};

export const screenToGrid = (
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
): Point => {
  return {
    x: Math.floor((screenX - viewport.offset.x) / (metrics.cellWidth * viewport.zoom)),
    y: Math.floor((screenY - viewport.offset.y) / (metrics.cellHeight * viewport.zoom)),
  };
};

export const gridToScreen = (
  gridX: number,
  gridY: number,
  viewport: ViewportState,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
): Point => {
  return {
    x: gridX * metrics.cellWidth * viewport.zoom + viewport.offset.x,
    y: gridY * metrics.cellHeight * viewport.zoom + viewport.offset.y,
  };
};

export const getViewportGridBounds = (
  width: number,
  height: number,
  viewport: ViewportState,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
) => {
  const sw = metrics.cellWidth * viewport.zoom;
  const sh = metrics.cellHeight * viewport.zoom;
  return {
    startX: Math.floor(-viewport.offset.x / sw),
    endX: Math.ceil((width - viewport.offset.x) / sw),
    startY: Math.floor(-viewport.offset.y / sh),
    endY: Math.ceil((height - viewport.offset.y) / sh),
  };
};

export const gridCellRect = (
  point: Point,
  viewport: ViewportState,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
) => {
  const pos = gridToScreen(point.x, point.y, viewport, metrics);
  return {
    x: pos.x,
    y: pos.y,
    width: metrics.cellWidth * viewport.zoom,
    height: metrics.cellHeight * viewport.zoom,
  };
};
