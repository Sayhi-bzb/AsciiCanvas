import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { CellPlaneIndex } from "../cell-plane/model";
import {
  applyCanvasDocumentSeed,
  materializeCanvasCheckpointSource,
} from "./canvasCheckpointDocument";
import {
  decodeCanvasCheckpointSnapshot,
  encodeCanvasCheckpointSnapshot,
} from "./canvasCheckpointSnapshot";

describe("Canvas checkpoint snapshot", () => {
  it("round-trips cell-plane and structured pages through compact binary", async () => {
    const doc = new Y.Doc({ guid: "snapshot-document" });
    applyCanvasDocumentSeed(doc, "snapshot-document", {
      mode: "freeform",
      activePageId: "grid-page",
      pages: [
        {
          id: "grid-page",
          kind: "cell-plane",
          grid: [
            ["0,0", { char: "A", color: "#111111" }],
            ["1,0", { char: "界", color: "#223344" }],
          ],
        },
        {
          id: "scene-page",
          kind: "structured",
          scene: [{
            id: "title",
            type: "text",
            order: 1,
            position: { x: 10, y: 20 },
            text: "GPU",
            style: { color: "#ffffff" },
          }],
          components: [],
        },
      ],
      grid: [],
      scene: [],
      components: [],
    });

    const encoded = await encodeCanvasCheckpointSnapshot(doc, "snapshot-document");
    const decoded = decodeCanvasCheckpointSnapshot(encoded.buffer);
    const seed = materializeCanvasCheckpointSource(decoded.source);

    expect(decoded.documentId).toBe("snapshot-document");
    expect(encoded.operationCount).toBe(1);
    expect(seed.pages?.[1]?.scene?.[0]).toMatchObject({ id: "title", text: "GPU" });
    const operations = "operations" in decoded.source.pages[0]!
      ? decoded.source.pages[0].operations
      : [];
    const index = new CellPlaneIndex(operations);
    expect(index.getCell({ x: 0, y: 0 })?.char).toBe("A");
    expect(index.getCell({ x: 1, y: 0 })?.char).toBe("界");
    index.dispose();
    doc.destroy();
  });
});
