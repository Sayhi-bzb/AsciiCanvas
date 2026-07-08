import { describe, expect, it, vi } from "vitest";
import {
  createCanvasWheelExecutor,
  executeCanvasWheelDecision,
  resolveCanvasWheelDecision,
  type CanvasWheelExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/wheelInteraction";

const createExecutor = (): CanvasWheelExecutor => ({
  preventDefault: vi.fn(),
  flushOffset: vi.fn(),
  queueZoomDelta: vi.fn(),
  queueOffsetDelta: vi.fn(),
});

describe("canvas wheel interaction", () => {
  it("routes ctrl/meta wheels to anchored zoom", () => {
    expect(
      resolveCanvasWheelDecision({
        isCtrlOrMetaPressed: true,
        canvasMode: "freeform",
        deltaX: 0,
        deltaY: -100,
        shiftKey: false,
        anchor: { x: 20, y: 30 },
      })
    ).toEqual({
      type: "zoom",
      deltaZoom: 1.2,
      anchor: { x: 20, y: 30 },
    });
  });

  it("routes normal wheels to pan outside animation mode", () => {
    expect(
      resolveCanvasWheelDecision({
        isCtrlOrMetaPressed: false,
        canvasMode: "freeform",
        deltaX: 3,
        deltaY: -5,
        shiftKey: false,
        anchor: { x: 0, y: 0 },
      })
    ).toEqual({ type: "pan", delta: { x: -3, y: 5 } });
  });

  it("converts shift vertical wheels into horizontal pan", () => {
    expect(
      resolveCanvasWheelDecision({
        isCtrlOrMetaPressed: false,
        canvasMode: "structured",
        deltaX: 0,
        deltaY: 8,
        shiftKey: true,
        anchor: { x: 0, y: 0 },
      })
    ).toEqual({ type: "pan", delta: { x: -8, y: 0 } });
  });

  it("ignores non-zoom wheels in animation mode", () => {
    expect(
      resolveCanvasWheelDecision({
        isCtrlOrMetaPressed: false,
        canvasMode: "animation",
        deltaX: 0,
        deltaY: 8,
        shiftKey: false,
        anchor: { x: 0, y: 0 },
      })
    ).toEqual({ type: "none" });
  });

  it("executes zoom decisions by flushing pan and queueing zoom", () => {
    const executor = createExecutor();

    executeCanvasWheelDecision(
      { type: "zoom", deltaZoom: 1.2, anchor: { x: 20, y: 30 } },
      executor
    );

    expect(executor.preventDefault).toHaveBeenCalledTimes(1);
    expect(executor.flushOffset).toHaveBeenCalledTimes(1);
    expect(executor.queueZoomDelta).toHaveBeenCalledWith(1.2, 20, 30);
  });

  it("executes pan decisions without preventing default", () => {
    const executor = createExecutor();

    executeCanvasWheelDecision(
      { type: "pan", delta: { x: -3, y: 5 } },
      executor
    );

    expect(executor.queueOffsetDelta).toHaveBeenCalledWith(-3, 5);
    expect(executor.preventDefault).not.toHaveBeenCalled();
  });

  it("creates wheel executors that bind viewport callbacks", () => {
    const preventDefault = vi.fn();
    const flushOffset = vi.fn();
    const queueZoomDelta = vi.fn();
    const queueOffsetDelta = vi.fn();
    const executor = createCanvasWheelExecutor({
      preventDefault,
      flushOffset,
      queueZoomDelta,
      queueOffsetDelta,
    });

    executor.preventDefault();
    executor.flushOffset();
    executor.queueZoomDelta(1.1, 20, 30);
    executor.queueOffsetDelta(-4, 6);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(flushOffset).toHaveBeenCalledTimes(1);
    expect(queueZoomDelta).toHaveBeenCalledWith(1.1, 20, 30);
    expect(queueOffsetDelta).toHaveBeenCalledWith(-4, 6);
  });
});
