import { afterEach, describe, expect, it } from "vitest";
import {
  ASCII_CANVAS_DOCUMENT_TYPE,
  ASCII_CANVAS_DOCUMENT_VERSION,
} from "@/domains/protocol";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";

describe("importCanvasSession", () => {
  const initialState = useCanvasStore.getState();

  afterEach(() => {
    useCanvasStore.setState(initialState, true);
    applyFreeformSnapshotToYMaps([]);
  });

  it("imports a freeform protocol document into a new active session", () => {
    const session = useCanvasStore.getState().importCanvasSession({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
      mode: "freeform",
      cells: [
        { x: 2, y: 1, char: "B", color: "#00ff00" },
        { x: 0, y: 0, char: "A", color: "#ff0000" },
      ],
    });

    const state = useCanvasStore.getState();
    expect(session.name).toBe("Imported Canvas");
    expect(state.canvasSessions).toHaveLength(2);
    expect(state.activeCanvasId).toBe(session.id);
    expect(state.canvasMode).toBe("freeform");
    expect(state.grid.get("0,0")).toEqual({ char: "A", color: "#ff0000" });
    expect(state.grid.get("2,1")).toEqual({ char: "B", color: "#00ff00" });
  });

  it("imports animation protocol documents with size and timeline metadata", () => {
    const session = useCanvasStore.getState().importCanvasSession(
      JSON.stringify({
        type: ASCII_CANVAS_DOCUMENT_TYPE,
        version: ASCII_CANVAS_DOCUMENT_VERSION,
        mode: "animation",
        size: { width: 64, height: 32 },
        playback: { fps: 8, loop: false },
        frames: [
          {
            id: "f1",
            name: "Idle",
            cells: [{ x: 1, y: 2, char: "@", color: "#ff0000" }],
          },
          {
            id: "f2",
            name: "Blink",
            cells: [{ x: 0, y: 1, char: "*", color: "#00ffcc" }],
          },
        ],
      })
    );

    const state = useCanvasStore.getState();
    expect(session.mode).toBe("animation");
    expect(state.canvasMode).toBe("animation");
    expect(state.canvasBounds).toEqual({ width: 64, height: 32 });
    expect(state.animationTimeline?.fps).toBe(8);
    expect(state.animationTimeline?.loop).toBe(false);
    expect(state.animationTimeline?.frames).toHaveLength(2);
    expect(state.animationIsPlaying).toBe(false);
    expect(state.grid.get("1,2")).toEqual({ char: "@", color: "#ff0000" });
  });

  it("imports asciinema cast documents as animation sessions", () => {
    const session = useCanvasStore.getState().importCanvasSession(
      [
        '{"version":2,"width":5,"height":2,"timestamp":1770000000,"env":{"TERM":"xterm-256color"}}',
        '[0,"o","\\r\\u001b[38;2;255;0;0m@\\u001b[0m    \\n     "]',
        '[0.25,"o","\\r \\u001b[38;2;0;255;0m*\\u001b[0m   \\n     "]',
        "",
      ].join("\n"),
      { name: "Imported Cast" }
    );

    const state = useCanvasStore.getState();
    expect(session.name).toBe("Imported Cast");
    expect(session.mode).toBe("animation");
    expect(state.canvasMode).toBe("animation");
    expect(state.canvasBounds).toEqual({ width: 5, height: 2 });
    expect(state.animationTimeline?.fps).toBe(4);
    expect(state.animationTimeline?.frames).toHaveLength(2);
    expect(state.grid.get("0,0")).toEqual({ char: "@", color: "#ff0000" });
  });

  it("imports structured protocol documents as semantic scenes", () => {
    const session = useCanvasStore.getState().importCanvasSession({
      type: ASCII_CANVAS_DOCUMENT_TYPE,
      version: ASCII_CANVAS_DOCUMENT_VERSION,
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

    const state = useCanvasStore.getState();
    expect(session.mode).toBe("structured");
    expect(state.canvasMode).toBe("structured");
    expect(state.structuredScene).toHaveLength(2);
    expect(state.structuredScene[0]).toMatchObject({
      id: "box-1",
      style: { color: "#111111" },
    });
    expect(state.grid.size).toBeGreaterThan(0);
  });

  it("does not mutate sessions when the payload is invalid", () => {
    const before = useCanvasStore.getState();
    const activeCanvasId = before.activeCanvasId;
    const sessionCount = before.canvasSessions.length;

    expect(() =>
      useCanvasStore
        .getState()
        .importCanvasSession('{"type":"ascii-canvas-document","version":2}')
    ).toThrow("Invalid ascii-canvas-document payload.");

    const after = useCanvasStore.getState();
    expect(after.activeCanvasId).toBe(activeCanvasId);
    expect(after.canvasSessions).toHaveLength(sessionCount);
  });
});
