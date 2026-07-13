import { describe, expect, it } from "vitest";
import {
  getLocalCanvasPoint,
  resolveAnimationAwareHoverGridPoint,
  resolveClampedZoom,
  resolveSnappedGridPointFromScreen,
  resolveZoomAnchoredOffset,
} from "@/widgets/canvas-editor/hooks/interaction/core/coordinates";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import type { GridMap } from "@/shared/types";

const rect = { left: 10, top: 20 } as DOMRect;
const viewport = { offset: { x: 0, y: 0 }, zoom: 1 };

describe("canvas coordinate helpers", () => {
  it("converts client coordinates to local canvas coordinates", () => {
    expect(getLocalCanvasPoint({ clientX: 18, clientY: 31, rect })).toEqual({
      x: 8,
      y: 11,
    });
  });

  it("snaps wide-character follower cells back to their anchor cell", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "你", color: "#ffffff" }],
    ]);

    expect(
      resolveSnappedGridPointFromScreen({
        clientX: rect.left + DEFAULT_GRID_RENDER_METRICS.cellWidth + 1,
        clientY: rect.top + 1,
        rect,
        viewport,
        grid,
        canvasMode: "freeform",
        canvasBounds: null,
      })
    ).toEqual({ x: 0, y: 0 });
  });

  it("clamps snapped grid points in animation mode", () => {
    expect(
      resolveSnappedGridPointFromScreen({
        clientX: rect.left + DEFAULT_GRID_RENDER_METRICS.cellWidth * 99,
        clientY: rect.top + DEFAULT_GRID_RENDER_METRICS.cellHeight * 99,
        rect,
        viewport,
        grid: new Map(),
        canvasMode: "animation",
        canvasBounds: { width: 8, height: 4 },
      })
    ).toEqual({ x: 7, y: 3 });
  });

  it("returns null for animation hover points outside bounds", () => {
    expect(
      resolveAnimationAwareHoverGridPoint({
        clientX: rect.left - DEFAULT_GRID_RENDER_METRICS.cellWidth,
        clientY: rect.top,
        rect,
        viewport,
        canvasMode: "animation",
        canvasBounds: { width: 8, height: 4 },
      })
    ).toBeNull();
  });

  it("keeps non-animation hover points unbounded", () => {
    expect(
      resolveAnimationAwareHoverGridPoint({
        clientX: rect.left - DEFAULT_GRID_RENDER_METRICS.cellWidth,
        clientY: rect.top,
        rect,
        viewport,
        canvasMode: "freeform",
        canvasBounds: null,
      })
    ).toEqual({ x: -1, y: 0 });
  });

  it("clamps zoom and resolves anchored offset", () => {
    const nextZoom = resolveClampedZoom(1, 3, { min: 0.25, max: 2 });
    expect(nextZoom).toBe(2);
    expect(
      resolveZoomAnchoredOffset({
        anchor: { x: 100, y: 50 },
        previousOffset: { x: 20, y: 10 },
        currentZoom: 1,
        nextZoom,
      })
    ).toEqual({ x: -60, y: -30 });
  });
});
