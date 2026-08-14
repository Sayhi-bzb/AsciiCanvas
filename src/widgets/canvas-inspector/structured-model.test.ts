import { describe, expect, it } from "vitest";

import type { StructuredNode } from "@/domains/structured-content/public";
import { deriveStructuredInspectorModel } from "./structured-model";

const scene: StructuredNode[] = [
  {
    id: "box",
    type: "box",
    order: 1,
    start: { x: 2, y: 3 },
    end: { x: 8, y: 6 },
    style: { color: "#111111", bgColor: "#eeeeee" },
  },
  {
    id: "text",
    type: "text",
    order: 2,
    position: { x: 10, y: 2 },
    text: "AB",
    style: { color: "#111111" },
    styleRanges: [{ start: 1, end: 2, style: { color: "#ff0000" } }],
  },
];

describe("deriveStructuredInspectorModel", () => {
  it("prioritizes a text range and reports mixed values", () => {
    const model = deriveStructuredInspectorModel({
      brushColor: "#000000",
      scene,
      selectedIds: ["text"],
      textSelection: { nodeId: "text", anchor: 0, focus: 2 },
    });
    expect(model.target).toBe("text-range");
    expect(model.primaryColor).toEqual({ kind: "mixed" });
  });

  it("derives single-node appearance and layer boundaries", () => {
    const model = deriveStructuredInspectorModel({
      brushColor: "#000000",
      scene,
      selectedIds: ["box"],
      textSelection: null,
    });
    expect(model.primaryColor).toEqual({ kind: "value", value: "#111111" });
    expect(model.arrange.backward).toBe(false);
    expect(model.arrange.forward).toBe(true);
  });

  it("uses the brush color as the creation default", () => {
    const model = deriveStructuredInspectorModel({
      brushColor: "#123456",
      scene,
      selectedIds: [],
      textSelection: null,
    });
    expect(model.primaryColor).toEqual({ kind: "value", value: "#123456" });
  });

  it("derives a background node's background as its primary color", () => {
    const model = deriveStructuredInspectorModel({
      brushColor: "#000000",
      scene: [
        ...scene,
        {
          id: "bg",
          type: "bg",
          order: 3,
          start: { x: 0, y: 0 },
          end: { x: 4, y: 4 },
          style: { color: "#ffffff", bgColor: "#123456" },
        },
      ],
      selectedIds: ["bg"],
      textSelection: null,
    });

    expect(model.primaryColor).toEqual({ kind: "value", value: "#123456" });
  });
});
