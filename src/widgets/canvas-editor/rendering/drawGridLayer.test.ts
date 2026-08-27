import { describe, expect, it, vi } from "vitest";
import type { CanvasSurfaceReader } from "@/domains/canvas/public";

import { CellPlaneIndex } from "@/domains/canvas/public";
import { drawGridLayer } from "./drawGridLayer";

describe("drawGridLayer", () => {
  const createContext = () => ({
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D);

  it("queries occupied spans instead of probing every viewport coordinate", () => {
    const getCell = vi.fn();
    const query = vi.fn(function* () {
      yield {
        x: 5,
        y: 7,
        cells: [{ char: "A", color: "#fff" }],
      };
    });
    const reader = {
      getCell,
      query,
    } as unknown as CanvasSurfaceReader;
    const ctx = createContext();

    drawGridLayer(
      ctx,
      reader,
      { startX: 2, endX: 20, startY: 3, endY: 10 },
      1,
      { x: 0, y: 0 }
    );

    expect(query).toHaveBeenCalledWith({ x: 1, y: 3, width: 20, height: 8 });
    expect(getCell).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledOnce();
  });

  it.each([
    { name: "inside a chunk", wideX: 0 },
    { name: "across a chunk boundary", wideX: 63 },
  ])("redraws a wide anchor when its follower intersects the view $name", ({ wideX }) => {
    const reader = new CellPlaneIndex([{
      id: "wide-and-neighbor",
      bounds: { x: wideX, y: 0, width: 3, height: 1 },
      rows: [{
        y: 0,
        erase: [],
        spans: [
          { x: wideX, text: "你", color: "#fff" },
          { x: wideX + 2, text: "A", color: "#fff" },
        ],
      }],
    }]);
    const ctx = createContext();

    drawGridLayer(
      ctx,
      reader,
      { startX: wideX + 1, endX: wideX + 2, startY: 0, endY: 0 },
      1,
      { x: 0, y: 0 }
    );

    expect(vi.mocked(ctx.fillText).mock.calls.map(([character]) => character))
      .toEqual(["你", "A"]);
  });

  it("does not draw a single-width cell from the left query halo", () => {
    const query = vi.fn(function* () {
      yield { x: 0, y: 0, cells: [{ char: "A", color: "#fff" }] };
      yield { x: 1, y: 0, cells: [{ char: "B", color: "#fff" }] };
    });
    const reader = { query } as unknown as CanvasSurfaceReader;
    const ctx = createContext();

    drawGridLayer(
      ctx,
      reader,
      { startX: 1, endX: 1, startY: 0, endY: 0 },
      1,
      { x: 0, y: 0 }
    );

    expect(vi.mocked(ctx.fillText).mock.calls.map(([character]) => character))
      .toEqual(["B"]);
  });
});
