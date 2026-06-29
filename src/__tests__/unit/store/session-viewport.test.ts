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
  it("updates selected structured boxes through the store", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ffffff" },
        },
      ],
      false
    );

    useCanvasStore.getState().updateStructuredBox("box-1", (node) => ({
      ...node,
      start: { x: 3, y: 4 },
      end: { x: 5, y: 6 },
    }));

    const state = useCanvasStore.getState();
    expect(state.selectedStructuredBoxId).toBe("box-1");
    expect(state.structuredScene[0]).toMatchObject({
      start: { x: 3, y: 4 },
      end: { x: 5, y: 6 },
    });
    expect(state.grid.size).toBeGreaterThan(0);
  });
  it("deletes selected structured nodes", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ffffff" },
        },
        {
          id: "line-1",
          type: "line",
          order: 2,
          start: { x: 4, y: 0 },
          end: { x: 8, y: 0 },
          axis: "horizontal",
          style: { color: "#ffffff" },
        },
      ],
      false
    );

    useCanvasStore.getState().setSelectedStructuredNodeIds(["box-1", "line-1"]);
    useCanvasStore.getState().deleteSelection();

    const state = useCanvasStore.getState();
    expect(state.structuredScene).toEqual([]);
    expect(state.selectedStructuredNodeIds).toEqual([]);
    expect(state.selectedStructuredBoxId).toBeNull();
  });

  it("reorders and duplicates selected structured nodes through the store", () => {
    useCanvasStore.getState().createCanvasSession("structured");
    useCanvasStore.getState().applyStructuredScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ffffff" },
        },
        {
          id: "line-1",
          type: "line",
          order: 2,
          start: { x: 4, y: 0 },
          end: { x: 8, y: 0 },
          axis: "horizontal",
          style: { color: "#ffffff" },
        },
      ],
      false
    );

    useCanvasStore.getState().setSelectedStructuredNodeIds(["box-1"]);
    useCanvasStore.getState().reorderStructuredSelection("front");

    expect(
      [...useCanvasStore.getState().structuredScene]
        .sort((a, b) => a.order - b.order)
        .map((node) => node.id)
    ).toEqual(["line-1", "box-1"]);

    const duplicatedIds = useCanvasStore.getState().duplicateStructuredSelection();
    const state = useCanvasStore.getState();
    expect(duplicatedIds).toHaveLength(1);
    expect(state.selectedStructuredNodeIds).toEqual(duplicatedIds);
    expect(state.structuredScene).toHaveLength(3);
    expect(state.structuredScene.find((node) => node.id === duplicatedIds[0])).toMatchObject({
      type: "box",
      start: { x: 1, y: 1 },
      end: { x: 3, y: 3 },
    });
  });

});
