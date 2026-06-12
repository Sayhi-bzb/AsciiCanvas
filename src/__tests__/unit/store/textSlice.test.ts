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
});
