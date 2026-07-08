import { describe, expect, it } from "vitest";
import {
  createCanvasPinchExecutor,
  executeCanvasPinchDecision,
  resolveCanvasPinchDecision,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/pinchInteraction";
import type { Point } from "@/shared/types";

describe("canvas pinch interaction", () => {
  it("resolves clamped pinch zoom from the gesture start zoom", () => {
    expect(
      resolveCanvasPinchDecision({
        canvasMode: "freeform",
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
        canvasMode: "structured",
        pinchStartZoom: 1,
        scale: 1,
        currentZoom: 1,
        anchor: { x: 0, y: 0 },
        zoomBounds: { min: 0.25, max: 4 },
      })
    ).toEqual({ type: "none" });
  });

  it("does not anchor offset in animation mode", () => {
    expect(
      resolveCanvasPinchDecision({
        canvasMode: "animation",
        pinchStartZoom: 1,
        scale: 2,
        currentZoom: 1,
        anchor: { x: 80, y: 60 },
        zoomBounds: { min: 0.25, max: 4 },
      })
    ).toEqual({
      type: "zoom",
      currentZoom: 1,
      nextZoom: 2,
      anchor: { x: 80, y: 60 },
      shouldAnchorOffset: false,
    });
  });

  it("executes anchored zoom outside animation mode", () => {
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

  it("executes animation zoom without changing offset", () => {
    let zoom = 1;
    let offset: Point = { x: 10, y: 20 };

    executeCanvasPinchDecision(
      {
        type: "zoom",
        currentZoom: 1,
        nextZoom: 2,
        anchor: { x: 100, y: 80 },
        shouldAnchorOffset: false,
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
    expect(offset).toEqual({ x: 10, y: 20 });
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
});
