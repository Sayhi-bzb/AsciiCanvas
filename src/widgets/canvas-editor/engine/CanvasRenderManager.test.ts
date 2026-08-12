import { describe, expect, it } from "vitest";
import { CanvasRenderManager } from "./CanvasRenderManager";
import { CANVAS_FRAME_ALL, CANVAS_FRAME_INVALIDATION } from "./FrameScheduler";

describe("CanvasRenderManager", () => {
  it("invalidates only layers whose inputs changed", () => {
    const manager = new CanvasRenderManager();
    const grid = new Map();
    const initial = manager.update({
      background: [grid, 1],
      scratch: [null, 1],
      overlay: [null, 1],
    });
    expect(initial & CANVAS_FRAME_ALL).toBe(
      CANVAS_FRAME_INVALIDATION.background |
        CANVAS_FRAME_INVALIDATION.scratch |
        CANVAS_FRAME_INVALIDATION.overlay
    );

    expect(
      manager.update({
        background: [grid, 1],
        scratch: [null, 1],
        overlay: [{ x: 1, y: 1 }, 1],
      })
    ).toBe(CANVAS_FRAME_INVALIDATION.overlay);
  });

  it("invalidates every render layer after reset", () => {
    const manager = new CanvasRenderManager();
    expect(manager.reset()).toBe(CANVAS_FRAME_ALL);
  });
});
