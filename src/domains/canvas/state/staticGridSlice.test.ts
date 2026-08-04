import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/domains/canvas/public";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/public";

const initialState = useEditorStore.getState();

const resetStore = () => {
  useEditorStore.setState(
    {
      ...initialState,
      canvasMode: "freeform",
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
    useEditorStore.getState().setStaticGridActiveCell({ x: 4, y: 5 });
    useEditorStore.getState().moveStaticGridFocus(1, -2);

    expect(useEditorStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 5, y: 3 },
      anchorCell: { x: 5, y: 3 },
      ranges: [],
    });
    expect(useEditorStore.getState().textCursor).toEqual({ x: 5, y: 3 });
    expect(useEditorStore.getState().selections).toEqual([]);
  });

  it("extends selection from the anchor and syncs legacy selections", () => {
    useEditorStore.getState().setStaticGridActiveCell({ x: 2, y: 2 });
    useEditorStore.getState().moveStaticGridFocus(3, 1, { extend: true });

    expect(useEditorStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 5, y: 3 },
      anchorCell: { x: 2, y: 2 },
      ranges: [{ start: { x: 2, y: 2 }, end: { x: 5, y: 3 } }],
    });
    expect(useEditorStore.getState().textCursor).toBeNull();
    expect(useEditorStore.getState().selections).toEqual([
      { start: { x: 2, y: 2 }, end: { x: 5, y: 3 } },
    ]);
  });

  it("extends selection left across repeated shift arrow moves", () => {
    useEditorStore.getState().setStaticGridActiveCell({ x: 5, y: 5 });
    useEditorStore.getState().moveStaticGridFocus(-1, 0, { extend: true });
    useEditorStore.getState().moveStaticGridFocus(-1, 0, { extend: true });

    expect(useEditorStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 3, y: 5 },
      anchorCell: { x: 5, y: 5 },
      ranges: [{ start: { x: 3, y: 5 }, end: { x: 5, y: 5 } }],
    });
    expect(useEditorStore.getState().textCursor).toBeNull();
    expect(useEditorStore.getState().selections).toEqual([
      { start: { x: 3, y: 5 }, end: { x: 5, y: 5 } },
    ]);
  });

  it("extends selection up across repeated shift arrow moves", () => {
    useEditorStore.getState().setStaticGridActiveCell({ x: 5, y: 5 });
    useEditorStore.getState().moveStaticGridFocus(0, -1, { extend: true });
    useEditorStore.getState().moveStaticGridFocus(0, -1, { extend: true });

    expect(useEditorStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 5, y: 3 },
      anchorCell: { x: 5, y: 5 },
      ranges: [{ start: { x: 5, y: 3 }, end: { x: 5, y: 5 } }],
    });
    expect(useEditorStore.getState().textCursor).toBeNull();
    expect(useEditorStore.getState().selections).toEqual([
      { start: { x: 5, y: 3 }, end: { x: 5, y: 5 } },
    ]);
  });
  it("clears legacy selections without losing the active cell", () => {
    useEditorStore.getState().setStaticGridSelectionRange({
      start: { x: 1, y: 1 },
      end: { x: 3, y: 4 },
    });
    useEditorStore.getState().clearStaticGridSelection();

    expect(useEditorStore.getState().staticGridSelection).toEqual({
      activeCell: { x: 3, y: 4 },
      anchorCell: { x: 3, y: 4 },
      ranges: [],
    });
    expect(useEditorStore.getState().textCursor).toBeNull();
    expect(useEditorStore.getState().selections).toEqual([]);
  });
});
