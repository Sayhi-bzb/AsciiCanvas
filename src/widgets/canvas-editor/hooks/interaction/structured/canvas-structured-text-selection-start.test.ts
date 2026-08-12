import { describe, expect, it } from "vitest";
import { resolveStructuredTextCaretSelectionStart } from "@/widgets/canvas-editor/hooks/interaction/structured/structuredTextSelectionStart";
import type { StructuredTextNode } from "@/domains/structured-content/public";

const textNode: StructuredTextNode = {
  id: "text-1",
  type: "text",
  order: 1,
  position: { x: 2, y: 3 },
  text: "abc",
  style: { color: "#ffffff" },
};

describe("structured text caret selection start", () => {
  it("uses a provided caret hit for offset and cursor", () => {
    const decision = resolveStructuredTextCaretSelectionStart({
      node: textNode,
      point: { x: 4, y: 3 },
      caretHit: {
        hit: { node: textNode, kind: "text", handle: null },
        offset: 1,
        caretPoint: { x: 3, y: 3 },
      },
    });

    expect(decision).toEqual({
      selectedIds: [textNode.id],
      cursor: { x: 3, y: 3 },
      textSelection: null,
      selectionStart: { nodeId: textNode.id, offset: 1 },
      dragStart: { x: 4, y: 3 },
      state: {
        type: "structuredTextSelecting",
        nodeId: textNode.id,
        anchorOffset: 1,
        start: { x: 4, y: 3 },
      },
    });
  });

  it("computes offset and cursor when no caret hit is provided", () => {
    expect(
      resolveStructuredTextCaretSelectionStart({
        node: textNode,
        point: { x: 4, y: 3 },
        caretHit: null,
      })
    ).toMatchObject({
      cursor: { x: 4, y: 3 },
      selectionStart: { nodeId: textNode.id, offset: 2 },
      state: { anchorOffset: 2 },
    });
  });
});
