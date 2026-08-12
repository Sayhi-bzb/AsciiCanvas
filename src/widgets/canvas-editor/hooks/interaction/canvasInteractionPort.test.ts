import { describe, expect, it, vi } from "vitest";
import {
  createCanvasInteractionPort,
  InteractionStateCapture,
  type CanvasInteractionPortDependencies,
} from "./canvasInteractionPort";

const createDependencies = () => {
  const capture = new InteractionStateCapture();
  const dependencies: CanvasInteractionPortDependencies = {
    capture,
    tool: "brush",
    canvasMode: "freeform",
    brushChar: "#",
    structuredScene: [],
    pointerContext: {
      hasCanvasRect: () => true,
      resolveLocalPoint: (x, y) => ({ x, y }),
    },
    dragStart: vi.fn(() => {
      capture.setState({
        type: "drawing",
        tool: "brush",
        start: { x: 1, y: 1 },
        lastGrid: { x: 1, y: 1 },
        lastPlacedGrid: { x: 1, y: 1 },
      });
      return true;
    }),
    dragUpdate: vi.fn(),
    dragEnd: vi.fn(() => true),
    beginInteraction: vi.fn(),
    completeInteraction: vi.fn(),
    cancelInteraction: vi.fn(),
    queuePan: vi.fn(),
    flushPan: vi.fn(),
    clearLinkHover: vi.fn(),
    setCursor: vi.fn(),
    addScratchPoints: vi.fn(),
    erasePoints: vi.fn(),
    setHoveredGrid: vi.fn(),
  };
  return dependencies;
};

describe("CanvasInteractionPort controller", () => {
  it("owns start capture and drawing updates outside React", () => {
    const dependencies = createDependencies();
    const port = createCanvasInteractionPort(dependencies);

    port.begin();
    const started = port.start({
      type: "canvas-drag-start",
      canvasMode: "freeform",
      button: 0,
      isCtrlOrMetaPressed: false,
      shiftKey: false,
      detail: 1,
      screenPoint: { x: 10, y: 20 },
      gridPoint: { x: 1, y: 1 },
      brushChar: "#",
    }, null);
    expect(dependencies.beginInteraction).toHaveBeenCalledOnce();
    expect(started?.state).toMatchObject({ type: "drawing", tool: "brush" });

    const next = port.update(started!.state, {
      type: "canvas-drag-update",
      delta: { x: 9, y: 0 },
      currentGrid: { x: 2, y: 1 },
    });
    expect(dependencies.addScratchPoints).toHaveBeenCalled();
    expect(next).toMatchObject({ type: "drawing", lastGrid: { x: 2, y: 1 } });
  });

  it("routes pan completion and cancellation through lifecycle ports", () => {
    const dependencies = createDependencies();
    const port = createCanvasInteractionPort(dependencies);
    const panning = { type: "panning" as const, lastScreen: { x: 10, y: 10 } };

    expect(port.update(panning, {
      type: "canvas-drag-update",
      delta: { x: 3, y: -2 },
      currentGrid: null,
    })).toEqual({ type: "panning", lastScreen: { x: 13, y: 8 } });
    expect(dependencies.queuePan).toHaveBeenCalledWith({ x: 3, y: -2 });

    port.complete(panning, null);
    expect(dependencies.flushPan).toHaveBeenCalledOnce();
    expect(dependencies.completeInteraction).toHaveBeenCalledOnce();

    port.cancel(panning);
    expect(dependencies.cancelInteraction).toHaveBeenCalledOnce();
  });
});
