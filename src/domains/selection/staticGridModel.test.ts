import { describe, expect, it } from "vitest";
import {
  collapseGridSelectionTo,
  createGridSelectionState,
  extendGridSelectionTo,
  getGridSelectionRanges,
  gridRangeFromSelectionArea,
  moveGridAddress,
  moveGridAddressToContentBoundary,
  normalizeGridRange,
  selectionAreaFromGridRange,
  getStaticGridViewState,
  getConnectedGridRange,
  getEffectiveGridBounds,
  moveGridAddressToEdge,
  resolveGridFillRange,
  selectGridColumn,
  selectGridRange,
  selectGridRow,
} from "@/domains/selection/public";

describe("staticGridModel", () => {
  it("normalizes reversed ranges", () => {
    expect(
      normalizeGridRange({ start: { x: 4, y: 3 }, end: { x: 1, y: 9 } })
    ).toEqual({ start: { x: 1, y: 3 }, end: { x: 4, y: 9 } });
  });

  it("converts between legacy selection areas and grid ranges", () => {
    const range = gridRangeFromSelectionArea({
      start: { x: 8, y: 2 },
      end: { x: 3, y: 4 },
    });

    expect(range).toEqual({ start: { x: 3, y: 2 }, end: { x: 8, y: 4 } });
    expect(selectionAreaFromGridRange(range)).toEqual({
      start: { x: 3, y: 2 },
      end: { x: 8, y: 4 },
    });
  });

  it("extends a range while keeping the active cell at its anchor", () => {
    const base = createGridSelectionState({ x: 2, y: 2 });
    const moved = collapseGridSelectionTo(base, moveGridAddress(base.activeCell, 1, 0));
    const extended = extendGridSelectionTo(moved, moveGridAddress(moved.activeCell, 0, 2));

    expect(moved).toEqual({
      activeCell: { x: 3, y: 2 },
      anchorCell: { x: 3, y: 2 },
      primaryRange: { start: { x: 3, y: 2 }, end: { x: 3, y: 2 } },
      additionalRanges: [],
    });
    expect(extended).toEqual({
      activeCell: { x: 3, y: 2 },
      anchorCell: { x: 3, y: 2 },
      primaryRange: { start: { x: 3, y: 2 }, end: { x: 3, y: 4 } },
      additionalRanges: [],
    });
  });

  it("keeps the primary range last and activates it explicitly", () => {
    const base = createGridSelectionState({ x: 1, y: 1 });
    const next = selectGridRange(
      base,
      { start: { x: 4, y: 3 }, end: { x: 2, y: 2 } },
      { append: true, activeCell: "start" }
    );

    expect(getGridSelectionRanges(next)).toEqual([
      { start: { x: 1, y: 1 }, end: { x: 1, y: 1 } },
      { start: { x: 2, y: 2 }, end: { x: 4, y: 3 } },
    ]);
    expect(next.activeCell).toEqual({ x: 4, y: 3 });
    expect(next.anchorCell).toEqual({ x: 4, y: 3 });
  });

  it("derives freeform view state from static selection before legacy selections", () => {
    const view = getStaticGridViewState({
      selection: {
        activeCell: { x: 4, y: 2 },
        anchorCell: { x: 2, y: 2 },
        primaryRange: { start: { x: 2, y: 2 }, end: { x: 4, y: 2 } },
        additionalRanges: [],
      },
      editMode: "navigate",
      textCursor: null,
      selections: [{ start: { x: 9, y: 9 }, end: { x: 9, y: 9 } }],
    });

    expect(view).toEqual({
      activeCell: { x: 4, y: 2 },
      textCursor: null,
      selectionAreas: [{ start: { x: 2, y: 2 }, end: { x: 4, y: 2 } }],
      hasSelection: true,
      isTextEditing: false,
    });
  });

  it("keeps a legacy cursor hidden while the static grid is navigating", () => {
    const view = getStaticGridViewState({
      selection: createGridSelectionState({ x: 4, y: 2 }),
      editMode: "navigate",
      textCursor: { x: 9, y: 9 },
      selections: [],
    });

    expect(view.activeCell).toEqual({ x: 4, y: 2 });
    expect(view.textCursor).toBeNull();
  });

  it("derives effective bounds from negative sparse content and selection", () => {
    const grid = new Map([
      ["-4,3", { char: "A", color: "#fff" }],
      ["2,-2", { char: "B", color: "#fff" }],
    ]);

    expect(
      getEffectiveGridBounds({
        grid,
        activeCell: { x: 0, y: 0 },
        ranges: [{ start: { x: 7, y: 1 }, end: { x: 8, y: 2 } }],
      })
    ).toEqual({ start: { x: -4, y: -2 }, end: { x: 8, y: 3 } });
  });

  it("finds a four-way connected content region", () => {
    const cell = { char: "X", color: "#fff" };
    const grid = new Map([
      ["1,1", cell],
      ["2,1", cell],
      ["2,2", cell],
      ["3,3", cell],
    ]);

    expect(getConnectedGridRange(grid, { x: 1, y: 1 })).toEqual({
      start: { x: 1, y: 1 },
      end: { x: 2, y: 2 },
    });
  });

  it("moves to edges and creates bounded whole-row and whole-column ranges", () => {
    const state = createGridSelectionState({ x: 3, y: 4 });
    const bounds = { start: { x: -2, y: -1 }, end: { x: 8, y: 9 } };

    expect(moveGridAddressToEdge(state.activeCell, "left", bounds)).toEqual({ x: -2, y: 4 });
    expect(getGridSelectionRanges(selectGridRow(state, bounds))).toEqual([
      { start: { x: -2, y: 4 }, end: { x: 8, y: 4 } },
    ]);
    expect(getGridSelectionRanges(selectGridColumn(state, bounds))).toEqual([
      { start: { x: 3, y: -1 }, end: { x: 3, y: 9 } },
    ]);
  });

  it("moves across visible content runs and skips whitespace-only cells", () => {
    const grid = new Map([
      ["1,1", { char: "A", color: "#fff" }],
      ["2,1", { char: "B", color: "#fff" }],
      ["4,1", { char: " ", color: "#fff", bgColor: "#333" }],
      ["5,1", { char: "C", color: "#fff" }],
    ]);

    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 1, y: 1 },
        edge: "right",
      })
    ).toEqual({ x: 2, y: 1 });
    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 2, y: 1 },
        edge: "right",
      })
    ).toEqual({ x: 5, y: 1 });
    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 5, y: 1 },
        edge: "left",
      })
    ).toEqual({ x: 2, y: 1 });
  });

  it("uses fixed boundaries when no content exists in the direction", () => {
    const grid = new Map([["2,2", { char: "A", color: "#fff" }]]);

    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 2, y: 2 },
        edge: "bottom",
        fixedBounds: { start: { x: 0, y: 0 }, end: { x: 9, y: 7 } },
      })
    ).toEqual({ x: 2, y: 7 });
  });

  it("moves through vertical content runs in both directions", () => {
    const grid = new Map([
      ["3,-2", { char: "A", color: "#fff" }],
      ["3,-1", { char: "B", color: "#fff" }],
      ["3,4", { char: "C", color: "#fff" }],
    ]);

    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 3, y: -2 },
        edge: "bottom",
      })
    ).toEqual({ x: 3, y: -1 });
    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 3, y: -1 },
        edge: "bottom",
      })
    ).toEqual({ x: 3, y: 4 });
    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 3, y: 4 },
        edge: "top",
      })
    ).toEqual({ x: 3, y: -1 });
  });

  it("treats both visual columns of a wide character as one content cell", () => {
    const grid = new Map([
      ["0,0", { char: "A", color: "#fff" }],
      ["1,0", { char: "你", color: "#fff" }],
      ["3,0", { char: "B", color: "#fff" }],
    ]);

    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 0, y: 0 },
        edge: "right",
      })
    ).toEqual({ x: 3, y: 0 });
    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 1, y: 0 },
        edge: "right",
      })
    ).toEqual({ x: 3, y: 0 });
    expect(
      moveGridAddressToContentBoundary({
        grid,
        address: { x: 3, y: 0 },
        edge: "left",
      })
    ).toEqual({ x: 0, y: 0 });
  });

  it("extends fill ranges only along the dominant axis", () => {
    const source = { start: { x: 2, y: 2 }, end: { x: 4, y: 3 } };
    expect(resolveGridFillRange(source, { x: 8, y: 4 })).toEqual({
      start: { x: 2, y: 2 },
      end: { x: 8, y: 3 },
    });
    expect(resolveGridFillRange(source, { x: 1, y: -3 })).toEqual({
      start: { x: 2, y: -3 },
      end: { x: 4, y: 3 },
    });
  });
});
