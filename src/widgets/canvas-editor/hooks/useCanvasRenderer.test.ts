import { describe, expect, it } from "vitest";
import { haveCanvasRenderInputsChanged } from "./useCanvasRenderer";

describe("haveCanvasRenderInputsChanged", () => {
  it("uses reference identity for cheap layer invalidation", () => {
    const offset = { x: 1, y: 2 };
    expect(haveCanvasRenderInputsChanged(null, [offset, 1])).toBe(true);
    expect(haveCanvasRenderInputsChanged([offset, 1], [offset, 1])).toBe(false);
    expect(haveCanvasRenderInputsChanged([offset, 1], [{ ...offset }, 1])).toBe(true);
  });
});
