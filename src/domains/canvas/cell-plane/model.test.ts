import { describe, expect, it } from "vitest";
import { CellPlaneIndex, type CellPlaneOperation } from "./model";

const operation = (
  id: string,
  rows: CellPlaneOperation["rows"],
  width = 8
): CellPlaneOperation => ({
  id,
  bounds: { x: 0, y: 0, width, height: 1 },
  rows,
});

describe("CellPlaneIndex", () => {
  it("resolves ordered overlap without changing non-overlapping cells", () => {
    const plane = new CellPlaneIndex([
      operation("base", [{ y: 0, erase: [], spans: [{ x: 0, text: "ABCD", color: "#fff" }] }]),
      operation("edit", [{ y: 0, erase: [{ from: 1, to: 2 }], spans: [{ x: 1, text: "xy", color: "#f00" }] }]),
    ]);

    expect([...plane.rows()].flatMap((row) => row.spans.flatMap((span) =>
      span.cells.map((cell) => cell.char)
    )).join("")).toBe("AxyD");
    expect(plane.getCell({ x: 1, y: 0 })?.color).toBe("#f00");
  });

  it("removes a wide-cell anchor when a later operation hits its follower", () => {
    const plane = new CellPlaneIndex([
      operation("wide", [{ y: 0, erase: [], spans: [{ x: 0, text: "你B", color: "#fff" }] }]),
      operation("overwrite", [{ y: 0, erase: [{ from: 1, to: 1 }], spans: [{ x: 1, text: "x", color: "#0f0" }] }]),
    ]);

    expect(plane.getCell({ x: 0, y: 0 })).toBeUndefined();
    expect(plane.getCell({ x: 1, y: 0 })?.char).toBe("x");
    expect(plane.getCell({ x: 2, y: 0 })?.char).toBe("B");
  });

  it("does not duplicate halo cells across chunk boundaries", () => {
    const plane = new CellPlaneIndex([{
      id: "boundary",
      bounds: { x: 127, y: 0, width: 2, height: 1 },
      rows: [{
        y: 0,
        erase: [],
        spans: [{ x: 127, text: "AB", color: "#fff" }],
      }],
    }]);

    expect([...plane.query({ x: 127, y: 0, width: 2, height: 1 })]
      .flatMap((span) => span.cells)
      .map((cell) => cell.char)).toEqual(["A", "B"]);
  });
});
