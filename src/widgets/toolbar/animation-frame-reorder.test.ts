import { describe, expect, it } from "vitest";
import {
  areFrameOrdersEqual,
  getMovingFrameIds,
  moveFrameBlock,
} from "./animation-frame-reorder";

const order = ["a", "b", "c", "d", "e"];

describe("animation frame reordering", () => {
  it("moves only the active frame when it is outside the selection", () => {
    expect(getMovingFrameIds(order, ["b", "c"], "d")).toEqual(["d"]);
    expect(moveFrameBlock(order, ["d"], "d", "b")).toEqual([
      "a",
      "d",
      "b",
      "c",
      "e",
    ]);
  });

  it("moves a multi-selection as one block in source order", () => {
    const movingIds = getMovingFrameIds(order, ["d", "b"], "b");

    expect(movingIds).toEqual(["b", "d"]);
    expect(moveFrameBlock(order, movingIds, "b", "e")).toEqual([
      "a",
      "c",
      "e",
      "b",
      "d",
    ]);
  });

  it("places a downward move after the frame under the pointer", () => {
    expect(moveFrameBlock(order, ["b"], "b", "d")).toEqual([
      "a",
      "c",
      "d",
      "b",
      "e",
    ]);
  });

  it("keeps the source order for a selected target or unchanged drop", () => {
    expect(moveFrameBlock(order, ["b", "c"], "b", "c")).toBe(order);
    expect(moveFrameBlock(order, ["b"], "b", "b")).toBe(order);
    expect(areFrameOrdersEqual(order, [...order])).toBe(true);
  });

  it("ignores missing drag targets", () => {
    expect(moveFrameBlock(order, ["b"], "b", "missing")).toBe(order);
  });
});
