import { describe, expect, it } from "vitest";
import type { EditorState } from "./interfaces";
import { CanvasDocumentRegistry } from "./CanvasDocumentRegistry";
import { syncHydratedStateToCanvasDocument } from "./editorPersistence";
import { useEditorStore } from "@/domains/canvas/testing";

describe("syncHydratedStateToCanvasDocument", () => {
  it("restores only authoritative structured maps into Yjs", () => {
    const documents = new CanvasDocumentRegistry("hydration-initial");
    const scene: EditorState["structuredScene"] = [
      {
        id: "hydrated-text",
        type: "text",
        order: 1,
        position: { x: 2, y: 3 },
        text: "Hydrated",
        style: { color: "#111111" },
      },
    ];
    const hydratedState: EditorState = {
      ...useEditorStore.getState(),
      activeCanvasId: "hydrated-structured",
      canvasMode: "structured",
      structuredScene: scene,
      structuredComponents: [],
      grid: new Map([
        ["2,3", { char: "H", color: "#111111" }],
      ]),
      canvasSessions: [
        {
          id: "hydrated-structured",
          name: "Hydrated Structured",
          mode: "structured",
          scene,
          components: [],
          grid: [["2,3", { char: "H", color: "#111111" }]],
        },
      ],
    };

    syncHydratedStateToCanvasDocument(documents, hydratedState);

    expect(documents.getContentReader().materialize()).toEqual(new Map());
    expect(documents.yStructuredScene.get("hydrated-text")).toEqual(scene[0]);
    documents.dispose();
  });
});
