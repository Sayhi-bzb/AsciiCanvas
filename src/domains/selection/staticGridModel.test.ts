import { describe, expect, it } from "vitest";
import {
  collapseGridSelectionTo,
  createGridSelectionState,
  extendGridSelectionTo,
  gridRangeFromSelectionArea,
  moveGridAddress,
  normalizeGridRange,
  selectionAreaFromGridRange,
  getStaticGridViewState,
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

  it("moves and extends active grid selection from an anchor", () => {
    const base = createGridSelectionState({ x: 2, y: 2 });
    const moved = collapseGridSelectionTo(base, moveGridAddress(base.activeCell, 1, 0));
    const extended = extendGridSelectionTo(moved, moveGridAddress(moved.activeCell, 0, 2));

    expect(moved).toEqual({
      activeCell: { x: 3, y: 2 },
      anchorCell: { x: 3, y: 2 },
      ranges: [],
    });
    expect(extended).toEqual({
      activeCell: { x: 3, y: 4 },
      anchorCell: { x: 3, y: 2 },
      ranges: [{ start: { x: 3, y: 2 }, end: { x: 3, y: 4 } }],
    });
  });

  it("derives freeform view state from static selection before legacy selections", () => {
    const view = getStaticGridViewState({
      selection: {
        activeCell: { x: 4, y: 2 },
        anchorCell: { x: 2, y: 2 },
        ranges: [{ start: { x: 2, y: 2 }, end: { x: 4, y: 2 } }],
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
});
