import { afterEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";

const initialState = useCanvasStore.getState();

const resetStore = () => {
  useCanvasStore.setState(initialState, true);
  applyFreeformSnapshotToYMaps([]);
};

describe("selectionSlice setSelectionTextAttributes", () => {
  afterEach(() => {
    resetStore();
  });

  it("adds attributes to existing selected cells only", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff" }],
      ["2,0", { char: "B", color: "#ffffff", bgColor: "#111111" }],
    ]);

    useCanvasStore.getState().setSelectionTextAttributes({ bold: true });

    expect(useCanvasStore.getState().grid).toEqual(
      new Map([
        ["0,0", { char: "A", color: "#ffffff", attrs: { bold: true } }],
        [
          "2,0",
          {
            char: "B",
            color: "#ffffff",
            bgColor: "#111111",
            attrs: { bold: true },
          },
        ],
      ])
    );
  });

  it("removes only toggled attributes and preserves other styling", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      [
        "0,0",
        {
          char: "A",
          color: "#ffffff",
          bgColor: "#111111",
          attrs: { bold: true, italic: true, strike: true, inverse: true },
        },
      ],
    ]);

    useCanvasStore.getState().setSelectionTextAttributes({ bold: false });

    expect(useCanvasStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
      bgColor: "#111111",
      attrs: { italic: true, strike: true, inverse: true },
    });
  });

  it("removes attrs when no text attributes remain", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff", attrs: { underline: true } }],
    ]);

    useCanvasStore.getState().setSelectionTextAttributes({ underline: false });

    expect(useCanvasStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
    });
  });

  it("does not update cells in structured mode", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff" }],
    ]);

    useCanvasStore.getState().setSelectionTextAttributes({ bold: true });

    expect(useCanvasStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
    });
  });
});
