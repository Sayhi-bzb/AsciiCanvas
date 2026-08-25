import { describe, expect, it } from "vitest";
import { getIncrementalBackgroundBounds } from "./incrementalBackground";

describe("getIncrementalBackgroundBounds", () => {
  it("adds a cell halo and clips it to the visible surface", () => {
    expect(getIncrementalBackgroundBounds({
      revision: 2,
      full: false,
      bounds: [{ x: 4, y: 3, width: 2, height: 1 }],
    }, {
      x: 4,
      y: 2,
      width: 4,
      height: 3,
    })).toEqual([{ x: 4, y: 2, width: 3, height: 3 }]);
  });

  it("returns an empty list for offscreen changes and null for full redraws", () => {
    const viewport = { x: 0, y: 0, width: 5, height: 5 };
    expect(getIncrementalBackgroundBounds({
      revision: 2,
      full: false,
      bounds: [{ x: 20, y: 20, width: 1, height: 1 }],
    }, viewport)).toEqual([]);
    expect(getIncrementalBackgroundBounds({ revision: 2, full: true }, viewport))
      .toBeNull();
  });
});
