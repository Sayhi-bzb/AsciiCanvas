import { describe, expect, it, vi } from "vitest";
import { createViewportInteractionController } from "@/widgets/canvas-editor/hooks/interaction/viewport/viewportInteractionController";
import type { CanvasMode, Point } from "@/shared/types";

const createScheduler = () => {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  return {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      callbacks.delete(id);
    }),
    flush: () => {
      const queued = Array.from(callbacks.entries());
      callbacks.clear();
      queued.forEach(([, callback]) => callback(0));
    },
  };
};

describe("viewport interaction controller", () => {
  it("coalesces offset deltas into one RAF update", () => {
    const scheduler = createScheduler();
    let offset: Point = { x: 10, y: 20 };
    const controller = createViewportInteractionController({
      setOffset: (updater) => {
        offset = updater(offset);
      },
      setZoom: () => {},
      getCanvasMode: () => "freeform",
      zoomBounds: { min: 0.25, max: 4 },
      scheduler,
    });

    controller.queueOffsetDelta(2, -3);
    controller.queueOffsetDelta(5, 1);

    expect(scheduler.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(offset).toEqual({ x: 10, y: 20 });

    scheduler.flush();

    expect(offset).toEqual({ x: 17, y: 18 });
  });

  it("flushes queued offset immediately and cancels the pending RAF", () => {
    const scheduler = createScheduler();
    let offset: Point = { x: 0, y: 0 };
    const controller = createViewportInteractionController({
      setOffset: (updater) => {
        offset = updater(offset);
      },
      setZoom: () => {},
      getCanvasMode: () => "freeform",
      zoomBounds: { min: 0.25, max: 4 },
      scheduler,
    });

    controller.queueOffsetDelta(4, 6);
    controller.flushOffset();
    scheduler.flush();

    expect(scheduler.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(offset).toEqual({ x: 4, y: 6 });
  });

  it("coalesces zoom deltas and anchors offset outside animation mode", () => {
    const scheduler = createScheduler();
    let mode: CanvasMode = "freeform";
    let offset: Point = { x: 10, y: 20 };
    let zoom = 1;
    const controller = createViewportInteractionController({
      setOffset: (updater) => {
        offset = updater(offset);
      },
      setZoom: (updater) => {
        zoom = updater(zoom);
      },
      getCanvasMode: () => mode,
      zoomBounds: { min: 0.25, max: 4 },
      scheduler,
    });

    controller.queueZoomDelta(1.5, 100, 80);
    controller.queueZoomDelta(2, 120, 90);
    scheduler.flush();

    expect(zoom).toBe(3);
    expect(offset).toEqual({ x: -210, y: -120 });

    mode = "animation";
    controller.queueZoomDelta(2, 120, 90);
    scheduler.flush();

    expect(zoom).toBe(4);
    expect(offset).toEqual({ x: -210, y: -120 });
  });

  it("ignores no-op and invalid zoom deltas", () => {
    const scheduler = createScheduler();
    const controller = createViewportInteractionController({
      setOffset: () => {},
      setZoom: () => {
        throw new Error("setZoom should not be called");
      },
      getCanvasMode: () => "freeform",
      zoomBounds: { min: 0.25, max: 4 },
      scheduler,
    });

    controller.queueZoomDelta(1, 0, 0);
    controller.queueZoomDelta(0, 0, 0);

    expect(scheduler.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
