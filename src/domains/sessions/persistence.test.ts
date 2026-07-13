import { describe, expect, it } from "vitest";
import {
  EDITOR_PERSISTENCE_VERSION,
  flattenPersistedEditorState,
  isPersistedEditorStateV2,
  migratePersistedStateV1ToV2,
} from "./public";

describe("editor persistence migration", () => {
  it("groups legacy state without changing session payloads", () => {
    const legacySession = {
      id: "canvas-1",
      name: "Canvas 1",
      mode: "freeform" as const,
      scene: [],
      grid: [["0,0", { char: "A", color: "#fff" }]] as [
        string,
        { char: string; color: string },
      ][],
    };
    const migrated = migratePersistedStateV1ToV2({
      offset: { x: 12, y: 8 },
      zoom: 2,
      canvasMode: "freeform",
      grid: legacySession.grid,
      structuredScene: [],
      structuredComponents: [],
      canvasBounds: null,
      animationTimeline: null,
      canvasSessions: [legacySession],
      activeCanvasId: legacySession.id,
      brushChar: "#",
      brushColor: "#fff",
      showGrid: true,
      exportShowGrid: false,
    });

    expect(migrated.schemaVersion).toBe(EDITOR_PERSISTENCE_VERSION);
    expect(migrated.sessions).toEqual({
      items: [legacySession],
      activeId: legacySession.id,
    });
    expect(flattenPersistedEditorState(migrated)).toMatchObject({
      offset: { x: 12, y: 8 },
      zoom: 2,
      canvasSessions: [legacySession],
      activeCanvasId: legacySession.id,
      brushChar: "#",
    });
  });

  it("recognizes only the grouped v2 shape", () => {
    expect(isPersistedEditorStateV2({ schemaVersion: 2 })).toBe(false);
    expect(
      isPersistedEditorStateV2({
        schemaVersion: 2,
        workspace: {},
        sessions: {},
        preferences: {},
      })
    ).toBe(true);
  });
});
