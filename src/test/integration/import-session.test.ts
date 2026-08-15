import { afterEach, describe, expect, it } from "vitest";
import { applyFreeformSnapshotToYMaps, useEditorStore } from "@/domains/canvas/testing";
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

  it("imports CharDesk text into a new active session", () => {
    const sessionCount = useEditorStore.getState().canvasSessions.length;
    const session = useEditorStore.getState().importCanvasSession(
      "[38;2;255;0;0mA[0m  \n  [38;2;0;255;0mB[0m"
    );

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

    useEditorStore.getState().importCanvasSession("");

    expect(useEditorStore.getState()).toMatchObject(
      createDocumentInteractionResetPatch()
    );
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
        .importCanvasSession('{"type":"chardesk-document","version":1}')
    ).toThrow("Legacy JSON");

    const after = useEditorStore.getState();
    expect(after.activeCanvasId).toBe(activeCanvasId);
    expect(after.canvasSessions).toHaveLength(sessionCount);
  });
});
