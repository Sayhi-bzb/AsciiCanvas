import { describe, expect, it } from "vitest";
import {
  EDITOR_PERSISTENCE_VERSION,
  flattenPersistedEditorState,
  isPersistedEditorStateV4,
  migratePersistedStateToV4,
} from "./public";

describe("editor persistence v4", () => {
  it("drops legacy animation sessions and keeps static sessions", () => {
    const migrated = migratePersistedStateToV4({
      schemaVersion: 2,
      workspace: { canvasMode: "animation" },
      sessions: {
        activeId: "old-animation",
        items: [
          { id: "old-animation", name: "Old", mode: "animation", scene: [], grid: [] },
          { id: "static", name: "Static", mode: "freeform", scene: [], grid: [] },
        ],
      },
    });
    expect(migrated.schemaVersion).toBe(EDITOR_PERSISTENCE_VERSION);
    expect(migrated.sessions.items.map((session) => session.id)).toEqual(["static"]);
    expect(migrated.sessions.activeId).toBe("static");
    expect(isPersistedEditorStateV4(migrated)).toBe(true);
  });

  it("creates a blank freeform session when no static session remains", () => {
    const migrated = migratePersistedStateToV4({
      sessions: {
        activeId: "old-animation",
        items: [{ id: "old-animation", name: "Old", mode: "animation", scene: [], grid: [] }],
      },
    });
    expect(flattenPersistedEditorState(migrated)).toMatchObject({
      canvasMode: "freeform",
      activeCanvasId: "canvas-1",
      canvasSessions: [{ id: "canvas-1", mode: "freeform", grid: [] }],
    });
  });
  it("preserves and normalizes slide sessions in v4", () => {
    const migrated = migratePersistedStateToV4({
      schemaVersion: 4,
      workspace: { canvasMode: "slide" },
      sessions: {
        activeId: "deck",
        items: [{
          id: "deck",
          name: "Slides",
          mode: "slide",
          scene: [],
          grid: [],
          slideDeck: {
            size: { columns: 2, rows: 1 },
            activeSlideId: "slide-1",
            slides: [{
              id: "slide-1",
              name: "Slide 1",
              grid: [
                ["0,0", { char: "A", color: "#fff" }],
                ["2,0", { char: "B", color: "#fff" }],
              ],
            }],
          },
        }],
      },
    });

    expect(flattenPersistedEditorState(migrated)).toMatchObject({
      canvasMode: "slide",
      activeCanvasId: "deck",
      canvasSessions: [{
        id: "deck",
        mode: "slide",
        slideDeck: {
          activeSlideId: "slide-1",
          slides: [{ grid: [["0,0", { char: "A", color: "#fff" }]] }],
        },
      }],
    });
  });
});
