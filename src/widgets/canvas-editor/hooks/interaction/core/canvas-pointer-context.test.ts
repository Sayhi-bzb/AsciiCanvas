import { describe, expect, it } from "vitest";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import type { GridMap, Point } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import { createCanvasPointerContextResolver } from "@/widgets/canvas-editor/hooks/interaction/core/pointerContext";

const rect = { left: 10, top: 20 } as DOMRect;

const createResolver = ({
  currentRect = rect,
  grid = new Map(),
  canvasMode = "freeform",
  canvasBounds = null,
  offset = { x: 0, y: 0 },
  zoom = 1,
}: {
  currentRect?: Pick<DOMRect, "left" | "top"> | null;
  grid?: GridMap;
  canvasMode?: CanvasMode;
  canvasBounds?: { width: number; height: number } | null;
  offset?: Point;
  zoom?: number;
} = {}) =>
  createCanvasPointerContextResolver({
    getRect: () => currentRect,
    getViewport: () => ({ offset, zoom }),
    getGrid: () => grid,
    getCanvasMode: () => canvasMode,
    getCanvasBounds: () => canvasBounds,
  });

describe("canvas pointer context resolver", () => {
  it("returns null values when the canvas rect is unavailable", () => {
    const resolver = createResolver({ currentRect: null });

    expect(resolver.resolveLocalPoint(10, 20)).toBeNull();
    expect(resolver.resolveGridPoint(10, 20)).toBeNull();
    expect(resolver.resolveLinkHit(10, 20)).toBeNull();
    expect(resolver.resolveAnimationAwareHoverPoint(10, 20)).toBeNull();
  });

  it("resolves local and snapped grid points", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "你", color: "#fff" }],
    ]);
    const resolver = createResolver({ grid });

    expect(resolver.resolveLocalPoint(18, 31)).toEqual({ x: 8, y: 11 });
    expect(
      resolver.resolveGridPoint(
        rect.left + DEFAULT_GRID_RENDER_METRICS.cellWidth + 1,
        rect.top + 1
      )
    ).toEqual({ x: 0, y: 0 });
  });

  it("resolves link hits from pointer coordinates", () => {
    const grid: GridMap = new Map([
      ["0,0", { char: "A", color: "#fff", href: "https://example.com" }],
    ]);
    const resolver = createResolver({ grid });

    expect(resolver.resolveLinkHit(rect.left + 1, rect.top + 1)).toEqual({
      y: 0,
      startX: 0,
      endX: 0,
      href: "https://example.com",
    });
  });

  it("uses animation-aware hover bounds", () => {
    const resolver = createResolver({
      canvasMode: "animation",
      canvasBounds: { width: 8, height: 4 },
    });

    expect(
      resolver.resolveAnimationAwareHoverPoint(
        rect.left - DEFAULT_GRID_RENDER_METRICS.cellWidth,
        rect.top
      )
    ).toBeNull();
    expect(
      resolver.resolveAnimationAwareHoverPoint(rect.left + 1, rect.top + 1)
    ).toEqual({ x: 0, y: 0 });
  });

  it("assembles move context for structured select and eraser hover", () => {
    const resolver = createResolver();

    expect(
      resolver.resolveMoveContext({
        clientX: rect.left + 1,
        clientY: rect.top + 1,
        shouldResolveStructuredSelectCursor: true,
        shouldResolveEraserHoverPoint: true,
        selectedStructuredNodeIds: [],
        structuredScene: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({
      point: { x: 0, y: 0 },
      linkHit: null,
      structuredSelectCursor: "",
      eraserHoverPoint: { x: 0, y: 0 },
    });
  });
});
