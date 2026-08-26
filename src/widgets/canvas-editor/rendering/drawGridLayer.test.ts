import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasSurfaceReader } from "@/domains/canvas/public";

const { drawCellBatch } = vi.hoisted(() => ({ drawCellBatch: vi.fn() }));

vi.mock("@/shared/metrics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/metrics")>()),
  drawCellBatch,
  setTextRenderStyle: vi.fn(),
}));

import { CellPlaneIndex } from "@/domains/canvas/public";
import { drawGridLayer } from "./drawGridLayer";

describe("drawGridLayer", () => {
  beforeEach(() => drawCellBatch.mockClear());

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
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    drawGridLayer(
      ctx,
      reader,
      { startX: 2, endX: 20, startY: 3, endY: 10 },
      1,
      { x: 0, y: 0 }
    );

    expect(query).toHaveBeenCalledWith({ x: 1, y: 3, width: 20, height: 8 });
    expect(getCell).not.toHaveBeenCalled();
    expect(drawCellBatch).toHaveBeenCalledOnce();
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
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    drawGridLayer(
      ctx,
      reader,
      { startX: wideX + 1, endX: wideX + 2, startY: 0, endY: 0 },
      1,
      { x: 0, y: 0 }
    );

    expect(drawCellBatch.mock.calls[0]?.[1].map(
      (entry: { cell: { char: string } }) => entry.cell.char
    ))
      .toEqual(["你", "A"]);
  });

  it("does not draw a single-width cell from the left query halo", () => {
    const query = vi.fn(function* () {
      yield { x: 0, y: 0, cells: [{ char: "A", color: "#fff" }] };
      yield { x: 1, y: 0, cells: [{ char: "B", color: "#fff" }] };
    });
    const reader = { query } as unknown as CanvasSurfaceReader;
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    drawGridLayer(
      ctx,
      reader,
      { startX: 1, endX: 1, startY: 0, endY: 0 },
      1,
      { x: 0, y: 0 }
    );

    expect(drawCellBatch.mock.calls[0]?.[1].map(
      (entry: { cell: { char: string } }) => entry.cell.char
    ))
      .toEqual(["B"]);
  });
});
