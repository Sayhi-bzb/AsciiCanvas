import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { defaultCanvasDocuments, useEditorStore } from "@/domains/canvas/testing";
import {
  gridEntriesToCellPlaneOperation,
  type CellPlaneOperation,
} from "../cell-plane/model";

const initialState = useEditorStore.getState();
const cell = (char: string) => ({ char, color: "#000000" });
const textNode = (id: string, text: string) => ({
  id,
  type: "text" as const,
  order: 1,
  position: { x: 2, y: 3 },
  text,
  style: { color: "#ffffff" },
});

describe("remote canvas document projection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    defaultCanvasDocuments.activateDocument(
      initialState.activeCanvasId,
      {
        grid: Array.from(initialState.grid.entries()),
        scene: initialState.structuredScene,
        components: initialState.structuredComponents,
      },
      { replace: true }
    );
  });

  it("preserves remote grid content when the local client makes its next edit", () => {
    const sessionId = `projection-${crypto.randomUUID()}`;
    useEditorStore.setState({
      activeCanvasId: sessionId,
      canvasMode: "freeform",
      grid: new Map(),
      canvasSessions: [
        {
          id: sessionId,
          name: "Projection",
          mode: "freeform",
          grid: [],
          scene: [],
          components: [],
        },
      ],
    });
    defaultCanvasDocuments.activateDocument(sessionId, { grid: [], scene: [], components: [] });
    const local = defaultCanvasDocuments.getCollaborationDocument(sessionId)!;
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
    const pageId = remote.getArray<string>("document-page-order").get(0)!;
    const remoteSeed = gridEntriesToCellPlaneOperation("remote-seed", [
      ["0,0", cell("R")],
      ["1,0", cell("S")],
    ]);
    if (remoteSeed) {
      remote
        .getArray<CellPlaneOperation>(
          `canvas-page:${encodeURIComponent(pageId)}:cell-plane-operations`
        )
        .push([remoteSeed]);
    }

    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
    defaultCanvasDocuments.mutateGrid((grid) => grid.set("2,0", cell("L")));

    expect(Object.fromEntries(useEditorStore.getState().grid)).toEqual({
      "0,0": cell("R"),
      "1,0": cell("S"),
      "2,0": cell("L"),
    });
  });

  it("projects one local structured transaction exactly once", () => {
    const sessionId = `structured-local-${crypto.randomUUID()}`;
    useEditorStore.setState({
      activeCanvasId: sessionId,
      canvasMode: "structured",
      structuredScene: [],
      structuredComponents: [],
      grid: new Map(),
      canvasSessions: [
        {
          id: sessionId,
          name: "Structured Local",
          mode: "structured",
          grid: [],
          scene: [],
          components: [],
        },
      ],
    });
    defaultCanvasDocuments.activateDocument(sessionId, { grid: [], scene: [], components: [] });
    let projectionCount = 0;
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.structuredScene !== previous.structuredScene) projectionCount += 1;
    });

    useEditorStore.getState().applyStructuredScene([textNode("local-text", "Local")]);
    unsubscribe();

    const state = useEditorStore.getState();
    expect(projectionCount).toBe(1);
    expect(state.structuredScene).toEqual([textNode("local-text", "Local")]);
    expect(state.grid.get("2,3")?.char).toBe("L");
    expect(state.canvasSessions[0].scene).toEqual([]);
  });

  it("projects one remote structured transaction exactly once", () => {
    const sessionId = `structured-remote-${crypto.randomUUID()}`;
    useEditorStore.setState({
      activeCanvasId: sessionId,
      canvasMode: "structured",
      structuredScene: [],
      structuredComponents: [],
      grid: new Map(),
      canvasSessions: [
        {
          id: sessionId,
          name: "Structured Remote",
          mode: "structured",
          grid: [],
          scene: [],
          components: [],
        },
      ],
    });
    defaultCanvasDocuments.activateDocument(sessionId, {
      mode: "structured",
      grid: [],
      scene: [],
      components: [],
    });
    const local = defaultCanvasDocuments.getCollaborationDocument(sessionId)!;
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
    const pageId = remote.getArray<string>("document-page-order").get(0)!;
    remote
      .getMap(`canvas-page:${encodeURIComponent(pageId)}:structured-scene`)
      .set("remote-text", textNode("remote-text", "Remote"));
    let projectionCount = 0;
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.structuredScene !== previous.structuredScene) projectionCount += 1;
    });

    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
    unsubscribe();

    const state = useEditorStore.getState();
    expect(projectionCount).toBe(1);
    expect(state.structuredScene).toEqual([textNode("remote-text", "Remote")]);
    expect(state.grid.get("2,3")?.char).toBe("R");
    expect(state.canvasSessions[0].scene).toEqual([]);
  });
});
