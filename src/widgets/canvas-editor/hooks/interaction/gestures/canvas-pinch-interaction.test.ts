import { describe, expect, it, vi } from "vitest";
import {
  createCanvasPinchExecutor,
  createCanvasPinchHandler,
  createCanvasPinchRouteHandler,
  executeCanvasPinchDecision,
  resolveCanvasPinchDecision,
} from "@/widgets/canvas-editor/hooks/interaction/gestures/pinchInteraction";
import type { Point } from "@/shared/types";

describe("canvas pinch interaction", () => {
  it("resolves clamped pinch zoom from the gesture start zoom", () => {
    expect(
      resolveCanvasPinchDecision({
        pinchStartZoom: 2,
        scale: 3,
        currentZoom: 2,
        anchor: { x: 50, y: 40 },
        zoomBounds: { min: 0.25, max: 4 },
      })
    ).toEqual({
      type: "zoom",
      currentZoom: 2,
      nextZoom: 4,
      anchor: { x: 50, y: 40 },
      shouldAnchorOffset: true,
    });
  });

  it("returns none when the pinch would not change zoom", () => {
    expect(
      resolveCanvasPinchDecision({
        pinchStartZoom: 1,
        scale: 1,
        currentZoom: 1,
        anchor: { x: 0, y: 0 },
        zoomBounds: { min: 0.25, max: 4 },
      })
    ).toEqual({ type: "none" });
  });


  it("executes anchored zoom", () => {
    let zoom = 1;
    let offset: Point = { x: 10, y: 20 };

    executeCanvasPinchDecision(
      {
        type: "zoom",
        currentZoom: 1,
        nextZoom: 2,
        anchor: { x: 100, y: 80 },
        shouldAnchorOffset: true,
      },
      {
        setZoom: (updater) => {
          zoom = updater(zoom);
        },
        setOffset: (updater) => {
          offset = updater(offset);
        },
      }
    );

    expect(zoom).toBe(2);
    expect(offset).toEqual({ x: -80, y: -40 });
  });


  it("creates pinch executors that bind viewport callbacks", () => {
    const calls: string[] = [];
    const executor = createCanvasPinchExecutor({
      setZoom: (updater) => {
        calls.push(`zoom:${updater(1)}`);
      },
      setOffset: (updater) => {
        const next = updater({ x: 10, y: 20 });
        calls.push(`offset:${next.x},${next.y}`);
      },
    });

    executor.setZoom(() => 2);
    executor.setOffset((offset) => ({ x: offset.x + 1, y: offset.y + 2 }));

    expect(calls).toEqual(["zoom:2", "offset:11,22"]);
  });

  it("creates pinch handlers that resolve and execute zoom", () => {
    let zoom = 1;
    let offset: Point = { x: 10, y: 20 };
    const handler = createCanvasPinchHandler({
      executor: createCanvasPinchExecutor({
        setZoom: (updater) => {
          zoom = updater(zoom);
        },
        setOffset: (updater) => {
          offset = updater(offset);
        },
      }),
    });

    handler({
      pinchStartZoom: 1,
      scale: 2,
      currentZoom: 1,
      anchor: { x: 100, y: 80 },
      zoomBounds: { min: 0.25, max: 4 },
    });

    expect(zoom).toBe(2);
    expect(offset).toEqual({ x: -80, y: -40 });
  });

  it("creates pinch handlers that ignore unchanged zoom", () => {
    let zoom = 1;
    let offset: Point = { x: 10, y: 20 };
    const handler = createCanvasPinchHandler({
      executor: createCanvasPinchExecutor({
        setZoom: (updater) => {
          zoom = updater(zoom);
        },
        setOffset: (updater) => {
          offset = updater(offset);
        },
      }),
    });

    handler({
      pinchStartZoom: 1,
      scale: 1,
      currentZoom: 1,
      anchor: { x: 100, y: 80 },
      zoomBounds: { min: 0.25, max: 4 },
    });

    expect(zoom).toBe(1);
    expect(offset).toEqual({ x: 10, y: 20 });
  });
  it("routes pinch gestures through anchor resolution", () => {
    const handler = vi.fn();
    const preventDefault = vi.fn();
    const resolveAnchor = vi.fn(() => ({ x: 10, y: 20 }));
    const route = createCanvasPinchRouteHandler({ handler });

    route({
      pinchStartZoom: 1,
      scale: 2,
      currentZoom: 1,
      origin: { x: 30, y: 40 },
      zoomBounds: { min: 0.25, max: 4 },
      preventDefault,
      resolveAnchor,
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(resolveAnchor).toHaveBeenCalledWith({ x: 30, y: 40 });
    expect(handler).toHaveBeenCalledWith({
      pinchStartZoom: 1,
      scale: 2,
      currentZoom: 1,
      anchor: { x: 10, y: 20 },
      zoomBounds: { min: 0.25, max: 4 },
    });
  });

  it("routes pinch gestures without executing zoom when anchor cannot resolve", () => {
    const handler = vi.fn();
    const preventDefault = vi.fn();
    const resolveAnchor = vi.fn(() => null);
    const route = createCanvasPinchRouteHandler({ handler });

    route({
      pinchStartZoom: 1,
      scale: 2,
      currentZoom: 1,
      origin: { x: 30, y: 40 },
      zoomBounds: { min: 0.25, max: 4 },
      preventDefault,
      resolveAnchor,
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(resolveAnchor).toHaveBeenCalledWith({ x: 30, y: 40 });
    expect(handler).not.toHaveBeenCalled();
  });
});
