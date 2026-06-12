import { GridManager } from "@/shared/utils/grid";
import type { GridMap } from "@/shared/types";
import type { MinimapMeta, MinimapPoint, ViewportRect } from "./types";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";

export const computeMinimapMeta = (
  grid: GridMap,
  minimapSize: number,
  padding: number
): MinimapMeta => {
  if (!grid || grid.size === 0) {
    return {
      valid: false,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      contentWidth: 0,
      contentHeight: 0,
      scale: 0,
    };
  }

  const { minX, minY, maxX, maxY } = GridManager.getGridBounds(grid);
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const drawableSize = Math.max(minimapSize - padding * 2, 1);
  const scale = Math.max(
    Math.min(drawableSize / contentWidth, drawableSize / contentHeight),
    Number.EPSILON
  );

  return {
    valid: true,
    minX,
    minY,
    maxX,
    maxY,
    contentWidth,
    contentHeight,
    scale,
  };
};

export const minimapPointToGrid = (
  point: MinimapPoint,
  meta: MinimapMeta,
  padding: number
) => {
  return {
    x: (point.x - padding) / meta.scale + meta.minX,
    y: (point.y - padding) / meta.scale + meta.minY,
  };
};

export const computeViewportRect = (
  offset: { x: number; y: number },
  zoom: number,
  containerSize: { width: number; height: number },
  meta: MinimapMeta,
  padding: number
): ViewportRect => {
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const viewGridStartX = -offset.x / (cellWidth * zoom);
  const viewGridStartY = -offset.y / (cellHeight * zoom);
  const viewGridWidth = containerSize.width / (cellWidth * zoom);
  const viewGridHeight = containerSize.height / (cellHeight * zoom);

  return {
    x: (viewGridStartX - meta.minX) * meta.scale + padding,
    y: (viewGridStartY - meta.minY) * meta.scale + padding,
    width: viewGridWidth * meta.scale,
    height: viewGridHeight * meta.scale,
  };
};

export const clampViewportRect = (
  rect: ViewportRect,
  minimapSize: number
): ViewportRect => {
  const width = Math.max(1, Math.min(rect.width, minimapSize));
  const height = Math.max(1, Math.min(rect.height, minimapSize));
  const maxX = Math.max(minimapSize - width, 0);
  const maxY = Math.max(minimapSize - height, 0);

  return {
    x: Math.min(Math.max(rect.x, 0), maxX),
    y: Math.min(Math.max(rect.y, 0), maxY),
    width,
    height,
  };
};

export const isPointInViewport = (
  point: MinimapPoint,
  rect: ViewportRect,
  hitSlop = 0
) => {
  return (
    point.x >= rect.x - hitSlop &&
    point.x <= rect.x + rect.width + hitSlop &&
    point.y >= rect.y - hitSlop &&
    point.y <= rect.y + rect.height + hitSlop
  );
};
