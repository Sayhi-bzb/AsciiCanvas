import type { GridMap, Point } from "@/shared/types";
import type { AnimationCanvasSize } from "@/domains/animation/public";
import {
  GridManager } from "@/shared/utils/grid";
import {
  clampPointToBounds
} from "@/domains/animation/public";
import {
  isPointWithinBounds
} from "@/domains/animation/public";

type CanvasModeForCoordinates = "freeform" | "structured" | "animation";

export interface CanvasViewport {
  offset: Point;
  zoom: number;
}

interface CanvasScreenPointInput {
  clientX: number;
  clientY: number;
  rect: Pick<DOMRect, "left" | "top">;
}

interface CanvasGridPointInput extends CanvasScreenPointInput {
  viewport: CanvasViewport;
}

interface CanvasSnappedGridPointInput extends CanvasGridPointInput {
  grid: GridMap;
  canvasMode: CanvasModeForCoordinates;
  canvasBounds: AnimationCanvasSize | null;
}

export const getLocalCanvasPoint = ({
  clientX,
  clientY,
  rect,
}: CanvasScreenPointInput): Point => ({
  x: clientX - rect.left,
  y: clientY - rect.top,
});

const resolveRawGridPointFromScreen = ({
  clientX,
  clientY,
  rect,
  viewport,
}: CanvasGridPointInput): Point => {
  const local = getLocalCanvasPoint({ clientX, clientY, rect });
  return GridManager.screenToGrid(
    local.x,
    local.y,
    viewport.offset.x,
    viewport.offset.y,
    viewport.zoom
  );
};

export const resolveSnappedGridPointFromScreen = (
  input: CanvasSnappedGridPointInput
): Point => {
  const raw = resolveRawGridPointFromScreen(input);
  const snapped = GridManager.snapToCharStart(raw, input.grid);
  return input.canvasMode === "animation"
    ? clampPointToBounds(snapped, input.canvasBounds)
    : snapped;
};

export const resolveAnimationAwareHoverGridPoint = (
  input: Omit<CanvasSnappedGridPointInput, "grid">
): Point | null => {
  const raw = resolveRawGridPointFromScreen(input);
  if (
    input.canvasMode === "animation" &&
    !isPointWithinBounds(raw, input.canvasBounds)
  ) {
    return null;
  }
  return input.canvasMode === "animation"
    ? clampPointToBounds(raw, input.canvasBounds)
    : raw;
};

export const resolveClampedZoom = (
  currentZoom: number,
  deltaZoom: number,
  limits: { min: number; max: number }
) => Math.max(limits.min, Math.min(limits.max, currentZoom * deltaZoom));

export const resolveZoomAnchoredOffset = ({
  anchor,
  previousOffset,
  currentZoom,
  nextZoom,
}: {
  anchor: Point;
  previousOffset: Point;
  currentZoom: number;
  nextZoom: number;
}): Point => {
  const actualScale = nextZoom / currentZoom;
  return {
    x: anchor.x - (anchor.x - previousOffset.x) * actualScale,
    y: anchor.y - (anchor.y - previousOffset.y) * actualScale,
  };
};
