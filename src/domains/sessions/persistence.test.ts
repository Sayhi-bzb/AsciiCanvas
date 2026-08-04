import { describe, expect, it } from "vitest";
import {
  EDITOR_PERSISTENCE_VERSION,
  flattenPersistedEditorState,
  isPersistedEditorStateV3,
  migratePersistedStateToV3,
} from "./public";

describe("editor persistence v3", () => {
  it("drops legacy animation sessions and keeps static sessions", () => {
    const migrated = migratePersistedStateToV3({
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
    expect(isPersistedEditorStateV3(migrated)).toBe(true);
  });

  it("creates a blank freeform session when no static session remains", () => {
    const migrated = migratePersistedStateToV3({
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
});
