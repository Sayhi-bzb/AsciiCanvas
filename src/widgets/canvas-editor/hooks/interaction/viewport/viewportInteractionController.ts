import type { CanvasMode, Point } from "@/shared/types";
import {
  resolveClampedZoom,
  resolveZoomAnchoredOffset,
} from "../core/coordinates";

type RafScheduler = {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
};

type OffsetSetter = (updater: (previous: Point) => Point) => void;
type ZoomSetter = (updater: (currentZoom: number) => number) => void;

const getDefaultRafScheduler = (): RafScheduler => ({
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
});

export type ViewportInteractionController = {
  queueOffsetDelta: (dx: number, dy: number) => void;
  flushOffset: () => void;
  queueZoomDelta: (deltaZoom: number, mouseX: number, mouseY: number) => void;
  flushZoom: () => void;
  cancel: () => void;
};

export const createViewportInteractionController = ({
  setOffset,
  setZoom,
  getCanvasMode,
  zoomBounds,
  scheduler = getDefaultRafScheduler(),
}: {
  setOffset: OffsetSetter;
  setZoom: ZoomSetter;
  getCanvasMode: () => CanvasMode;
  zoomBounds: { min: number; max: number };
  scheduler?: RafScheduler;
}): ViewportInteractionController => {
  let queuedOffset: Point = { x: 0, y: 0 };
  let queuedOffsetRaf: number | null = null;
  let queuedZoom:
    | {
        deltaZoom: number;
        mouseX: number;
        mouseY: number;
      }
    | null = null;
  let queuedZoomRaf: number | null = null;

  const flushOffset = () => {
    if (queuedOffsetRaf !== null) {
      scheduler.cancelAnimationFrame(queuedOffsetRaf);
      queuedOffsetRaf = null;
    }
    const { x, y } = queuedOffset;
    if (x === 0 && y === 0) return;
    queuedOffset = { x: 0, y: 0 };
    setOffset((previous) => ({ x: previous.x + x, y: previous.y + y }));
  };

  const queueOffsetDelta = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    queuedOffset = {
      x: queuedOffset.x + dx,
      y: queuedOffset.y + dy,
    };
    if (queuedOffsetRaf !== null) return;
    queuedOffsetRaf = scheduler.requestAnimationFrame(() => {
      queuedOffsetRaf = null;
      const { x, y } = queuedOffset;
      if (x === 0 && y === 0) return;
      queuedOffset = { x: 0, y: 0 };
      setOffset((previous) => ({ x: previous.x + x, y: previous.y + y }));
    });
  };

  const flushZoom = () => {
    if (queuedZoomRaf !== null) {
      scheduler.cancelAnimationFrame(queuedZoomRaf);
      queuedZoomRaf = null;
    }
    const queued = queuedZoom;
    if (!queued) return;
    queuedZoom = null;

    setZoom((currentZoom) => {
      const nextZoom = resolveClampedZoom(currentZoom, queued.deltaZoom, {
        min: zoomBounds.min,
        max: zoomBounds.max,
      });
      if (nextZoom === currentZoom) return currentZoom;
      if (getCanvasMode() !== "animation") {
        setOffset((previous) =>
          resolveZoomAnchoredOffset({
            anchor: { x: queued.mouseX, y: queued.mouseY },
            previousOffset: previous,
            currentZoom,
            nextZoom,
          })
        );
      }
      return nextZoom;
    });
  };

  const queueZoomDelta = (
    deltaZoom: number,
    mouseX: number,
    mouseY: number
  ) => {
    if (deltaZoom <= 0 || deltaZoom === 1) return;
    queuedZoom = queuedZoom
      ? {
          deltaZoom: queuedZoom.deltaZoom * deltaZoom,
          mouseX,
          mouseY,
        }
      : { deltaZoom, mouseX, mouseY };
    if (queuedZoomRaf !== null) return;
    queuedZoomRaf = scheduler.requestAnimationFrame(() => {
      queuedZoomRaf = null;
      flushZoom();
    });
  };

  const cancel = () => {
    if (queuedOffsetRaf !== null) {
      scheduler.cancelAnimationFrame(queuedOffsetRaf);
      queuedOffsetRaf = null;
    }
    if (queuedZoomRaf !== null) {
      scheduler.cancelAnimationFrame(queuedZoomRaf);
      queuedZoomRaf = null;
    }
  };

  return {
    queueOffsetDelta,
    flushOffset,
    queueZoomDelta,
    flushZoom,
    cancel,
  };
};
