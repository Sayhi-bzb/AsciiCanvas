import { afterEach, describe, expect, it } from "vitest";
import {
  CHARDESK_DOCUMENT_TYPE,
  CHARDESK_DOCUMENT_VERSION,
} from "@/domains/document/public";
import { useEditorStore } from "@/domains/canvas/testing";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";
import { DEFAULT_SESSION_ID } from "@/domains/canvas/state/helpers/storeUtils";
import { createDocumentInteractionResetPatch } from "@/domains/canvas/state/transitions/editorTransitions";

describe("importCanvasSession", () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
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
  });

  it("imports a freeform protocol document into a new active session", () => {
    const sessionCount = useEditorStore.getState().canvasSessions.length;
    const session = useEditorStore.getState().importCanvasSession({
      type: CHARDESK_DOCUMENT_TYPE,
      version: CHARDESK_DOCUMENT_VERSION,
      mode: "freeform",
      cells: [
        { x: 2, y: 1, char: "B", color: "#00ff00" },
        { x: 0, y: 0, char: "A", color: "#ff0000" },
      ],
    });

    const state = useEditorStore.getState();
    expect(session.name).toBe("Imported Canvas");
    expect(state.canvasSessions).toHaveLength(sessionCount + 1);
    expect(state.activeCanvasId).toBe(session.id);
    expect(state.canvasMode).toBe("freeform");
    expect(state.grid.get("0,0")).toEqual({ char: "A", color: "#ff0000" });
    expect(state.grid.get("2,1")).toEqual({ char: "B", color: "#00ff00" });
  });

  it("clears document interaction when importing a session", () => {
    useEditorStore.setState({
      textCursor: { x: 3, y: 4 },
      structuredGridFocus: { x: 5, y: 6 },
      staticGridEditMode: "text-edit",
      hoveredGrid: { x: 7, y: 8 },
      scratchLayer: new Map([
        ["0,0", { char: "X", color: "#fff" }],
      ]),
      canvasColorPickerTarget: "bg",
    });

    useEditorStore.getState().importCanvasSession({
      type: CHARDESK_DOCUMENT_TYPE,
      version: CHARDESK_DOCUMENT_VERSION,
      mode: "freeform",
      cells: [],
    });

    expect(useEditorStore.getState()).toMatchObject(
      createDocumentInteractionResetPatch()
    );
  });



  it("imports structured protocol documents as semantic scenes", () => {
    const session = useEditorStore.getState().importCanvasSession({
      type: CHARDESK_DOCUMENT_TYPE,
      version: CHARDESK_DOCUMENT_VERSION,
      mode: "structured",
      nodes: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 3, y: 2 },
          name: "Box",
          style: { color: "#111111" },
        },
        {
          id: "text-1",
          type: "text",
          order: 2,
          position: { x: 1, y: 1 },
          text: "Hi",
          style: { color: "#ffffff" },
        },
      ],
    });

    const state = useEditorStore.getState();
    expect(session.mode).toBe("structured");
    expect(state.canvasMode).toBe("structured");
    expect(state.structuredScene).toHaveLength(2);
    expect(state.structuredScene[0]).toMatchObject({
      id: "box-1",
      style: { color: "#111111" },
    });
    expect(state.grid.size).toBeGreaterThan(0);
  });

  it("imports Agent-generated Markdown as a new active Slide Deck", () => {
    const before = useEditorStore.getState();
    const session = before.importCanvasSession(
      [
        "---",
        "chardesk: slides/v1",
        "title: Agent Deck",
        "---",
        "## Intro",
        "```text size=8x3",
        " A",
        "```",
        "## Next",
        "```chardesk size=8x3",
        "[31mR[0m",
        "```",
      ].join("\n")
    );

    const state = useEditorStore.getState();
    expect(session).toMatchObject({ mode: "slide", name: "Agent Deck" });
    expect(state.canvasSessions.some((item) => item.id === before.activeCanvasId)).toBe(true);
    expect(state.activeCanvasId).toBe(session.id);
    expect(state.canvasMode).toBe("slide");
    expect(state.slideDeck?.slides.map((slide) => slide.name)).toEqual([
      "Intro",
      "Next",
    ]);
    expect(state.grid.get("1,0")).toMatchObject({ char: "A" });
  });

  it("does not mutate sessions when the payload is invalid", () => {
    const before = useEditorStore.getState();
    const activeCanvasId = before.activeCanvasId;
    const sessionCount = before.canvasSessions.length;

    expect(() =>
      useEditorStore
        .getState()
        .importCanvasSession('{"type":"ascii-canvas-document","version":1}')
    ).toThrow("Invalid chardesk-document payload.");

    const after = useEditorStore.getState();
    expect(after.activeCanvasId).toBe(activeCanvasId);
    expect(after.canvasSessions).toHaveLength(sessionCount);
  });
});
