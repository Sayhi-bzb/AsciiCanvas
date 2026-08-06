import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  activateCanvasDocument,
  getCanvasDocument,
  getCanvasHistoryAvailability,
  runCanvasTransaction,
  undoManager,
} from "./yjs";

const cell = (char: string) => ({ char, color: "#000000" });

describe("canvas CRDT collaboration", () => {
  it("converges independent cell edits", () => {
    const left = new Y.Doc();
    const right = new Y.Doc();
    left.getMap("main-grid").set("0,0", cell("A"));
    right.getMap("main-grid").set("1,0", cell("B"));

    const leftUpdate = Y.encodeStateAsUpdate(left);
    const rightUpdate = Y.encodeStateAsUpdate(right);
    Y.applyUpdate(left, rightUpdate);
    Y.applyUpdate(right, leftUpdate);

    const entries = (doc: Y.Doc) =>
      Array.from(doc.getMap("main-grid").entries()).sort(([a], [b]) => a.localeCompare(b));
    expect(entries(left)).toEqual(entries(right));
    expect(left.getMap("main-grid").size).toBe(2);
  });

  it("keeps remote edits out of local undo history", () => {
    const id = `collaboration-undo-${crypto.randomUUID()}`;
    activateCanvasDocument(id, { grid: [], scene: [] });
    const local = getCanvasDocument(id)!;
    const remote = new Y.Doc();

    runCanvasTransaction(() => local.grid.set("0,0", cell("L")));
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(local.doc));
    remote.getMap("main-grid").set("1,0", cell("R"));
    Y.applyUpdate(local.doc, Y.encodeStateAsUpdate(remote));

    undoManager.undo();
    expect(local.grid.has("0,0")).toBe(false);
    expect(local.grid.get("1,0")).toEqual(cell("R"));
  });

  it("reports undo and redo availability for the active document", () => {
    const id = `history-availability-${crypto.randomUUID()}`;
    activateCanvasDocument(id, { grid: [], scene: [] });
    const canvasDocument = getCanvasDocument(id)!;

    expect(getCanvasHistoryAvailability()).toEqual({
      canUndo: false,
      canRedo: false,
    });

    runCanvasTransaction(() => canvasDocument.grid.set("0,0", cell("A")));
    expect(getCanvasHistoryAvailability()).toEqual({
      canUndo: true,
      canRedo: false,
    });

    expect(undoManager.undo()).toBe(true);
    expect(getCanvasHistoryAvailability()).toEqual({
      canUndo: false,
      canRedo: true,
    });

    expect(undoManager.redo()).toBe(true);
    expect(getCanvasHistoryAvailability()).toEqual({
      canUndo: true,
      canRedo: false,
    });
  });

  it("converges atomic structured-node replacement and deletion", () => {
    const left = new Y.Doc();
    const right = new Y.Doc();
    const leftScene = left.getMap("structured-scene");
    const rightScene = right.getMap("structured-scene");
    leftScene.set("node-1", { id: "node-1", type: "text", text: "left" });
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));
    leftScene.delete("node-1");
    rightScene.set("node-1", { id: "node-1", type: "text", text: "right" });

    const leftUpdate = Y.encodeStateAsUpdate(left);
    const rightUpdate = Y.encodeStateAsUpdate(right);
    Y.applyUpdate(left, rightUpdate);
    Y.applyUpdate(right, leftUpdate);
    expect(leftScene.toJSON()).toEqual(rightScene.toJSON());
  });
});
