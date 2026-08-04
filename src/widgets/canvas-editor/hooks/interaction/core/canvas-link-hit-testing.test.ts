import { describe, expect, it } from "vitest";
import { resolveCanvasLinkHit } from "@/widgets/canvas-editor/hooks/interaction/core/linkHitTesting";
import {
  shouldUseCanvasLinkPointer,
  shouldOpenCanvasLink,
} from "@/widgets/canvas-editor/hooks/useCanvasInteraction";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import type { GridMap } from "@/shared/types";

const rect = { left: 10, top: 20 } as DOMRect;

const baseInput = (grid: GridMap) => ({
  clientX: 10,
  clientY: 20,
  rect,
  offset: { x: 0, y: 0 },
  zoom: 1,
  grid,
  canvasMode: "freeform" as const,
});

describe("resolveCanvasLinkHit", () => {
  it("returns the full href run for linked cells", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ffffff", href: "https://example.com" }],
      ["1,0", { char: "B", color: "#ffffff", href: "https://example.com" }],
      ["2,0", { char: "C", color: "#ffffff", href: "https://example.com" }],
    ]);

    expect(
      resolveCanvasLinkHit({
        ...baseInput(grid),
        clientX: rect.left + DEFAULT_GRID_RENDER_METRICS.cellWidth + 1,
      })
    ).toEqual({
      y: 0,
      startX: 0,
      endX: 2,
      href: "https://example.com",
    });
  });

  it("returns null for non-link cells", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ffffff" }],
    ]);

    expect(resolveCanvasLinkHit(baseInput(grid))).toBeNull();
  });

  it("keeps adjacent different href values in separate runs", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#ffffff", href: "https://a.example" }],
      ["1,0", { char: "B", color: "#ffffff", href: "https://b.example" }],
    ]);

    expect(resolveCanvasLinkHit(baseInput(grid))).toEqual({
      y: 0,
      startX: 0,
      endX: 0,
      href: "https://a.example",
    });
  });

  it("snaps wide character follower cells back to the linked anchor range", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "你", color: "#ffffff", href: "https://example.com" }],
      ["2,0", { char: "A", color: "#ffffff", href: "https://example.com" }],
    ]);

    expect(
      resolveCanvasLinkHit({
        ...baseInput(grid),
        clientX: rect.left + DEFAULT_GRID_RENDER_METRICS.cellWidth + 1,
      })
    ).toEqual({
      y: 0,
      startX: 0,
      endX: 2,
      href: "https://example.com",
    });
  });

});
describe("canvas link modifier affordance", () => {
  const hit = { y: 0, startX: 0, endX: 2, href: "https://example.com" };

  it("requires Ctrl or Meta before opening a canvas link", () => {
    expect(shouldOpenCanvasLink({ ctrlKey: false, metaKey: false })).toBe(false);
    expect(shouldOpenCanvasLink({ ctrlKey: true, metaKey: false })).toBe(true);
    expect(shouldOpenCanvasLink({ ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("uses a hand cursor only while Ctrl or Meta is held over a link", () => {
    expect(shouldUseCanvasLinkPointer(hit, { ctrlKey: false, metaKey: false })).toBe(false);
    expect(shouldUseCanvasLinkPointer(hit, { ctrlKey: true, metaKey: false })).toBe(true);
    expect(shouldUseCanvasLinkPointer(hit, { ctrlKey: false, metaKey: true })).toBe(true);
    expect(shouldUseCanvasLinkPointer(null, { ctrlKey: true, metaKey: false })).toBe(false);
  });
});

