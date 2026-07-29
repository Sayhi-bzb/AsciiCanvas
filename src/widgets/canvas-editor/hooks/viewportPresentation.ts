import type { Point } from '@/shared/types';

export type CanvasViewport = {
  offset: Point;
  zoom: number;
};

export type CanvasViewportTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

const TRANSFORM_EPSILON = 0.000001;

export const resolveCanvasViewportTransform = (
  rendered: CanvasViewport,
  presented: CanvasViewport
): CanvasViewportTransform => {
  const scale = presented.zoom / rendered.zoom;
  return {
    scale,
    translateX: presented.offset.x - rendered.offset.x * scale,
    translateY: presented.offset.y - rendered.offset.y * scale,
  };
};

export const resetCanvasViewportPresentation = (layer: HTMLDivElement | null) => {
  if (!layer) return;
  layer.style.transform = 'none';
};

export const applyCanvasViewportPresentation = (
  layer: HTMLDivElement | null,
  rendered: CanvasViewport | null,
  presented: CanvasViewport
) => {
  if (!layer || !rendered || rendered.zoom <= 0 || presented.zoom <= 0) {
    resetCanvasViewportPresentation(layer);
    return;
  }

  const transform = resolveCanvasViewportTransform(rendered, presented);
  const isIdentity =
    Math.abs(transform.scale - 1) <= TRANSFORM_EPSILON &&
    Math.abs(transform.translateX) <= TRANSFORM_EPSILON &&
    Math.abs(transform.translateY) <= TRANSFORM_EPSILON;

  layer.style.transform = isIdentity
    ? 'none'
    : `translate3d(${transform.translateX}px, ${transform.translateY}px, 0) scale(${transform.scale})`;
};
