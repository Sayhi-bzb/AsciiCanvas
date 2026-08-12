import { describe, expect, it } from "vitest";
import {
  EDITOR_PERSISTENCE_VERSION,
  flattenPersistedEditorState,
  isPersistedEditorStateV5,
  migratePersistedStateToV5,
} from "./public";

describe("editor persistence v5", () => {
  it("drops legacy animation sessions and keeps static sessions", () => {
    const migrated = migratePersistedStateToV5({
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
    expect(isPersistedEditorStateV5(migrated)).toBe(true);
  });

  it("creates a blank freeform session when no static session remains", () => {
    const migrated = migratePersistedStateToV5({
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
    const migrated = migratePersistedStateToV5({
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
          slides: [
            {
              size: { columns: 2, rows: 1 },
              grid: [["0,0", { char: "A", color: "#fff" }]],
            },
          ],
        },
      }],
    });
  });

  it("keeps V1 session content but drops its unsupported room descriptor", () => {
    const migrated = migratePersistedStateToV5({
      schemaVersion: 4,
      sessions: {
        activeId: "legacy-room",
        items: [
          {
            id: "legacy-room",
            name: "Legacy room",
            mode: "freeform",
            scene: [],
            components: [],
            grid: [["0,0", { char: "A", color: "#fff" }]],
            collaboration: {
              version: 1,
              provider: "p2p",
              roomId: "room-id-1234567890",
              key: "room-key-1234567890123456789012345678901234567890",
            },
          },
        ],
      },
    });

    expect(migrated.sessions.items[0]).toMatchObject({
      id: "legacy-room",
      grid: [["0,0", { char: "A", color: "#fff" }]],
    });
    expect(migrated.sessions.items[0].collaboration).toBeUndefined();
  });
});
