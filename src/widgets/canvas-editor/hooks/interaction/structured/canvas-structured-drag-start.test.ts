import { describe, expect, it } from "vitest";
import { resolveStructuredDragStartDecision } from "@/widgets/canvas-editor/hooks/interaction/structured/structuredDragStart";
import type { StructuredBoxNode, StructuredLineNode, StructuredSplitBoxNode, StructuredTextNode } from "@/domains/structured-content/public";

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 1, y: 1 },
  end: { x: 5, y: 3 },
  style: { color: "#ffffff" },
};

const secondBoxNode: StructuredBoxNode = {
  id: "box-2",
  type: "box",
  order: 2,
  start: { x: 8, y: 1 },
  end: { x: 10, y: 3 },
  style: { color: "#00ff00" },
};

const splitBoxNode: StructuredSplitBoxNode = {
  id: "split-1",
  type: "splitBox",
  order: 3,
  start: { x: 0, y: 0 },
  end: { x: 9, y: 5 },
  verticalSplitRatio: 0.5,
  topSplitRatio: 0.5,
  bottomSplitRatio: 0.5,
  style: { color: "#ffffff" },
};

const textNode: StructuredTextNode = {
  id: "text-1",
  type: "text",
  order: 4,
  position: { x: 2, y: 2 },
  text: "abc",
  style: { color: "#ffffff" },
};

const lineNode: StructuredLineNode = {
  id: "line-1",
  type: "line",
  order: 4,
  start: { x: 0, y: 0 },
  end: { x: 5, y: 0 },
  axis: "horizontal",
  style: { color: "#ffffff" },
};

describe("structured drag start decisions", () => {
  it("moves the existing multi-selection when dragging a selected node body", () => {
    const decision = resolveStructuredDragStartDecision({
      hit: { node: boxNode, kind: "box", handle: null },
      start: { x: 2, y: 2 },
      selectedStructuredNodeIds: [boxNode.id, secondBoxNode.id],
      structuredScene: [boxNode, secondBoxNode, lineNode],
    });

    expect(decision.selectedIds).toEqual([boxNode.id, secondBoxNode.id]);
    expect(decision.drag.selectedNodes.map((node) => node.id)).toEqual([
      boxNode.id,
      secondBoxNode.id,
    ]);
    expect(decision.drag.baseScene.map((node) => node.id)).toEqual([
      lineNode.id,
    ]);
    expect(decision.state).toMatchObject({
      type: "structuredMoving",
      drag: { selectedIds: [boxNode.id, secondBoxNode.id] },
    });
  });

  it("starts rect resizing from box handles", () => {
    const decision = resolveStructuredDragStartDecision({
      hit: { node: boxNode, kind: "box", handle: "se" },
      start: { x: 5, y: 3 },
      selectedStructuredNodeIds: [secondBoxNode.id],
      structuredScene: [boxNode, secondBoxNode],
    });

    expect(decision.selectedIds).toEqual([boxNode.id]);
    expect(decision.contextPoint).toBeNull();
    expect(decision.splitHandle).toBeNull();
    expect(decision.state).toMatchObject({
      type: "structuredRectResizing",
      anchor: { x: 5, y: 3 },
      drag: { node: boxNode, handle: "se" },
    });
  });

  it("starts splitBox divider resizing as pending and keeps split context", () => {
    const decision = resolveStructuredDragStartDecision({
      hit: {
        node: splitBoxNode,
        kind: "splitBox",
        handle: "split:split-middle",
      },
      start: { x: 4, y: 2 },
      selectedStructuredNodeIds: [],
      structuredScene: [splitBoxNode, boxNode],
    });

    expect(decision.contextPoint).toEqual({ x: 4, y: 2 });
    expect(decision.splitHandle).toEqual({
      nodeId: splitBoxNode.id,
      handle: "split:split-middle",
    });
    expect(decision.state).toMatchObject({
      type: "structuredSplitBoxResizePending",
      anchor: { x: 4, y: 2 },
      drag: { node: splitBoxNode, handle: "split:split-middle" },
    });
  });

  it("moves text nodes through the structured move path", () => {
    const decision = resolveStructuredDragStartDecision({
      hit: { node: textNode, kind: "text", handle: null },
      start: { x: 2, y: 2 },
      selectedStructuredNodeIds: [],
      structuredScene: [textNode, boxNode],
    });

    expect(decision.selectedIds).toEqual([textNode.id]);
    expect(decision.drag.selectedNodes).toEqual([textNode]);
    expect(decision.state).toMatchObject({
      type: "structuredMoving",
      drag: { selectedIds: [textNode.id] },
    });
  });});
