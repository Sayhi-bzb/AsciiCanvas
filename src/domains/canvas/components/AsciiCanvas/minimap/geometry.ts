import { CELL_HEIGHT, CELL_WIDTH } from "@/shared/lib/constants";
import { GridManager } from "@/shared/utils/grid";
import type { GridMap } from "@/shared/types";
import type { MinimapMeta, MinimapPoint, ViewportRect } from "./types";

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
  const viewGridStartX = -offset.x / (CELL_WIDTH * zoom);
  const viewGridStartY = -offset.y / (CELL_HEIGHT * zoom);
  const viewGridWidth = containerSize.width / (CELL_WIDTH * zoom);
  const viewGridHeight = containerSize.height / (CELL_HEIGHT * zoom);

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
