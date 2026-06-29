import { afterEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";
import { DEFAULT_SESSION_ID } from "@/domains/canvas/state/helpers/storeUtils";

const initialState = useCanvasStore.getState();

describe("canvas session viewport state", () => {
  afterEach(() => {
    useCanvasStore.setState(
      {
        ...initialState,
        offset: { x: 0, y: 0 },
        zoom: 1,
        activeCanvasHasSavedViewport: false,
        grid: new Map(),
        canvasSessions: initialState.canvasSessions.map((session) =>
          session.id === DEFAULT_SESSION_ID
            ? { ...session, grid: [], viewport: undefined }
            : session
        ),
      },
      true
    );
    applyFreeformSnapshotToYMaps([]);
  });

  it("saves and restores offset and zoom per canvas session", () => {
    const store = useCanvasStore.getState();
    store.setOffset(() => ({ x: 10, y: 20 }));
    store.setZoom(() => 2);

    store.createCanvasSession("freeform");
    const secondCanvasId = useCanvasStore.getState().activeCanvasId;

    expect(useCanvasStore.getState().offset).toEqual({ x: 0, y: 0 });
    expect(useCanvasStore.getState().zoom).toBe(1);
    expect(useCanvasStore.getState().activeCanvasHasSavedViewport).toBe(false);

    useCanvasStore.getState().setOffset(() => ({ x: 100, y: 200 }));
    useCanvasStore.getState().setZoom(() => 3);
    useCanvasStore.getState().switchCanvasSession(DEFAULT_SESSION_ID);

    expect(useCanvasStore.getState().offset).toEqual({ x: 10, y: 20 });
    expect(useCanvasStore.getState().zoom).toBe(2);
    expect(useCanvasStore.getState().activeCanvasHasSavedViewport).toBe(true);

    useCanvasStore.getState().setOffset(() => ({ x: 11, y: 22 }));
    useCanvasStore.getState().setZoom(() => 1.5);
    useCanvasStore.getState().switchCanvasSession(secondCanvasId);

    expect(useCanvasStore.getState().offset).toEqual({ x: 100, y: 200 });
    expect(useCanvasStore.getState().zoom).toBe(3);
    expect(useCanvasStore.getState().activeCanvasHasSavedViewport).toBe(true);
  });
  it("creates and activates an empty structured session", () => {
    useCanvasStore.getState().createCanvasSession("structured");

    const state = useCanvasStore.getState();
    const activeSession = state.canvasSessions.find(
      (session) => session.id === state.activeCanvasId
    );

    expect(activeSession?.mode).toBe("structured");
    expect(state.canvasMode).toBe("structured");
    expect(state.structuredScene).toEqual([]);
    expect(state.grid.size).toBe(0);
  });
});
