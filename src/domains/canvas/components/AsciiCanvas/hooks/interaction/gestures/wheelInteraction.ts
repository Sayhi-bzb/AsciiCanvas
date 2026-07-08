import type { CanvasMode, Point } from "@/shared/types";

export type CanvasWheelDecision =
  | {
      type: "zoom";
      deltaZoom: number;
      anchor: Point;
    }
  | {
      type: "pan";
      delta: Point;
    }
  | { type: "none" };

export const resolveCanvasWheelDecision = ({
  isCtrlOrMetaPressed,
  canvasMode,
  deltaX,
  deltaY,
  shiftKey,
  anchor,
  zoomWeight = 0.002,
}: {
  isCtrlOrMetaPressed: boolean;
  canvasMode: CanvasMode;
  deltaX: number;
  deltaY: number;
  shiftKey: boolean;
  anchor: Point;
  zoomWeight?: number;
}): CanvasWheelDecision => {
  if (isCtrlOrMetaPressed) {
    return {
      type: "zoom",
      deltaZoom: 1 - deltaY * zoomWeight,
      anchor,
    };
  }

  if (canvasMode === "animation") return { type: "none" };

  const effectiveDeltaX =
    shiftKey && deltaX === 0 && deltaY !== 0 ? deltaY : deltaX;
  const effectiveDeltaY =
    shiftKey && deltaX === 0 && deltaY !== 0 ? 0 : deltaY;

  return {
    type: "pan",
    delta: {
      x: effectiveDeltaX === 0 ? 0 : -effectiveDeltaX,
      y: effectiveDeltaY === 0 ? 0 : -effectiveDeltaY,
    },
  };
};

export type CanvasWheelExecutor = {
  preventDefault: () => void;
  flushOffset: () => void;
  queueZoomDelta: (deltaZoom: number, mouseX: number, mouseY: number) => void;
  queueOffsetDelta: (dx: number, dy: number) => void;
};

export const createCanvasWheelExecutor = ({
  preventDefault,
  flushOffset,
  queueZoomDelta,
  queueOffsetDelta,
}: CanvasWheelExecutor): CanvasWheelExecutor => ({
  preventDefault,
  flushOffset,
  queueZoomDelta,
  queueOffsetDelta,
});

export const executeCanvasWheelDecision = (
  decision: CanvasWheelDecision,
  executor: CanvasWheelExecutor
): void => {
  switch (decision.type) {
    case "zoom":
      executor.preventDefault();
      executor.flushOffset();
      executor.queueZoomDelta(
        decision.deltaZoom,
        decision.anchor.x,
        decision.anchor.y
      );
      break;
    case "pan":
      executor.queueOffsetDelta(decision.delta.x, decision.delta.y);
      break;
    case "none":
      break;
  }
};
