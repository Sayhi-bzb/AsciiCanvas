import { describe, expect, it } from "vitest";
import type { GridCell, GridMap } from "@/shared/types";
import {
  getGridFootprint,
  resolveGridAnchor,
  resolveGridSlot,
} from "./grid-occupancy";

const cell = (char: string): GridCell => ({ char, color: "#fff" });

describe("grid occupancy", () => {
  const grid: GridMap = new Map([["3,2", cell("你")]]);

  it("resolves both visual columns to one logical anchor", () => {
    expect(resolveGridSlot(grid, { x: 3, y: 2 })).toMatchObject({
      anchor: { x: 3, y: 2 },
      offset: 0,
      width: 2,
    });
    expect(resolveGridSlot(grid, { x: 4, y: 2 })).toMatchObject({
      anchor: { x: 3, y: 2 },
      offset: 1,
      width: 2,
    });
    expect(resolveGridAnchor(grid, { x: 4, y: 2 })).toEqual({ x: 3, y: 2 });
  });

  it("returns the complete footprint from either column", () => {
    expect(getGridFootprint(grid, { x: 4, y: 2 })).toMatchObject({
      start: { x: 3, y: 2 },
      end: { x: 4, y: 2 },
      width: 2,
    });
  });
});
