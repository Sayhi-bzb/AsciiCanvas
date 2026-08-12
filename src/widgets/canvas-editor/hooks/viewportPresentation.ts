import type { Point } from '@/shared/types';

export type CanvasViewport = {
  offset: Point;
  zoom: number;
};

type CanvasViewportTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

type CanvasViewportPresentationBounds = {
  width: number;
  height: number;
  overscan: number;
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

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const constrainCanvasViewportTransform = (
  transform: CanvasViewportTransform,
  bounds: CanvasViewportPresentationBounds
): CanvasViewportTransform | null => {
  const minimumTranslateX =
    bounds.width - transform.scale * (bounds.width + bounds.overscan);
  const maximumTranslateX = transform.scale * bounds.overscan;
  const minimumTranslateY =
    bounds.height - transform.scale * (bounds.height + bounds.overscan);
  const maximumTranslateY = transform.scale * bounds.overscan;

  if (
    minimumTranslateX > maximumTranslateX ||
    minimumTranslateY > maximumTranslateY
  ) {
    return null;
  }

  return {
    scale: transform.scale,
    translateX: clamp(
      transform.translateX,
      minimumTranslateX,
      maximumTranslateX
    ),
    translateY: clamp(
      transform.translateY,
      minimumTranslateY,
      maximumTranslateY
    ),
  };
};

export const resetCanvasViewportPresentation = (layer: HTMLDivElement | null) => {
  if (!layer) return;
  layer.style.transform = 'none';
};

export const applyCanvasViewportPresentation = (
  layer: HTMLDivElement | null,
  rendered: CanvasViewport | null,
  presented: CanvasViewport,
  bounds?: CanvasViewportPresentationBounds
) => {
  if (!layer || !rendered || rendered.zoom <= 0 || presented.zoom <= 0) {
    resetCanvasViewportPresentation(layer);
    return;
  }

  const requestedTransform = resolveCanvasViewportTransform(rendered, presented);
  const transform = bounds
    ? constrainCanvasViewportTransform(requestedTransform, bounds)
    : requestedTransform;
  if (!transform) {
    resetCanvasViewportPresentation(layer);
    return;
  }
  const isIdentity =
    Math.abs(transform.scale - 1) <= TRANSFORM_EPSILON &&
    Math.abs(transform.translateX) <= TRANSFORM_EPSILON &&
    Math.abs(transform.translateY) <= TRANSFORM_EPSILON;

  layer.style.transform = isIdentity
    ? 'none'
    : `translate3d(${transform.translateX}px, ${transform.translateY}px, 0) scale(${transform.scale})`;
};
