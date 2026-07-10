import { describe, expect, it } from "vitest";
import {
  resolveStructuredEditAttempt,
  resolveStructuredEditDecision,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredEditDecision";
import type { StructuredBoxNode, StructuredTextNode } from "@/shared/types";

const textNode: StructuredTextNode = {
  id: "text-1",
  type: "text",
  order: 1,
  position: { x: 0, y: 0 },
  text: "Edit",
  style: { color: "#ffffff" },
};

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 2,
  start: { x: 0, y: 0 },
  end: { x: 8, y: 4 },
  name: "Box",
  style: { color: "#ffffff" },
};

describe("structured edit decisions", () => {
  it("enters text editing with the clicked caret point", () => {
    expect(
      resolveStructuredEditDecision({
        point: { x: 2, y: 0 },
        structuredScene: [textNode],
        selectedStructuredNodeIds: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({ type: "text", nodeId: textNode.id, cursor: { x: 2, y: 0 } });
  });

  it("places the text caret at the end when clicking just after text", () => {
    expect(
      resolveStructuredEditDecision({
        point: { x: 5, y: 0 },
        structuredScene: [textNode],
        selectedStructuredNodeIds: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({ type: "text", nodeId: textNode.id, cursor: { x: 4, y: 0 } });
  });

  it("enters box name editing from a box border", () => {
    expect(
      resolveStructuredEditDecision({
        point: { x: 0, y: 0 },
        structuredScene: [boxNode],
        selectedStructuredNodeIds: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({ type: "box-name", nodeId: boxNode.id, cursor: { x: 6, y: 0 } });
  });

  it("ignores box body hits and empty points", () => {
    expect(
      resolveStructuredEditDecision({
        point: { x: 2, y: 2 },
        structuredScene: [boxNode],
        selectedStructuredNodeIds: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({ type: "none" });

    expect(
      resolveStructuredEditDecision({
        point: null,
        structuredScene: [boxNode],
        selectedStructuredNodeIds: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({ type: "none" });
  });

  it("gates structured edit attempts to structured select mode", () => {
    expect(
      resolveStructuredEditAttempt({
        canvasMode: "freeform",
        tool: "select",
        point: { x: 2, y: 0 },
        structuredScene: [textNode],
        selectedStructuredNodeIds: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({ type: "none" });

    expect(
      resolveStructuredEditAttempt({
        canvasMode: "structured",
        tool: "brush",
        point: { x: 2, y: 0 },
        structuredScene: [textNode],
        selectedStructuredNodeIds: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({ type: "none" });

    expect(
      resolveStructuredEditAttempt({
        canvasMode: "structured",
        tool: "select",
        point: { x: 2, y: 0 },
        structuredScene: [textNode],
        selectedStructuredNodeIds: [],
        editingStructuredTextNodeId: null,
      })
    ).toEqual({ type: "text", nodeId: textNode.id, cursor: { x: 2, y: 0 } });
  });
});
