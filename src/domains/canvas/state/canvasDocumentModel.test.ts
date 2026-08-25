import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CanvasDocumentRegistry } from "./CanvasDocumentRegistry";

const cell = (char: string) => ({ char, color: "#000000" });

describe("unified Canvas documents", () => {
  it("keeps slide pages in one document with page-local history", () => {
    const documents = new CanvasDocumentRegistry("slides");
    documents.activateDocument("slides", {
      mode: "slide",
      activePageId: "slide-a",
      pages: [
        { id: "slide-a", kind: "cell-plane" },
        { id: "slide-b", kind: "cell-plane" },
      ],
      grid: [],
      scene: [],
      components: [],
    }, { replace: true });

    documents.mutateGridAt(
      { documentId: "slides", pageId: "slide-a" },
      (grid) => grid.set("0,0", cell("A"))
    );
    documents.activatePage("slides", "slide-b");
    documents.mutateGridAt(
      { documentId: "slides", pageId: "slide-b" },
      (grid) => grid.set("0,0", cell("B"))
    );

    expect(documents.getContentReader("slides", "slide-a")?.getCell({ x: 0, y: 0 }))
      .toEqual(cell("A"));
    expect(documents.undo()).toBe(true);
    expect(documents.getContentReader("slides", "slide-b")?.getCell({ x: 0, y: 0 }))
      .toBeUndefined();
    expect(documents.getContentReader("slides", "slide-a")?.getCell({ x: 0, y: 0 }))
      .toEqual(cell("A"));
    documents.dispose();
  });

  it("merges independently initialized copies through deterministic page roots", () => {
    const id = `offline-${crypto.randomUUID()}`;
    const left = new CanvasDocumentRegistry(id);
    const right = new CanvasDocumentRegistry(id);
    left.mutateGrid((grid) => grid.set("0,0", cell("L")));
    right.mutateGrid((grid) => grid.set("1,0", cell("R")));

    const leftDoc = left.getCollaborationDocument(id)!;
    const rightDoc = right.getCollaborationDocument(id)!;
    const leftUpdate = Y.encodeStateAsUpdate(leftDoc);
    const rightUpdate = Y.encodeStateAsUpdate(rightDoc);
    Y.applyUpdate(leftDoc, rightUpdate);
    Y.applyUpdate(rightDoc, leftUpdate);

    expect(Object.fromEntries(left.getContentReader().materialize())).toEqual({
      "0,0": cell("L"),
      "1,0": cell("R"),
    });
    expect(right.getContentReader().materialize())
      .toEqual(left.getContentReader().materialize());
    left.dispose();
    right.dispose();
  });
});
