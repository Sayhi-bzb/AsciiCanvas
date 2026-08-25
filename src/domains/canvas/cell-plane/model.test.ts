import { describe, expect, it } from "vitest";
import {
  CellPlaneIndex,
  cellPlanePatchToOperation,
  createGridSurfaceReader,
  createSurfaceGridProjection,
  isSurfaceGridProjection,
  type CellPlaneOperation,
} from "./model";

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
  it("keeps compact text runs intact when compiling a patch", () => {
    const compiled = cellPlanePatchToOperation("paste", {
      rows: [{
        y: 4,
        erase: [],
        spans: [{ x: 2, text: "A你B", color: "#fff" }],
      }],
    });

    expect(compiled).toMatchObject({
      bounds: { x: 2, y: 4, width: 4, height: 1 },
      rows: [{ spans: [{ text: "A你B" }] }],
    });
  });

  it("does not materialize large text runs while compiling a patch", () => {
    const text = "A".repeat(100_000);
    const compiled = cellPlanePatchToOperation("large-paste", {
      rows: [{ y: 0, erase: [], spans: [{ x: 0, text, color: "#fff" }] }],
    });

    expect(compiled?.bounds.width).toBe(100_000);
    expect(compiled?.rows[0]?.spans).toHaveLength(1);
    expect(compiled?.rows[0]?.spans[0]?.text).toBe(text);
  });

  it("preserves each target background while replaying a compact patch", () => {
    const base = operation("base", [{
      y: 0,
      erase: [],
      spans: [
        { x: 0, text: "A", color: "#fff", bgColor: "#f00" },
        { x: 1, text: "B", color: "#fff", bgColor: "#0f0" },
      ],
    }]);
    const paste = cellPlanePatchToOperation("paste", {
      rows: [{
        y: 0,
        erase: [],
        spans: [{
          x: 0,
          text: "xy",
          color: "#111",
          preserveTargetBackground: true,
        }],
      }],
    })!;
    const plane = new CellPlaneIndex([base, paste]);

    expect(plane.getCell({ x: 0, y: 0 })).toMatchObject({ char: "x", bgColor: "#f00" });
    expect(plane.getCell({ x: 1, y: 0 })).toMatchObject({ char: "y", bgColor: "#0f0" });
  });

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

  it("derives final content bounds after an erase", () => {
    const plane = new CellPlaneIndex([
      operation("base", [{ y: 0, erase: [], spans: [{ x: 0, text: "A", color: "#fff" }] }], 101),
      {
        id: "far",
        bounds: { x: 100, y: 0, width: 1, height: 1 },
        rows: [{ y: 0, erase: [], spans: [{ x: 100, text: "B", color: "#fff" }] }],
      },
      {
        id: "erase-far",
        bounds: { x: 100, y: 0, width: 1, height: 1 },
        rows: [{ y: 0, erase: [{ from: 100, to: 100 }], spans: [] }],
      },
    ]);

    expect(plane.getContentBounds()).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("adapts a derived grid to the common surface reader contract", () => {
    const reader = createGridSurfaceReader(new Map([
      ["2,3", { char: "你", color: "#fff" }],
    ]));

    expect(reader.getCell({ x: 2, y: 3 })?.char).toBe("你");
    expect(reader.getContentBounds()).toEqual({ x: 2, y: 3, width: 2, height: 1 });
    expect([...reader.query({ x: 0, y: 0, width: 5, height: 5 })]).toHaveLength(1);
    const projection = createSurfaceGridProjection(reader);
    expect(isSurfaceGridProjection(projection)).toBe(true);
    expect(isSurfaceGridProjection(new Map())).toBe(false);
    expect(new Map(projection)).toEqual(
      new Map([["2,3", { char: "你", color: "#fff" }]])
    );
    expect(() => projection.set("0,0", { char: "X", color: "#fff" }))
      .toThrow("read-only");
  });

  it("resolves replaceable authorities lazily", () => {
    let reader = createGridSurfaceReader(new Map([
      ["0,0", { char: "A", color: "#fff" }],
    ]));
    const projection = createSurfaceGridProjection(() => reader);

    reader = createGridSurfaceReader(new Map([
      ["1,0", { char: "B", color: "#fff" }],
    ]));

    expect(projection.has("0,0")).toBe(false);
    expect(projection.get("1,0")?.char).toBe("B");
  });
});
