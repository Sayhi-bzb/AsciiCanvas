import { describe, expect, it, vi } from "vitest";
import type { CanvasSurfaceReader } from "@/domains/canvas/public";

const { drawCellBatch } = vi.hoisted(() => ({ drawCellBatch: vi.fn() }));

vi.mock("@/shared/metrics", () => ({
  drawCellBatch,
  getCellOccupancy: () => 1,
  setTextRenderStyle: vi.fn(),
}));

import { drawGridLayer } from "./drawGridLayer";

describe("drawGridLayer", () => {
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

    expect(query).toHaveBeenCalledWith({ x: 2, y: 3, width: 19, height: 8 });
    expect(getCell).not.toHaveBeenCalled();
    expect(drawCellBatch).toHaveBeenCalledOnce();
  });
});
