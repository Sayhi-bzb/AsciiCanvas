import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/domains/canvas/testing";
import { createPersistedEditorSnapshot } from "./editorPersistence";
import type { CollaborationDescriptorV2 } from "@/domains/collaboration/public";

const initialState = useEditorStore.getState();

describe("collaborative session persistence", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("persists only the session shell, never a collaborative content snapshot", () => {
    const descriptor: CollaborationDescriptorV2 = {
      version: 2,
      documentVersion: 2,
      mode: "freeform",
      provider: "p2p",
      roomId: "room-id-1234567890",
      key: "room-key-1234567890123456789012345678901234567890",
    };
    useEditorStore.setState({
      activeCanvasId: "room-session",
      canvasMode: "freeform",
      grid: new Map([["0,0", { char: "A", color: "#fff" }]]),
      structuredScene: [],
      structuredComponents: [],
      canvasSessions: [
        {
          id: "room-session",
          name: "Room",
          mode: "freeform",
          grid: [["0,0", { char: "A", color: "#fff" }]],
          scene: [],
          components: [],
          collaboration: descriptor,
        },
      ],
    });

    const persisted = createPersistedEditorSnapshot(useEditorStore.getState()) as unknown as {
      workspace: { grid: unknown[]; structuredScene: unknown[] };
      sessions: { items: Array<{ grid: unknown[]; scene: unknown[] }> };
    };

    expect(persisted.workspace.grid).toEqual([]);
    expect(persisted.workspace.structuredScene).toEqual([]);
    expect(persisted.sessions.items[0]).toMatchObject({ grid: [], scene: [] });
  });
});
