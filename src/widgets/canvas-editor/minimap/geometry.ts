import type { GridMap } from "@/shared/types";
import type {
  MinimapDimensions,
  MinimapMeta,
  MinimapPoint,
  ViewportRect,
} from "./types";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";

const INVALID_META: MinimapMeta = {
  valid: false,
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
  contentWidth: 0,
  contentHeight: 0,
  scale: 0,
  originX: 0,
  originY: 0,
  contentRect: { x: 0, y: 0, width: 0, height: 0 },
};

const hasVisibleContent = (cell: {
  char?: string;
  bgColor?: string;
}) => {
  if (cell.bgColor && cell.bgColor !== "transparent") return true;
  return !!cell.char && cell.char !== " ";
};

const computeVisibleContentBounds = (grid: GridMap) => {
  if (!grid || grid.size === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  GridManager.iterate(grid, (cell, x, y) => {
    if (!hasVisibleContent(cell)) return;
    const occupancy = Math.max(GridManager.getCharWidth(cell.char), 1);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + occupancy - 1);
    maxY = Math.max(maxY, y);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  return {
    minX,
    minY,
    maxX,
    maxY,
    contentWidth: (maxX - minX + 1) * cellWidth,
    contentHeight: (maxY - minY + 1) * cellHeight,
  };
};

export const computeMinimapDimensions = (
  grid: GridMap,
  maxSize: number,
  minSize: number,
  padding: number
): MinimapDimensions => {
  const bounds = computeVisibleContentBounds(grid);
  if (!bounds) return { width: minSize, height: minSize };

  const drawableMax = Math.max(maxSize - padding * 2, 1);
  const aspectRatio = bounds.contentWidth / bounds.contentHeight;
  if (aspectRatio >= 1) {
    return {
      width: maxSize,
      height: Math.max(
        minSize,
        Math.min(maxSize, Math.round(drawableMax / aspectRatio + padding * 2))
      ),
    };
  }

  return {
    width: Math.max(
      minSize,
      Math.min(maxSize, Math.round(drawableMax * aspectRatio + padding * 2))
    ),
    height: maxSize,
  };
};

export const computeMinimapMeta = (
  grid: GridMap,
  dimensions: MinimapDimensions,
  padding: number
): MinimapMeta => {
  const bounds = computeVisibleContentBounds(grid);
  if (!bounds) return INVALID_META;

  const { minX, minY, maxX, maxY, contentWidth, contentHeight } = bounds;
  const drawableWidth = Math.max(dimensions.width - padding * 2, 1);
  const drawableHeight = Math.max(dimensions.height - padding * 2, 1);
  const scale = Math.max(
    Math.min(drawableWidth / contentWidth, drawableHeight / contentHeight),
    Number.EPSILON
  );
  const renderedWidth = contentWidth * scale;
  const renderedHeight = contentHeight * scale;
  const originX = padding + (drawableWidth - renderedWidth) / 2;
  const originY = padding + (drawableHeight - renderedHeight) / 2;

  return {
    valid: true,
    minX,
    minY,
    maxX,
    maxY,
    contentWidth,
    contentHeight,
    scale,
    originX,
    originY,
    contentRect: {
      x: originX,
      y: originY,
      width: renderedWidth,
      height: renderedHeight,
    },
  };
};

export const minimapPointToGrid = (
  point: MinimapPoint,
  meta: MinimapMeta
) => {
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const clampedX = Math.min(
    Math.max(point.x, meta.contentRect.x),
    meta.contentRect.x + meta.contentRect.width
  );
  const clampedY = Math.min(
    Math.max(point.y, meta.contentRect.y),
    meta.contentRect.y + meta.contentRect.height
  );

  const gridX =
    (clampedX - meta.originX) / (meta.scale * cellWidth) + meta.minX;
  const gridY =
    (clampedY - meta.originY) / (meta.scale * cellHeight) + meta.minY;

  return {
    x: Math.min(Math.max(gridX, meta.minX), meta.maxX),
    y: Math.min(Math.max(gridY, meta.minY), meta.maxY),
  };
};

export const computeViewportRect = (
  offset: { x: number; y: number },
  zoom: number,
  containerSize: { width: number; height: number },
  meta: MinimapMeta
): ViewportRect => {
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  const viewportWorldX = -offset.x / zoom;
  const viewportWorldY = -offset.y / zoom;
  const contentWorldX = meta.minX * cellWidth;
  const contentWorldY = meta.minY * cellHeight;

  return {
    x: meta.originX + (viewportWorldX - contentWorldX) * meta.scale,
    y: meta.originY + (viewportWorldY - contentWorldY) * meta.scale,
    width: (containerSize.width / zoom) * meta.scale,
    height: (containerSize.height / zoom) * meta.scale,
  };
};

export const intersectViewportRect = (
  rect: ViewportRect,
  bounds: ViewportRect
): ViewportRect | null => {
  const left = Math.max(rect.x, bounds.x);
  const top = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);

  if (right <= left || bottom <= top) return null;

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
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
