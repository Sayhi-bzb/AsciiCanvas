import { describe, expect, it } from "vitest";
import {
  resolveStructuredSelectStartContext,
  resolveStructuredSelectStartDecision,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredSelectStart";
import type {
  StructuredBoxNode,
  StructuredTextNode,
} from "@/shared/types";

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 1, y: 1 },
  end: { x: 5, y: 3 },
  style: { color: "#ffffff" },
};

const textNode: StructuredTextNode = {
  id: "text-1",
  type: "text",
  order: 2,
  position: { x: 2, y: 2 },
  text: "abc",
  style: { color: "#ffffff" },
};

describe("structured select start decisions", () => {
  it("clears structured selection on empty structured select starts", () => {
    expect(
      resolveStructuredSelectStartDecision({
        hit: null,
        caretHit: null,
        start: { x: 9, y: 9 },
        mouseDetail: 1,
        editingStructuredTextNodeId: null,
        selectedStructuredNodeIds: [],
        structuredScene: [boxNode],
        cursor: "",
      })
    ).toEqual({ type: "clear-empty" });
  });

  it("routes double-click text starts to text edit selection reset", () => {
    expect(
      resolveStructuredSelectStartDecision({
        hit: { node: textNode, kind: "text", handle: null },
        caretHit: null,
        start: { x: 2, y: 2 },
        mouseDetail: 2,
        editingStructuredTextNodeId: null,
        selectedStructuredNodeIds: [],
        structuredScene: [textNode],
        cursor: "text",
      })
    ).toEqual({ type: "double-click-text", nodeId: textNode.id });
  });

  it("routes active text hits to caret selection", () => {
    const caretHit = {
      hit: { node: textNode, kind: "text" as const, handle: null },
      offset: 1,
      caretPoint: { x: 3, y: 2 },
    };

    expect(
      resolveStructuredSelectStartDecision({
        hit: caretHit.hit,
        caretHit,
        start: { x: 3, y: 2 },
        mouseDetail: 1,
        editingStructuredTextNodeId: textNode.id,
        selectedStructuredNodeIds: [],
        structuredScene: [textNode],
        cursor: "text",
      })
    ).toEqual({
      type: "text-caret-selection",
      node: textNode,
      caretHit,
    });
  });

  it("builds node drag decisions for normal structured hits", () => {
    const decision = resolveStructuredSelectStartDecision({
      hit: { node: boxNode, kind: "box", handle: null },
      caretHit: null,
      start: { x: 2, y: 2 },
      mouseDetail: 1,
      editingStructuredTextNodeId: null,
      selectedStructuredNodeIds: [],
      structuredScene: [boxNode],
      cursor: "move",
    });

    expect(decision.type).toBe("node-drag");
    if (decision.type !== "node-drag") return;
    expect(decision.cursor).toBe("move");
    expect(decision.dragStart.selectedIds).toEqual([boxNode.id]);
    expect(decision.dragStart.interactionEvent).toMatchObject({
      type: "startStructuredMoving",
      ids: [boxNode.id],
    });
  });

  it("resolves hit context and decision for structured select starts", () => {
    const context = resolveStructuredSelectStartContext({
      screenPoint: null,
      start: { x: 2, y: 2 },
      selectedStructuredNodeIds: [],
      structuredScene: [boxNode],
      offset: { x: 0, y: 0 },
      zoom: 1,
      editingStructuredTextNodeId: null,
      mouseDetail: 1,
    });

    expect(context.hitResult.hit).toMatchObject({
      kind: "box",
      node: { id: boxNode.id },
    });
    expect(context.decision.type).toBe("node-drag");
  });
});
