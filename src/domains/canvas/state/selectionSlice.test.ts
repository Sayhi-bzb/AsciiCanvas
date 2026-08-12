import { afterEach, describe, expect, it } from "vitest";
import { applyFreeformSnapshotToYMaps, useEditorStore } from "@/domains/canvas/testing";
import { DEFAULT_SESSION_ID } from "@/domains/canvas/state/helpers/storeUtils";

const initialState = useEditorStore.getState();

const resetStore = () => {
  useEditorStore.setState(
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
    useEditorStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff" }],
      ["2,0", { char: "B", color: "#ffffff", bgColor: "#111111" }],
    ]);

    useEditorStore.getState().setSelectionTextAttributes({ bold: true });

    expect(useEditorStore.getState().grid).toEqual(
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
    useEditorStore.setState({
      canvasMode: "freeform",
      brushColor: "#2563eb",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([]);

    useEditorStore.getState().setSelectionTextAttributes({ underline: true });

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["0,0", { char: " ", color: "#2563eb", attrs: { underline: true } }],
        ["1,0", { char: " ", color: "#2563eb", attrs: { underline: true } }],
      ])
    );
  });

  it("materializes blank selected cells for strike using the brush color", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      brushColor: "#ef4444",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([]);

    useEditorStore.getState().setSelectionTextAttributes({ strike: true });

    expect(useEditorStore.getState().grid.get("0,0")).toEqual({
      char: " ",
      color: "#ef4444",
      attrs: { strike: true },
    });
  });

  it("does not materialize blank selected cells for bold or italic only", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([]);

    useEditorStore
      .getState()
      .setSelectionTextAttributes({ bold: true, italic: true });

    expect(useEditorStore.getState().grid).toEqual(new Map());
  });

  it("removes only toggled attributes and preserves other styling", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().setSelectionTextAttributes({ bold: false });

    expect(useEditorStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
      bgColor: "#111111",
      attrs: { italic: true, strike: true, inverse: true },
    });
  });

  it("removes attrs when no text attributes remain", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff", attrs: { underline: true } }],
    ]);

    useEditorStore.getState().setSelectionTextAttributes({ underline: false });

    expect(useEditorStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
    });
  });

  it("deletes materialized blank cells when underline is removed", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: " ", color: "#ffffff", attrs: { underline: true } }],
    ]);

    useEditorStore.getState().setSelectionTextAttributes({ underline: false });

    expect(useEditorStore.getState().grid).toEqual(new Map());
  });

  it("does not update cells in structured mode", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      grid: new Map([["0,0", { char: "A", color: "#ffffff" }]]),
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });

    useEditorStore.getState().setSelectionTextAttributes({ bold: true });

    expect(useEditorStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
    });
  });
});


describe("selectionSlice static grid selection compatibility", () => {
  afterEach(() => {
    resetStore();
  });

  it("fills cells from static grid ranges when legacy selections are empty", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      brushColor: "#22c55e",
      selections: [],
      staticGridSelection: {
        activeCell: { x: 2, y: 0 },
        anchorCell: { x: 0, y: 0 },
        ranges: [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
      },
    });
    applyFreeformSnapshotToYMaps([]);

    useEditorStore.getState().fillSelectionsWithChar("X");

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["0,0", { char: "X", color: "#22c55e" }],
        ["1,0", { char: "X", color: "#22c55e" }],
        ["2,0", { char: "X", color: "#22c55e" }],
      ])
    );
  });

  it("styles and materializes cells from static grid ranges when legacy selections are empty", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      brushColor: "#f8fafc",
      selections: [],
      staticGridSelection: {
        activeCell: { x: 2, y: 0 },
        anchorCell: { x: 0, y: 0 },
        ranges: [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
      },
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff" }],
      ["2,0", { char: "B", color: "#ffffff" }],
    ]);

    useEditorStore.getState().setSelectionBackgroundColor("#0f172a");

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["0,0", { char: "A", color: "#ffffff", bgColor: "#0f172a" }],
        ["1,0", { char: " ", color: "#f8fafc", bgColor: "#0f172a" }],
        ["2,0", { char: "B", color: "#ffffff", bgColor: "#0f172a" }],
      ])
    );
  });
});
describe("selectionSlice setSelectionBackgroundColor", () => {
  afterEach(() => {
    resetStore();
  });

  it("fills background color and materializes empty selected cells", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      brushColor: "#f8fafc",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff" }],
      ["2,0", { char: "B", color: "#ffffff", attrs: { bold: true } }],
    ]);

    useEditorStore.getState().setSelectionBackgroundColor("#2563eb");

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["0,0", { char: "A", color: "#ffffff", bgColor: "#2563eb" }],
        ["1,0", { char: " ", color: "#f8fafc", bgColor: "#2563eb" }],
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
    useEditorStore.setState({
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

    useEditorStore.getState().setSelectionBackgroundColor(null);

    expect(useEditorStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
      attrs: { underline: true },
    });
  });

  it("clears background color without materializing empty selected positions", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 2, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["1,0", { char: "A", color: "#ffffff", bgColor: "#2563eb" }],
    ]);

    useEditorStore.getState().setSelectionBackgroundColor(null);

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["1,0", { char: "A", color: "#ffffff" }],
      ])
    );
  });

  it("deletes materialized blank cells when background color is cleared", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: " ", color: "#ffffff", bgColor: "#2563eb" }],
    ]);

    useEditorStore.getState().setSelectionBackgroundColor(null);

    expect(useEditorStore.getState().grid).toEqual(new Map());
  });

  it("does not update background color in structured mode", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      grid: new Map([["0,0", { char: "A", color: "#ffffff" }]]),
      selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
    });

    useEditorStore.getState().setSelectionBackgroundColor("#2563eb");

    expect(useEditorStore.getState().grid.get("0,0")).toEqual({
      char: "A",
      color: "#ffffff",
    });
  });
});
