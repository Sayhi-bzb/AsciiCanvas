import type { Point } from '@/shared/types';

export const CANVAS_OVERSCAN_PX = 128;

export type CanvasSurfaceGeometry = {
  viewportWidth: number;
  viewportHeight: number;
  width: number;
  height: number;
  left: number;
  top: number;
  overscan: number;
};

export const resolveCanvasSurfaceGeometry = (
  viewport: { width: number; height: number },
  overscan = CANVAS_OVERSCAN_PX
): CanvasSurfaceGeometry => ({
  viewportWidth: viewport.width,
  viewportHeight: viewport.height,
  width: viewport.width + overscan * 2,
  height: viewport.height + overscan * 2,
  left: -overscan,
  top: -overscan,
  overscan,
});

export const offsetCanvasViewportForSurface = (
  offset: Point,
  geometry: CanvasSurfaceGeometry
): Point => ({
  x: offset.x - geometry.left,
  y: offset.y - geometry.top,
});
