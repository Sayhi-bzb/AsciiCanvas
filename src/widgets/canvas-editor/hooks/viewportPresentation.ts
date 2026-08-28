import type { Point } from '@/shared/types';
import type { CanvasRenderActivityMode } from '../engine/CanvasRenderActivity';

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

/** @internal */
export type CanvasViewportPresentationStatus =
  | 'identity'
  | 'presented'
  | 'constrained'
  | 'out-of-coverage'
  | 'unavailable';

export type CanvasViewportRenderSnapshot = {
  viewport: CanvasViewport;
  sceneInputs: readonly unknown[];
};

/** @internal */
export type CanvasViewportRenderDecision =
  | 'defer-pan'
  | 'defer-zoom'
  | 'rebase'
  | 'settled'
  | 'missing-baseline'
  | 'scene-change';

export class CanvasViewportRebaseGate {
  #pending = false;

  isPending(): boolean {
    return this.#pending;
  }

  request(
    status: CanvasViewportPresentationStatus,
    rebase: (() => void) | null
  ): boolean {
    if (
      (status !== 'constrained' && status !== 'out-of-coverage') ||
      this.#pending ||
      !rebase
    ) {
      return false;
    }
    this.#pending = true;
    rebase();
    return true;
  }

  complete(): void {
    this.#pending = false;
  }
}

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

export const resolveCanvasViewportRenderDecision = (
  rendered: CanvasViewportRenderSnapshot | null,
  presented: CanvasViewport,
  sceneInputs: readonly unknown[],
  mode: CanvasRenderActivityMode,
  forceRebase = false
): CanvasViewportRenderDecision => {
  if (forceRebase) return 'rebase';
  if (mode !== 'viewport-interaction') return 'settled';
  if (!rendered) return 'missing-baseline';
  if (
    rendered.sceneInputs.length !== sceneInputs.length ||
    !sceneInputs.every((input, index) => input === rendered.sceneInputs[index])
  ) return 'scene-change';
  return rendered.viewport.zoom === presented.zoom
    ? 'defer-pan'
    : 'defer-zoom';
};

export const shouldDeferCanvasViewportRender = (
  rendered: CanvasViewportRenderSnapshot | null,
  presented: CanvasViewport,
  sceneInputs: readonly unknown[],
  mode: CanvasRenderActivityMode,
  forceRebase = false
) => {
  const decision = resolveCanvasViewportRenderDecision(
    rendered,
    presented,
    sceneInputs,
    mode,
    forceRebase
  );
  return decision === 'defer-pan' || decision === 'defer-zoom';
};

export const applyCanvasViewportPresentation = (
  layer: HTMLDivElement | null,
  rendered: CanvasViewport | null,
  presented: CanvasViewport,
  bounds?: CanvasViewportPresentationBounds
): CanvasViewportPresentationStatus => {
  if (!layer || !rendered || rendered.zoom <= 0 || presented.zoom <= 0) {
    resetCanvasViewportPresentation(layer);
    return 'unavailable';
  }

  const requestedTransform = resolveCanvasViewportTransform(rendered, presented);
  const constrainedTransform = bounds
    ? constrainCanvasViewportTransform(requestedTransform, bounds)
    : requestedTransform;
  if (!constrainedTransform) {
    return 'out-of-coverage';
  }
  const transform = constrainedTransform;
  const isIdentity =
    Math.abs(transform.scale - 1) <= TRANSFORM_EPSILON &&
    Math.abs(transform.translateX) <= TRANSFORM_EPSILON &&
    Math.abs(transform.translateY) <= TRANSFORM_EPSILON;

  layer.style.transform = isIdentity
    ? 'none'
    : `translate3d(${transform.translateX}px, ${transform.translateY}px, 0) scale(${transform.scale})`;
  if (isIdentity) return 'identity';
  const constrained =
    constrainedTransform.translateX !== requestedTransform.translateX ||
    constrainedTransform.translateY !== requestedTransform.translateY;
  return constrained ? 'constrained' : 'presented';
};
