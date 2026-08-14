import { afterEach, describe, expect, it } from "vitest";
import type { EditorState } from "./interfaces";
import { useEditorStore } from "@/domains/canvas/testing";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/testing";
import { createDocumentInteractionResetPatch } from "./transitions/editorTransitions";

const initialState = useEditorStore.getState();

const markDocumentInteractionDirty = () => {
  useEditorStore.setState({
    selections: [{ start: { x: 1, y: 1 }, end: { x: 2, y: 2 } }],
    textCursor: { x: 3, y: 4 },
    editingStructuredTextNodeId: "text-node",
    structuredTextSelection: {
      nodeId: "text-node",
      anchor: 1,
      focus: 2,
    },
    selectedStructuredNodeIds: ["node"],
    selectedStructuredBoxId: "box",
    selectedStructuredSplitHandle: {
      nodeId: "split-box",
      handle: { kind: "line", splitId: "split" } as never,
    },
    structuredContextPoint: { x: 5, y: 6 },
    structuredGridFocus: { x: 7, y: 8 },
    staticGridSelection: {
      activeCell: { x: 9, y: 9 },
      anchorCell: { x: 8, y: 8 },
      ranges: [
        { start: { x: 8, y: 8 }, end: { x: 9, y: 9 } },
      ],
    },
    staticGridEditMode: "text-edit",
    hoveredGrid: { x: 10, y: 10 },
    scratchLayer: new Map([
      ["0,0", { char: "X", color: "#fff" }],
    ]),
    canvasColorPickerTarget: "char",
  } satisfies Partial<EditorState>);
};

const expectDocumentInteractionReset = () => {
  expect(useEditorStore.getState()).toMatchObject(
    createDocumentInteractionResetPatch()
  );
};

describe("session transitions", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    applyFreeformSnapshotToYMaps([]);
  });

  it("clears document interaction when creating a session", () => {
    markDocumentInteractionDirty();
    useEditorStore.getState().createCanvasSession("freeform");
    expectDocumentInteractionReset();
  });

  it("clears document interaction when switching sessions", () => {
    const firstSessionId = useEditorStore.getState().activeCanvasId;
    useEditorStore.getState().createCanvasSession("freeform");
    markDocumentInteractionDirty();

    useEditorStore.getState().switchCanvasSession(firstSessionId);
    expectDocumentInteractionReset();
  });

  it("clears document interaction when removing the active session", () => {
    useEditorStore.getState().createCanvasSession("freeform");
    const activeSessionId = useEditorStore.getState().activeCanvasId;
    markDocumentInteractionDirty();

    useEditorStore.getState().removeCanvasSession(activeSessionId);
    expectDocumentInteractionReset();
  });

  it("preserves Hand while entering and restoring a structured session", () => {
    useEditorStore.getState().createCanvasSession("structured");
    const structuredSessionId = useEditorStore.getState().activeCanvasId;

    useEditorStore.getState().setTool("pan");
    expect(useEditorStore.getState()).toMatchObject({
      canvasMode: "structured",
      tool: "pan",
    });

    useEditorStore.getState().createCanvasSession("freeform");
    useEditorStore.getState().switchCanvasSession(structuredSessionId);
    expect(useEditorStore.getState()).toMatchObject({
      canvasMode: "structured",
      tool: "pan",
    });
  });
});
