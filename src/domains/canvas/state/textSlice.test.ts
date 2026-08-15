import { afterEach, describe, expect, it } from "vitest";
import { applyFreeformSnapshotToYMaps, useEditorStore } from "@/domains/canvas/testing";
import type { EditorState } from "@/domains/canvas/state/interfaces";

const initialState = useEditorStore.getState();

const resetStore = () => {
  useEditorStore.setState(initialState, true);
  applyFreeformSnapshotToYMaps([]);
};

const setTextState = (
  state: Partial<
    Pick<EditorState, "grid" | "textCursor" | "canvasMode">
  >
) => {
  useEditorStore.setState({
    canvasMode: "freeform",
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

    useEditorStore.getState().newlineText();

    expect(useEditorStore.getState().textCursor).toEqual({ x: 20, y: 4 });
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

    useEditorStore.getState().newlineText();

    expect(useEditorStore.getState().textCursor).toEqual({ x: 4, y: 1 });
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

    useEditorStore.getState().newlineText();

    expect(useEditorStore.getState().textCursor).toEqual({ x: 2, y: 1 });
  });

  it("keeps the current column when text starts to the right of the cursor", () => {
    setTextState({
      textCursor: { x: 3, y: 0 },
      grid: new Map([
        ["10,0", { char: "x", color: "#ffffff" }],
      ]),
    });

    useEditorStore.getState().newlineText();

    expect(useEditorStore.getState().textCursor).toEqual({ x: 3, y: 1 });
  });

  it("returns to the nearest text run instead of unrelated content on the left", () => {
    setTextState({
      textCursor: { x: 15, y: 0 },
      grid: new Map([
        ["0,0", { char: "x", color: "#ffffff" }],
        ["10,0", { char: "h", color: "#ffffff" }],
        ["11,0", { char: " ", color: "#ffffff" }],
        ["12,0", { char: "好", color: "#ffffff" }],
      ]),
    });

    useEditorStore.getState().newlineText();

    expect(useEditorStore.getState().textCursor).toEqual({ x: 10, y: 1 });
  });

  it("supports text runs at negative columns", () => {
    setTextState({
      textCursor: { x: -1, y: 2 },
      grid: new Map([
        ["-4,2", { char: "a", color: "#ffffff" }],
        ["-3,2", { char: "b", color: "#ffffff" }],
      ]),
    });

    useEditorStore.getState().newlineText();

    expect(useEditorStore.getState().textCursor).toEqual({ x: -4, y: 3 });
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

    useEditorStore.getState().writeTextString("a\r\nb");

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["3,4", { char: "a", color: "#000000" }],
        ["3,5", { char: "b", color: "#000000" }],
      ])
    );
    expect(useEditorStore.getState().textCursor).toEqual({ x: 4, y: 5 });
  });

  it("fills the formal 1x1 selection at the static active cell", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      grid: new Map(),
      textCursor: null,
      staticGridSelection: {
        mode: "range",
        activeCell: { x: 6, y: 7 },
        anchorCell: { x: 6, y: 7 },
        primaryRange: { start: { x: 6, y: 7 }, end: { x: 6, y: 7 } },
        additionalRanges: [],
      },
      staticGridEditMode: "navigate",
    });

    useEditorStore.getState().writeTextString("A");

    expect(useEditorStore.getState().grid).toEqual(
      new Map([["6,7", { char: "A", color: "#000000" }]])
    );
    expect(useEditorStore.getState().textCursor).toBeNull();
  });

  it("keeps ordinary text input on the existing full-cell replacement policy", () => {
    setTextState({ textCursor: { x: 0, y: 0 } });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff", bgColor: "#000000" }],
    ]);

    useEditorStore.getState().writeTextString("X");

    expect(useEditorStore.getState().grid.get("0,0")).toEqual({
      char: "X",
      color: "#000000",
    });
  });
});

describe("textSlice paste background merging", () => {
  afterEach(() => {
    resetStore();
  });

  it("inherits target backgrounds unless rich cells provide one", () => {
    setTextState({ textCursor: { x: 0, y: 0 } });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "A", color: "#ffffff", bgColor: "#000000" }],
      ["1,0", { char: "B", color: "#ffffff", bgColor: "#000000" }],
    ]);

    useEditorStore.getState().pasteRichData([
      { x: 0, y: 0, char: "X", color: "#ff0000" },
      {
        x: 1,
        y: 0,
        char: "Y",
        color: "#00ff00",
        bgColor: "#0000ff",
      },
    ]);

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["0,0", { char: "X", color: "#ff0000", bgColor: "#000000" }],
        ["1,0", { char: "Y", color: "#00ff00", bgColor: "#0000ff" }],
      ])
    );
  });

  it("inherits the anchor background when pasting onto a wide follower", () => {
    setTextState({ textCursor: { x: 1, y: 0 } });
    applyFreeformSnapshotToYMaps([
      ["0,0", { char: "你", color: "#ffffff", bgColor: "#000000" }],
    ]);

    useEditorStore.getState().pasteRichData([
      { x: 0, y: 0, char: "X", color: "#ff0000" },
    ]);

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["1,0", { char: "X", color: "#ff0000", bgColor: "#000000" }],
      ])
    );
  });

  it("anchors sparse rich data at the selection union top-left and preserves holes", () => {
    setTextState({ textCursor: null });
    useEditorStore.setState({
      staticGridEditMode: "navigate",
      staticGridSelection: {
        mode: "range",
        activeCell: { x: 5, y: 4 },
        anchorCell: { x: 5, y: 4 },
        primaryRange: { start: { x: 5, y: 4 }, end: { x: 6, y: 5 } },
        additionalRanges: [
          { start: { x: 2, y: 3 }, end: { x: 2, y: 3 } },
        ],
      },
    });
    applyFreeformSnapshotToYMaps([
      ["2,3", { char: "A", color: "#ffffff" }],
      ["3,3", { char: "B", color: "#ffffff" }],
      ["2,4", { char: "C", color: "#ffffff" }],
      ["3,4", { char: "D", color: "#ffffff" }],
    ]);

    useEditorStore.getState().pasteRichData([
      { x: 1, y: 0, char: "b", color: "#ff0000" },
      { x: 0, y: 1, char: "c", color: "#00ff00" },
    ]);

    expect(useEditorStore.getState().grid).toEqual(
      new Map([
        ["2,3", { char: "A", color: "#ffffff" }],
        ["3,3", { char: "b", color: "#ff0000" }],
        ["2,4", { char: "c", color: "#00ff00" }],
        ["3,4", { char: "D", color: "#ffffff" }],
      ])
    );
  });
});

describe("textSlice structured box name editing", () => {
  afterEach(() => {
    resetStore();
  });

  it("places the cursor after inserted CJK box name text", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().writeTextString("接口");

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "接口" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 9, y: 2 });
  });

  it("keeps overflow CJK name text while placing the cursor after the visible text", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().writeTextString("接口");

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "接口" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 5, y: 0 });
  });

  it("reveals overflow CJK name text after the box is widened", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().writeTextString("接口");
    useEditorStore.getState().updateStructuredBox("box-1", (node) => ({
      ...node,
      end: { x: 10, y: 2 },
    }));

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "接口", end: { x: 10, y: 2 } },
    ]);
  });

  it("backspaces one CJK box name grapheme and moves by its display width", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().backspaceText();

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "接" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 7, y: 2 });
  });

  it("deletes the next CJK box name grapheme without removing the box", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().deleteTextForward();

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "口" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 5, y: 2 });
    expect(useEditorStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });

  it("deletes the next box name character without removing the box", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().deleteTextForward();

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "AI" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 6, y: 2 });
    expect(useEditorStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });

  it("keeps the box when deleting forward at the end of the name", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().deleteTextForward();

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "API" },
    ]);
    expect(useEditorStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });

  it("backspaces the previous box name character without removing the box", () => {
    useEditorStore.setState({
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

    useEditorStore.getState().backspaceText();

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "PI" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 5, y: 2 });
    expect(useEditorStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });

  it("creates a structured text node from structured grid focus input", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      structuredScene: [],
      grid: new Map(),
      textCursor: null,
      structuredGridFocus: { x: 7, y: 4 },
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      brushColor: "#abcdef",
    });

    useEditorStore.getState().writeTextString("Hi");

    const state = useEditorStore.getState();
    expect(state.structuredScene).toHaveLength(1);
    expect(state.structuredScene[0]).toMatchObject({
      type: "text",
      position: { x: 7, y: 4 },
      text: "Hi",
      style: { color: "#abcdef" },
    });
    expect(state.structuredGridFocus).toBeNull();
    expect(state.textCursor).toEqual({ x: 9, y: 4 });
    expect(state.selectedStructuredNodeIds).toEqual([state.structuredScene[0].id]);
  });

  it("inserts structured text at the clicked offset on a later line", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      textCursor: { x: 1, y: 1 },
      editingStructuredTextNodeId: "text-1",
      selectedStructuredNodeIds: ["text-1"],
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "AB\nCD",
          style: { color: "#ffffff" },
        },
      ],
    });

    useEditorStore.getState().writeTextString("!");

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "text-1", text: "AB\nC!D" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 2, y: 1 });
  });

  it("inserts a newline inside the active structured text node", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      textCursor: { x: 1, y: 0 },
      editingStructuredTextNodeId: "text-1",
      selectedStructuredNodeIds: ["text-1"],
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "AB",
          style: { color: "#ffffff" },
        },
      ],
    });

    useEditorStore.getState().newlineText();

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "text-1", text: "A\nB" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 0, y: 1 });
  });

  it("backspaces structured text by layout offset on later lines", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      textCursor: { x: 1, y: 1 },
      editingStructuredTextNodeId: "text-1",
      selectedStructuredNodeIds: ["text-1"],
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "AB\nCD",
          style: { color: "#ffffff" },
        },
      ],
    });

    useEditorStore.getState().backspaceText();

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "text-1", text: "AB\nD" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 0, y: 1 });
  });

  it("deletes structured text forward by layout offset on later lines", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      textCursor: { x: 1, y: 1 },
      editingStructuredTextNodeId: "text-1",
      selectedStructuredNodeIds: ["text-1"],
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "AB\nCD",
          style: { color: "#ffffff" },
        },
      ],
    });

    useEditorStore.getState().deleteTextForward();

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "text-1", text: "AB\nC" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 1, y: 1 });
  });

  it("inserts structured text after a wide character and moves the caret by width", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      textCursor: { x: 2, y: 0 },
      editingStructuredTextNodeId: "text-1",
      selectedStructuredNodeIds: ["text-1"],
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "你A",
          style: { color: "#ffffff" },
        },
      ],
    });

    useEditorStore.getState().writeTextString("!");

    expect(useEditorStore.getState().structuredScene).toMatchObject([
      { id: "text-1", text: "你!A" },
    ]);
    expect(useEditorStore.getState().textCursor).toEqual({ x: 3, y: 0 });
  });

  it("moves left across a structured CJK character by its display width", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      textCursor: { x: 2, y: 0 },
      editingStructuredTextNodeId: "text-1",
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "你A",
          style: { color: "#ffffff" },
        },
      ],
    });

    useEditorStore.getState().moveTextCursor(-1, 0);

    expect(useEditorStore.getState().textCursor).toEqual({ x: 0, y: 0 });
  });

  it("moves right across a structured CJK character by its display width", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      textCursor: { x: 0, y: 0 },
      editingStructuredTextNodeId: "text-1",
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "你A",
          style: { color: "#ffffff" },
        },
      ],
    });

    useEditorStore.getState().moveTextCursor(1, 0);

    expect(useEditorStore.getState().textCursor).toEqual({ x: 2, y: 0 });
  });

  it("moves left from after a structured wide character to its anchor", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      textCursor: { x: 3, y: 0 },
      editingStructuredTextNodeId: "text-1",
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "A你B",
          style: { color: "#ffffff" },
        },
      ],
    });

    useEditorStore.getState().moveTextCursor(-1, 0);

    expect(useEditorStore.getState().textCursor).toEqual({ x: 1, y: 0 });
  });
});
