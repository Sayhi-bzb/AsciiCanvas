import { afterEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";
import type { CanvasState } from "@/domains/canvas/state/interfaces";

const initialState = useCanvasStore.getState();

const resetStore = () => {
  useCanvasStore.setState(initialState, true);
  applyFreeformSnapshotToYMaps([]);
};

const setTextState = (
  state: Partial<
    Pick<CanvasState, "grid" | "textCursor" | "canvasMode" | "canvasBounds">
  >
) => {
  useCanvasStore.setState({
    canvasMode: "freeform",
    canvasBounds: null,
    grid: new Map(),
    ...state,
  });
};

describe("textSlice newlineText", () => {
  afterEach(() => {
    resetStore();
  });

  it("keeps the current column when the current row is empty", () => {
    setTextState({
      textCursor: { x: 20, y: 3 },
    });

    useCanvasStore.getState().newlineText();

    expect(useCanvasStore.getState().textCursor).toEqual({ x: 20, y: 4 });
  });

  it("inherits real leading indentation when the cursor is after text", () => {
    setTextState({
      textCursor: { x: 8, y: 0 },
      grid: new Map([
        ["4,0", { char: "f", color: "#ffffff" }],
        ["5,0", { char: "o", color: "#ffffff" }],
        ["6,0", { char: "o", color: "#ffffff" }],
      ]),
    });

    useCanvasStore.getState().newlineText();

    expect(useCanvasStore.getState().textCursor).toEqual({ x: 4, y: 1 });
  });

  it("keeps the current column when the cursor is inside indentation", () => {
    setTextState({
      textCursor: { x: 2, y: 0 },
      grid: new Map([
        ["4,0", { char: "f", color: "#ffffff" }],
        ["5,0", { char: "o", color: "#ffffff" }],
        ["6,0", { char: "o", color: "#ffffff" }],
      ]),
    });

    useCanvasStore.getState().newlineText();

    expect(useCanvasStore.getState().textCursor).toEqual({ x: 2, y: 1 });
  });

  it("keeps the current column when text starts to the right of the cursor", () => {
    setTextState({
      textCursor: { x: 3, y: 0 },
      grid: new Map([
        ["10,0", { char: "x", color: "#ffffff" }],
      ]),
    });

    useCanvasStore.getState().newlineText();

    expect(useCanvasStore.getState().textCursor).toEqual({ x: 3, y: 1 });
  });

  it("clamps newline movement to animation bounds", () => {
    setTextState({
      canvasMode: "animation",
      canvasBounds: { width: 10, height: 2 },
      textCursor: { x: 8, y: 1 },
    });

    useCanvasStore.getState().newlineText();

    expect(useCanvasStore.getState().textCursor).toEqual({ x: 8, y: 1 });
  });
});

describe("textSlice writeTextString", () => {
  afterEach(() => {
    resetStore();
  });

  it("preserves CRLF new lines when writing pasted text", () => {
    setTextState({
      textCursor: { x: 3, y: 4 },
    });

    useCanvasStore.getState().writeTextString("a\r\nb");

    expect(useCanvasStore.getState().grid).toEqual(
      new Map([
        ["3,4", { char: "a", color: "#000000" }],
        ["3,5", { char: "b", color: "#000000" }],
      ])
    );
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 4, y: 5 });
  });

  it("writes at the static active cell when legacy cursor and selections are empty", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      canvasBounds: null,
      grid: new Map(),
      textCursor: null,
      selections: [],
      staticGridSelection: {
        activeCell: { x: 6, y: 7 },
        anchorCell: { x: 6, y: 7 },
        ranges: [],
      },
      staticGridEditMode: "navigate",
    });

    useCanvasStore.getState().writeTextString("A");

    expect(useCanvasStore.getState().grid).toEqual(
      new Map([["6,7", { char: "A", color: "#000000" }]])
    );
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 7, y: 7 });
  });
});

describe("textSlice structured box name editing", () => {
  afterEach(() => {
    resetStore();
  });

  it("places the cursor after inserted CJK box name text", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 5, y: 2 },
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 2 },
          end: { x: 12, y: 6 },
          style: { color: "#ffffff" },
        },
      ],
    });

    useCanvasStore.getState().writeTextString("接口");

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "接口" },
    ]);
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 9, y: 2 });
  });

  it("keeps overflow CJK name text while placing the cursor after the visible text", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 3, y: 0 },
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 6, y: 2 },
          style: { color: "#ffffff" },
        },
      ],
    });

    useCanvasStore.getState().writeTextString("接口");

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "接口" },
    ]);
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 5, y: 0 });
  });

  it("reveals overflow CJK name text after the box is widened", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 3, y: 0 },
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 6, y: 2 },
          style: { color: "#ffffff" },
        },
      ],
    });

    useCanvasStore.getState().writeTextString("接口");
    useCanvasStore.getState().updateStructuredBox("box-1", (node) => ({
      ...node,
      end: { x: 10, y: 2 },
    }));

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "接口", end: { x: 10, y: 2 } },
    ]);
  });

  it("backspaces one CJK box name grapheme and moves by its display width", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 9, y: 2 },
      selectedStructuredNodeIds: ["box-1"],
      selectedStructuredBoxId: "box-1",
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 2 },
          end: { x: 12, y: 6 },
          name: "接口",
          style: { color: "#ffffff" },
        },
      ],
    });

    useCanvasStore.getState().backspaceText();

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "接" },
    ]);
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 7, y: 2 });
  });

  it("deletes the next CJK box name grapheme without removing the box", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 5, y: 2 },
      selectedStructuredNodeIds: ["box-1"],
      selectedStructuredBoxId: "box-1",
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 2 },
          end: { x: 12, y: 6 },
          name: "接口",
          style: { color: "#ffffff" },
        },
      ],
    });

    useCanvasStore.getState().deleteTextForward();

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "口" },
    ]);
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 5, y: 2 });
    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });

  it("deletes the next box name character without removing the box", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 6, y: 2 },
      selectedStructuredNodeIds: ["box-1"],
      selectedStructuredBoxId: "box-1",
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 2 },
          end: { x: 12, y: 6 },
          name: "API",
          style: { color: "#ffffff" },
        },
      ],
    });

    useCanvasStore.getState().deleteTextForward();

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "AI" },
    ]);
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 6, y: 2 });
    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });

  it("keeps the box when deleting forward at the end of the name", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 8, y: 2 },
      selectedStructuredNodeIds: ["box-1"],
      selectedStructuredBoxId: "box-1",
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 2 },
          end: { x: 12, y: 6 },
          name: "API",
          style: { color: "#ffffff" },
        },
      ],
    });

    useCanvasStore.getState().deleteTextForward();

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "API" },
    ]);
    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });

  it("backspaces the previous box name character without removing the box", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 6, y: 2 },
      selectedStructuredNodeIds: ["box-1"],
      selectedStructuredBoxId: "box-1",
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 2 },
          end: { x: 12, y: 6 },
          name: "API",
          style: { color: "#ffffff" },
        },
      ],
    });

    useCanvasStore.getState().backspaceText();

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "PI" },
    ]);
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 5, y: 2 });
    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });
});
