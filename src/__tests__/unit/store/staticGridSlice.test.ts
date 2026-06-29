import { afterEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";

const initialState = useCanvasStore.getState();

const resetStore = () => {
  useCanvasStore.setState(
    {
      ...initialState,
      canvasMode: "freeform",
      canvasBounds: null,
      grid: new Map(),
      textCursor: null,
      selections: [],
      staticGridSelection: {
        activeCell: { x: 0, y: 0 },
        anchorCell: { x: 0, y: 0 },
        ranges: [],
      },
      staticGridEditMode: "navigate",
    },
    true
  );
  applyFreeformSnapshotToYMaps([]);
};

describe("staticGridSlice", () => {
  afterEach(() => {
    resetStore();
  });

  it("moves the active cell and keeps legacy text cursor in sync", () => {
    useCanvasStore.getState().setStaticGridActiveCell({ x: 4, y: 5 });
    useCanvasStore.getState().moveStaticGridFocus(1, -2);

    expect(useCanvasStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 5, y: 3 },
      anchorCell: { x: 5, y: 3 },
      ranges: [],
    });
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 5, y: 3 });
    expect(useCanvasStore.getState().selections).toEqual([]);
  });

  it("extends selection from the anchor and syncs legacy selections", () => {
    useCanvasStore.getState().setStaticGridActiveCell({ x: 2, y: 2 });
    useCanvasStore.getState().moveStaticGridFocus(3, 1, { extend: true });

    expect(useCanvasStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 5, y: 3 },
      anchorCell: { x: 2, y: 2 },
      ranges: [{ start: { x: 2, y: 2 }, end: { x: 5, y: 3 } }],
    });
    expect(useCanvasStore.getState().textCursor).toBeNull();
    expect(useCanvasStore.getState().selections).toEqual([
      { start: { x: 2, y: 2 }, end: { x: 5, y: 3 } },
    ]);
  });

  it("extends selection left across repeated shift arrow moves", () => {
    useCanvasStore.getState().setStaticGridActiveCell({ x: 5, y: 5 });
    useCanvasStore.getState().moveStaticGridFocus(-1, 0, { extend: true });
    useCanvasStore.getState().moveStaticGridFocus(-1, 0, { extend: true });

    expect(useCanvasStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 3, y: 5 },
      anchorCell: { x: 5, y: 5 },
      ranges: [{ start: { x: 3, y: 5 }, end: { x: 5, y: 5 } }],
    });
    expect(useCanvasStore.getState().textCursor).toBeNull();
    expect(useCanvasStore.getState().selections).toEqual([
      { start: { x: 3, y: 5 }, end: { x: 5, y: 5 } },
    ]);
  });

  it("extends selection up across repeated shift arrow moves", () => {
    useCanvasStore.getState().setStaticGridActiveCell({ x: 5, y: 5 });
    useCanvasStore.getState().moveStaticGridFocus(0, -1, { extend: true });
    useCanvasStore.getState().moveStaticGridFocus(0, -1, { extend: true });

    expect(useCanvasStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 5, y: 3 },
      anchorCell: { x: 5, y: 5 },
      ranges: [{ start: { x: 5, y: 3 }, end: { x: 5, y: 5 } }],
    });
    expect(useCanvasStore.getState().textCursor).toBeNull();
    expect(useCanvasStore.getState().selections).toEqual([
      { start: { x: 5, y: 3 }, end: { x: 5, y: 5 } },
    ]);
  });
  it("clears legacy selections without losing the active cell", () => {
    useCanvasStore.getState().setStaticGridSelectionRange({
      start: { x: 1, y: 1 },
      end: { x: 3, y: 4 },
    });
    useCanvasStore.getState().clearStaticGridSelection();

    expect(useCanvasStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 3, y: 4 },
      anchorCell: { x: 3, y: 4 },
      ranges: [],
    });
    expect(useCanvasStore.getState().textCursor).toBeNull();
    expect(useCanvasStore.getState().selections).toEqual([]);
  });
});
