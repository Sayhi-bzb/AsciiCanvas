import type { Point } from "@/shared/types";
import { resolveZoomAnchoredOffset } from "../core/coordinates";

type CanvasPinchDecision =
  | {
      type: "zoom";
      currentZoom: number;
      nextZoom: number;
      anchor: Point;
      shouldAnchorOffset: boolean;
    }
  | { type: "none" };

export const resolveCanvasPinchDecision = ({
  pinchStartZoom,
  scale,
  currentZoom,
  anchor,
  zoomBounds,
}: {
  pinchStartZoom: number;
  scale: number;
  currentZoom: number;
  anchor: Point;
  zoomBounds: { min: number; max: number };
}): CanvasPinchDecision => {
  const nextZoom = Math.max(
    zoomBounds.min,
    Math.min(zoomBounds.max, pinchStartZoom * scale)
  );

  if (nextZoom === currentZoom) return { type: "none" };

  return {
    type: "zoom",
    currentZoom,
    nextZoom,
    anchor,
    shouldAnchorOffset: true,
  };
};

type CanvasPinchExecutor = {
  setZoom: (updater: (currentZoom: number) => number) => void;
  setOffset: (updater: (previousOffset: Point) => Point) => void;
};

export const createCanvasPinchExecutor = ({
  setZoom,
  setOffset,
}: CanvasPinchExecutor): CanvasPinchExecutor => ({
  setZoom,
  setOffset,
});

export const executeCanvasPinchDecision = (
  decision: CanvasPinchDecision,
  executor: CanvasPinchExecutor
): void => {
  if (decision.type === "none") return;

  executor.setZoom(() => decision.nextZoom);
  if (!decision.shouldAnchorOffset) return;

  executor.setOffset((previousOffset) =>
    resolveZoomAnchoredOffset({
      anchor: decision.anchor,
      previousOffset,
      currentZoom: decision.currentZoom,
      nextZoom: decision.nextZoom,
    })
  );
};
type CanvasPinchHandler = ({
  pinchStartZoom,
  scale,
  currentZoom,
  anchor,
  zoomBounds,
}: {
  pinchStartZoom: number;
  scale: number;
  currentZoom: number;
  anchor: Point;
  zoomBounds: { min: number; max: number };
}) => void;

export const createCanvasPinchHandler = ({
  executor,
}: {
  executor: CanvasPinchExecutor;
}): CanvasPinchHandler => ({
  pinchStartZoom,
  scale,
  currentZoom,
  anchor,
  zoomBounds,
}) =>
  executeCanvasPinchDecision(
    resolveCanvasPinchDecision({
      pinchStartZoom,
      scale,
      currentZoom,
      anchor,
      zoomBounds,
    }),
    executor
  );
export type CanvasPinchRouteHandler = ({
  pinchStartZoom,
  scale,
  currentZoom,
  origin,
  zoomBounds,
  preventDefault,
  resolveAnchor,
}: {
  pinchStartZoom: number;
  scale: number;
  currentZoom: number;
  origin: Point;
  zoomBounds: { min: number; max: number };
  preventDefault: () => void;
  resolveAnchor: (origin: Point) => Point | null;
}) => void;

export const createCanvasPinchRouteHandler = ({
  handler,
}: {
  handler: CanvasPinchHandler;
}): CanvasPinchRouteHandler =>
  ({
    pinchStartZoom,
    scale,
    currentZoom,
    origin,
    zoomBounds,
    preventDefault,
    resolveAnchor,
  }) => {
    preventDefault();
    const anchor = resolveAnchor(origin);
    if (!anchor) return;

    handler({
      pinchStartZoom,
      scale,
      currentZoom,
      anchor,
      zoomBounds,
    });
  };
