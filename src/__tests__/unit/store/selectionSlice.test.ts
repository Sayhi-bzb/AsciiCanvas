import { afterEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";
import { DEFAULT_SESSION_ID } from "@/domains/canvas/state/helpers/storeUtils";

const initialState = useCanvasStore.getState();

const resetStore = () => {
  useCanvasStore.setState(
    {
      ...initialState,
      grid: new Map(),
      canvasSessions: initialState.canvasSessions.map((session) =>
        session.id === DEFAULT_SESSION_ID ? { ...session, grid: [] } : session
      ),
    },
    true
  );
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

  it("materializes blank selected cells for underline using the brush color", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      brushColor: "#2563eb",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([]);

    useCanvasStore.getState().setSelectionTextAttributes({ underline: true });

    expect(useCanvasStore.getState().grid).toEqual(
      new Map([
        ["0,0", { char: " ", color: "#2563eb", attrs: { underline: true } }],
        ["1,0", { char: " ", color: "#2563eb", attrs: { underline: true } }],
      ])
    );
  });

  it("materializes blank selected cells for strike using the brush color", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      brushColor: "#ef4444",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([]);

    useCanvasStore.getState().setSelectionTextAttributes({ strike: true });

    expect(useCanvasStore.getState().grid.get("0,0")).toEqual({
      char: " ",
      color: "#ef4444",
      attrs: { strike: true },
    });
  });

  it("does not materialize blank selected cells for bold or italic only", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([]);

    useCanvasStore
      .getState()
      .setSelectionTextAttributes({ bold: true, italic: true });

    expect(useCanvasStore.getState().grid).toEqual(new Map());
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

  it("deletes materialized blank cells when underline is removed", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: " ", color: "#ffffff", attrs: { underline: true } }],
    ]);

    useCanvasStore.getState().setSelectionTextAttributes({ underline: false });

    expect(useCanvasStore.getState().grid).toEqual(new Map());
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

describe("selectionSlice setSelectionBackgroundColor", () => {
  afterEach(() => {
    resetStore();
  });

  it("fills background color on existing selected cells only", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff" }],
      ["2,0", { char: "B", color: "#ffffff", attrs: { bold: true } }],
    ]);

    useCanvasStore.getState().setSelectionBackgroundColor("#2563eb");

    expect(useCanvasStore.getState().grid).toEqual(
      new Map([
        ["0,0", { char: "A", color: "#ffffff", bgColor: "#2563eb" }],
        [
          "2,0",
          {
            char: "B",
            color: "#ffffff",
            bgColor: "#2563eb",
            attrs: { bold: true },
          },
        ],
      ])
    );
  });

  it("clears background color while preserving foreground and attributes", () => {
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
          bgColor: "#2563eb",
          attrs: { underline: true },
        },
      ],
    ]);

    useCanvasStore.getState().setSelectionBackgroundColor(null);

    expect(useCanvasStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
      attrs: { underline: true },
    });
  });

  it("does not create cells for empty selected positions", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["1,0", { char: "A", color: "#ffffff" }],
    ]);

    useCanvasStore.getState().setSelectionBackgroundColor("#2563eb");

    expect(useCanvasStore.getState().grid).toEqual(
      new Map([
        ["1,0", { char: "A", color: "#ffffff", bgColor: "#2563eb" }],
      ])
    );
  });

  it("does not update background color in structured mode", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff" }],
    ]);

    useCanvasStore.getState().setSelectionBackgroundColor("#2563eb");

    expect(useCanvasStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
    });
  });
});
