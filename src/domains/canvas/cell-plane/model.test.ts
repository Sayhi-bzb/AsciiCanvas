import { describe, expect, it } from "vitest";
import {
  CellPlaneIndex,
  CanvasProjectionCacheBudget,
  cellPlanePatchToOperation,
  createGridSurfaceReader,
  createSurfaceGridProjection,
  getSurfaceGridLineOriginX,
  decodeCellPlaneOperationRows,
  encodeCellPlaneOperation,
  isIncrementalCanvasSurfaceReader,
  isCellPlaneOperation,
  isSurfaceGridProjection,
  type LegacyCellPlaneOperation,
} from "./model";

const operation = (
  id: string,
  rows: LegacyCellPlaneOperation["rows"],
  width = 8
): LegacyCellPlaneOperation => ({
  id,
  bounds: { x: 0, y: 0, width, height: 1 },
  rows,
});

describe("CellPlaneIndex", () => {
  it("round-trips compact rows without losing styles or wide graphemes", () => {
    const rows: LegacyCellPlaneOperation["rows"] = [{
      y: -3,
      erase: [{ from: -2, to: 4 }],
      spans: [{
        x: -1,
        text: "A你🙂",
        color: "#123456",
        bgColor: "#abcdef",
        href: "https://example.com",
        attrs: { bold: true, italic: true, underline: true, strike: true, inverse: true },
        preserveTargetBackground: true,
      }],
    }];
    const encoded = encodeCellPlaneOperation(
      "round-trip",
      { x: -2, y: -3, width: 8, height: 1 },
      rows
    );

    expect(isCellPlaneOperation(encoded)).toBe(true);
    expect(decodeCellPlaneOperationRows(encoded)).toEqual(rows);
  });

  it("rejects truncated compact payloads", () => {
    const encoded = encodeCellPlaneOperation(
      "truncated",
      { x: 0, y: 0, width: 1, height: 1 },
      [{ y: 0, erase: [], spans: [{ x: 0, text: "A", color: "#fff" }] }]
    );

    expect(isCellPlaneOperation({
      ...encoded,
      payload: encoded.payload.slice(0, -1),
    })).toBe(false);
  });

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
      format: 2,
    });
    expect(decodeCellPlaneOperationRows(compiled!)).toMatchObject([
      { spans: [{ text: "A你B" }] },
    ]);
  });

  it("does not materialize large text runs while compiling a patch", () => {
    const text = "A".repeat(100_000);
    const compiled = cellPlanePatchToOperation("large-paste", {
      rows: [{ y: 0, erase: [], spans: [{ x: 0, text, color: "#fff" }] }],
    });

    expect(compiled?.bounds.width).toBe(100_000);
    const rows = decodeCellPlaneOperationRows(compiled!);
    expect(rows[0]?.spans).toHaveLength(1);
    expect(rows[0]?.spans[0]?.text).toBe(text);
  });

  it("keeps content bounds incremental for writes inside a large plane", () => {
    const initial = cellPlanePatchToOperation("initial", {
      rows: [{
        y: 0,
        erase: [],
        spans: [{ x: 0, text: "A".repeat(100_000), color: "#fff" }],
      }],
    })!;
    const plane = new CellPlaneIndex([initial]);
    plane.append(cellPlanePatchToOperation("overwrite", {
      rows: [{ y: 0, erase: [], spans: [{ x: 1, text: "B", color: "#fff" }] }],
    })!);

    expect(plane.getContentBounds()).toEqual({ x: 0, y: 0, width: 100_000, height: 1 });
    expect(plane.getStats().cachedChunks).toBe(0);
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

  it("counts logical cells without warming projection caches", () => {
    const plane = new CellPlaneIndex([{
      id: "count",
      bounds: { x: 127, y: 0, width: 4, height: 1 },
      rows: [{
        y: 0,
        erase: [],
        spans: [{ x: 127, text: "A你B", color: "#fff" }],
      }],
    }]);

    const before = plane.getStats();
    expect(plane.countCells()).toBe(3);
    expect(plane.getStats()).toMatchObject({
      cachedChunks: before.cachedChunks,
      residentBytes: before.residentBytes,
    });
  });

  it("exposes append-only operations for a worker mirror", () => {
    const first = operation("first", [{
      y: 0,
      erase: [],
      spans: [{ x: 0, text: "A", color: "#fff" }],
    }]);
    const second = operation("second", [{
      y: 0,
      erase: [],
      spans: [{ x: 1, text: "B", color: "#fff" }],
    }]);
    const plane = new CellPlaneIndex([first]);

    plane.append(second);

    expect(plane.getOperationCount()).toBe(2);
    expect(plane.getOperationsSince(1)).toEqual([second]);
    expect(plane.getOperationsSince(99)).toEqual([first, second]);
  });

  it("shares one byte budget across independent projections", () => {
    const budget = new CanvasProjectionCacheBudget(25_000);
    const left = new CellPlaneIndex([
      operation("left", [{
        y: 0,
        erase: [],
        spans: [{ x: 0, text: "A".repeat(128), color: "#fff" }],
      }], 128),
    ], budget);
    const right = new CellPlaneIndex([{
      id: "right",
      bounds: { x: 128, y: 0, width: 128, height: 1 },
      rows: [{
        y: 0,
        erase: [],
        spans: [{ x: 128, text: "B".repeat(128), color: "#fff" }],
      }],
    }], budget);

    left.getCell({ x: 0, y: 0 });
    right.getCell({ x: 128, y: 0 });

    expect(budget.getStats()).toMatchObject({ entries: 1, evictions: 1 });
    expect(left.getStats().cachedChunks + right.getStats().cachedChunks).toBe(1);
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

  it("reports merged bounds since an observed revision", () => {
    const plane = new CellPlaneIndex();
    expect(isIncrementalCanvasSurfaceReader(plane)).toBe(true);
    const revision = plane.getRevision();

    plane.append({
      id: "left",
      bounds: { x: 2, y: 3, width: 1, height: 1 },
      rows: [{ y: 3, erase: [], spans: [{ x: 2, text: "A", color: "#fff" }] }],
    });
    plane.append({
      id: "right",
      bounds: { x: 3, y: 3, width: 2, height: 1 },
      rows: [{ y: 3, erase: [], spans: [{ x: 3, text: "BC", color: "#fff" }] }],
    });

    expect(plane.getChangesSince(revision)).toEqual({
      revision: 2,
      full: false,
      bounds: [{ x: 2, y: 3, width: 3, height: 1 }],
    });
    expect(plane.getChangesSince(2)).toEqual({
      revision: 2,
      full: false,
      bounds: [],
    });
  });

  it("falls back to full invalidation after the bounded history expires", () => {
    const plane = new CellPlaneIndex();
    for (let index = 0; index < 257; index += 1) {
      plane.append({
        id: String(index),
        bounds: { x: index * 2, y: 0, width: 1, height: 1 },
        rows: [{
          y: 0,
          erase: [],
          spans: [{ x: index * 2, text: "A", color: "#fff" }],
        }],
      });
    }

    expect(plane.getChangesSince(0)).toEqual({ revision: 257, full: true });
  });

  it("finds a row origin through a surface projection without materializing it", () => {
    const plane = new CellPlaneIndex([{
      id: "line",
      bounds: { x: 2, y: 4, width: 6, height: 1 },
      rows: [{
        y: 4,
        erase: [],
        spans: [
          { x: 2, text: "你A", color: "#fff" },
          { x: 7, text: "B", color: "#fff" },
        ],
      }],
    }]);
    const projection = createSurfaceGridProjection(plane);

    expect(getSurfaceGridLineOriginX(projection, { x: 8, y: 4 })).toBe(7);
    expect(getSurfaceGridLineOriginX(projection, { x: 4, y: 4 })).toBe(2);
    expect(getSurfaceGridLineOriginX(new Map(), { x: 4, y: 4 })).toBeUndefined();
  });
});
