import { describe, expect, it } from "vitest";
import {
  getCanvasLodCell,
  resolveCanvasContentLod,
  shouldDrawCanvasGrid,
} from "./canvasLod";

describe("canvas content LOD", () => {
  it("uses stable detail levels based on visible cell width", () => {
    expect(resolveCanvasContentLod(1)).toBe("full");
    expect(resolveCanvasContentLod(0.5)).toBe("simplified");
    expect(resolveCanvasContentLod(0.25)).toBe("density");
    expect(shouldDrawCanvasGrid(0.5)).toBe(true);
    expect(shouldDrawCanvasGrid(0.25)).toBe(false);
  });

  it("turns tiny glyphs into density blocks", () => {
    expect(getCanvasLodCell({ char: "A", color: "#123456" }, "density"))
      .toEqual({
        cell: { char: " ", color: "#123456", bgColor: "#123456" },
        drawBackground: true,
        drawText: false,
      });
  });

  it("drops tiny decorations while preserving semantic style", () => {
    const result = getCanvasLodCell({
      char: "A",
      color: "#123456",
      attrs: { bold: true, underline: true, strike: true },
    }, "simplified");
    expect(result.cell.attrs).toEqual({ bold: true });
  });
});
