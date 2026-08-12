import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CanvasDocumentRegistry } from "./CanvasDocumentRegistry";

const cell = (char: string) => ({ char, color: "#000000" });
const applyYMapValueDiff = <T extends { id: string }>(map: Y.Map<T>, values: T[]) => {
  const nextIds = new Set(values.map((value) => value.id));
  Array.from(map.keys()).forEach((id) => {
    if (!nextIds.has(id)) map.delete(id);
  });
  values.forEach((value) => {
    if (JSON.stringify(map.get(value.id)) !== JSON.stringify(value)) {
      map.set(value.id, value);
    }
  });
};

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

  it("preserves hydrated remote content when the joining client makes its first edit", () => {
    const remote = new Y.Doc();
    remote.getMap("main-grid").set("0,0", cell("R"));
    remote.getMap("main-grid").set("1,0", cell("S"));

    const joining = new Y.Doc();
    Y.applyUpdate(joining, Y.encodeStateAsUpdate(remote));
    joining.getMap("main-grid").set("2,0", cell("L"));
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(joining));

    expect(remote.getMap("main-grid").toJSON()).toEqual({
      "0,0": cell("R"),
      "1,0": cell("S"),
      "2,0": cell("L"),
    });
  });

  it("converges after deterministic random offline edits and shuffled duplicate updates", () => {
    let seed = 0x5eed;
    const random = (max: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % max;
    };
    const docs = [new Y.Doc(), new Y.Doc(), new Y.Doc()];
    for (let index = 0; index < 120; index += 1) {
      const doc = docs[random(docs.length)];
      const key = `${random(12)},${random(8)}`;
      if (random(5) === 0) doc.getMap("main-grid").delete(key);
      else doc.getMap("main-grid").set(key, cell(String.fromCharCode(65 + random(26))));
    }

    const updates = docs.map((doc) => Y.encodeStateAsUpdate(doc));
    const delivery = [...updates, updates[0], updates[2]].sort(() => random(3) - 1);
    docs.forEach((doc) => delivery.forEach((update) => Y.applyUpdate(doc, update)));

    const snapshots = docs.map((doc) => doc.getMap("main-grid").toJSON());
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
  });

  it("keeps remote edits out of local undo history", () => {
    const id = `collaboration-undo-${crypto.randomUUID()}`;
    const documents = new CanvasDocumentRegistry(id);
    const local = documents.getCollaborationDocument(id)!;
    const remote = new Y.Doc();

    documents.runTransaction(() => documents.yMainGrid.set("0,0", cell("L")));
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
    remote.getMap("main-grid").set("1,0", cell("R"));
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));

    documents.undo();
    expect(documents.yMainGrid.has("0,0")).toBe(false);
    expect(documents.yMainGrid.get("1,0")).toEqual(cell("R"));
    documents.dispose();
  });

  it("rolls back only local changes created after a history checkpoint", () => {
    const id = `interaction-cancel-${crypto.randomUUID()}`;
    const documents = new CanvasDocumentRegistry(id);
    const local = documents.getCollaborationDocument(id)!;
    const remote = new Y.Doc();

    documents.runTransaction(() => documents.yMainGrid.set("0,0", cell("B")));
    const checkpoint = documents.beginHistoryCheckpoint();
    documents.runTransaction(
      () => documents.yMainGrid.set("1,0", cell("L")),
      "merge"
    );
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
    remote.getMap("main-grid").set("2,0", cell("R"));
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));

    checkpoint.cancel();

    expect(documents.yMainGrid.get("0,0")).toEqual(cell("B"));
    expect(documents.yMainGrid.has("1,0")).toBe(false);
    expect(documents.yMainGrid.get("2,0")).toEqual(cell("R"));
    expect(documents.getHistoryAvailability()).toEqual({
      canUndo: true,
      canRedo: false,
    });
    documents.dispose();
  });

  it("commits checkpoint changes as one undo step", () => {
    const id = `interaction-commit-${crypto.randomUUID()}`;
    const documents = new CanvasDocumentRegistry(id);
    const checkpoint = documents.beginHistoryCheckpoint();

    documents.runTransaction(() => documents.yMainGrid.set("0,0", cell("A")), "merge");
    documents.runTransaction(() => documents.yMainGrid.set("1,0", cell("B")), "merge");
    checkpoint.commit();

    expect(documents.undo()).toBe(true);
    expect(documents.yMainGrid.size).toBe(0);
    expect(documents.undo()).toBe(false);
    documents.dispose();
  });

  it("reports undo and redo availability for the active document", () => {
    const id = `history-availability-${crypto.randomUUID()}`;
    const documents = new CanvasDocumentRegistry(id);

    expect(documents.getHistoryAvailability()).toEqual({
      canUndo: false,
      canRedo: false,
    });

    documents.runTransaction(() => documents.yMainGrid.set("0,0", cell("A")));
    expect(documents.getHistoryAvailability()).toEqual({
      canUndo: true,
      canRedo: false,
    });

    expect(documents.undo()).toBe(true);
    expect(documents.getHistoryAvailability()).toEqual({
      canUndo: false,
      canRedo: true,
    });

    expect(documents.redo()).toBe(true);
    expect(documents.getHistoryAvailability()).toEqual({
      canUndo: true,
      canRedo: false,
    });
    documents.dispose();
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

  it("merges concurrent edits to different structured nodes", () => {
    const base = new Y.Doc();
    const baseScene = base.getMap<{ id: string; text: string }>("structured-scene");
    baseScene.set("node-a", { id: "node-a", text: "A" });
    baseScene.set("node-b", { id: "node-b", text: "B" });

    const left = new Y.Doc();
    const right = new Y.Doc();
    const initial = Y.encodeStateAsUpdate(base);
    Y.applyUpdate(left, initial);
    Y.applyUpdate(right, initial);

    left.transact(() => {
      applyYMapValueDiff(left.getMap<{ id: string; text: string }>("structured-scene"), [
        { id: "node-a", text: "A-left" },
        { id: "node-b", text: "B" },
      ]);
    });
    right.transact(() => {
      applyYMapValueDiff(right.getMap<{ id: string; text: string }>("structured-scene"), [
        { id: "node-a", text: "A" },
        { id: "node-b", text: "B-right" },
      ]);
    });

    const leftUpdate = Y.encodeStateAsUpdate(left);
    const rightUpdate = Y.encodeStateAsUpdate(right);
    Y.applyUpdate(left, rightUpdate);
    Y.applyUpdate(right, leftUpdate);

    expect(left.getMap("structured-scene").toJSON()).toEqual({
      "node-a": { id: "node-a", text: "A-left" },
      "node-b": { id: "node-b", text: "B-right" },
    });
    expect(right.getMap("structured-scene").toJSON()).toEqual(
      left.getMap("structured-scene").toJSON()
    );
  });
});
