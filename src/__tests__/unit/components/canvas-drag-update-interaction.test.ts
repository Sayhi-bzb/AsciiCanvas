import { describe, expect, it } from "vitest";
import {
  resolveDragUpdateDecision,
  resolveSelectionDragUpdatePreview,
  resolveShapePreviewUpdate,
  resolveStructuredTextDragSelection,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/dragUpdateInteraction";
import type {
  GridMap,
  StructuredBoxNode,
  StructuredLineNode,
  StructuredSplitBoxNode,
  StructuredTextNode,
} from "@/shared/types";
import type { StructuredNodeDragPayload } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/core/interactionMachine";

const boxNode: StructuredBoxNode = {
  id: "box-1", type: "box", order: 1,
  start: { x: 0, y: 0 }, end: { x: 4, y: 2 },
  style: { color: "#ffffff" },
};
const splitBoxNode: StructuredSplitBoxNode = {
  id: "split-1", type: "splitBox", order: 2,
  start: { x: 0, y: 0 }, end: { x: 8, y: 4 },
  verticalSplitRatio: 0.5, topSplitRatio: 0.5, bottomSplitRatio: 0.5,
  style: { color: "#ffffff" },
};
const lineNode: StructuredLineNode = {
  id: "line-1", type: "line", order: 3,
  start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, axis: "horizontal",
  style: { color: "#ffffff" },
};
const textNode: StructuredTextNode = {
  id: "text-1", type: "text", order: 4,
  position: { x: 2, y: 2 }, text: "hello",
  style: { color: "#ffffff" },
};
const emptyGrid: GridMap = new Map();
const makeDrag = (
  node: StructuredNodeDragPayload["node"],
  handle: StructuredNodeDragPayload["handle"] = null
): StructuredNodeDragPayload => ({
  node,
  selectedIds: [node.id],
  selectedNodes: [node],
  baseScene: [],
  baseGrid: emptyGrid,
  handle,
});

describe("canvas drag-update interaction decisions", () => {
  it("builds animation-aware selection previews", () => {
    expect(resolveSelectionDragUpdatePreview({
      dragStart: { x: 1, y: 1 }, currentGrid: { x: 8, y: 5 },
      canvasMode: "animation", canvasBounds: { width: 4, height: 3 },
    })).toEqual({ start: { x: 1, y: 1 }, end: { x: 3, y: 2 } });
  });

  it("locks line shape previews to the first dominant axis", () => {
    expect(resolveShapePreviewUpdate({
      tool: "line", canvasMode: "freeform",
      dragStart: { x: 0, y: 0 }, currentGrid: { x: 1, y: 4 }, currentAxis: null,
    })).toMatchObject({ axis: "vertical" });
    expect(resolveShapePreviewUpdate({
      tool: "line", canvasMode: "freeform",
      dragStart: { x: 0, y: 0 }, currentGrid: { x: 5, y: 1 }, currentAxis: "vertical",
    })?.axis).toBe("vertical");
  });

  it("computes structured move deltas from typed state", () => {
    expect(resolveDragUpdateDecision({
      state: { type: "structuredMoving", anchor: { x: 2, y: 3 }, drag: makeDrag(boxNode) },
      canvasMode: "structured", currentGrid: { x: 5, y: 1 },
      canvasBounds: null, structuredScene: [boxNode],
    })).toMatchObject({ type: "structured-move", delta: { x: 3, y: -2 } });
  });

  it("keeps splitBox divider resize pending until the pointer moves", () => {
    const state = {
      type: "structuredSplitBoxResizePending" as const,
      anchor: { x: 2, y: 2 },
      drag: makeDrag(splitBoxNode, "split:split-middle"),
    };
    expect(resolveDragUpdateDecision({
      state, canvasMode: "structured", currentGrid: { x: 2, y: 2 },
      canvasBounds: null, structuredScene: [splitBoxNode],
    })).toEqual({ type: "none" });
    expect(resolveDragUpdateDecision({
      state, canvasMode: "structured", currentGrid: { x: 3, y: 2 },
      canvasBounds: null, structuredScene: [splitBoxNode],
    })).toMatchObject({ type: "structured-splitbox-begin-divider-resize" });
  });

  it("distinguishes divider previews from normal splitBox resize", () => {
    expect(resolveDragUpdateDecision({
      state: {
        type: "structuredSplitBoxResizing", anchor: { x: 0, y: 0 },
        drag: makeDrag(splitBoxNode, "split:split-middle"),
      },
      canvasMode: "structured", currentGrid: { x: 3, y: 2 },
      canvasBounds: null, structuredScene: [splitBoxNode],
    })).toMatchObject({ type: "structured-splitbox-divider-resize" });
    expect(resolveDragUpdateDecision({
      state: {
        type: "structuredSplitBoxResizing", anchor: { x: 0, y: 0 },
        drag: makeDrag(splitBoxNode, "se"),
      },
      canvasMode: "structured", currentGrid: { x: 3, y: 2 },
      canvasBounds: null, structuredScene: [splitBoxNode],
    })).toMatchObject({ type: "structured-splitbox-resize", handle: "se" });
  });

  it("resolves structured text selection from typed state data", () => {
    expect(resolveStructuredTextDragSelection({
      selectionStart: { nodeId: textNode.id, offset: 1 },
      currentGrid: { x: 5, y: 2 }, structuredScene: [textNode, lineNode],
    })).toMatchObject({
      type: "structured-text-selection",
      selection: { nodeId: textNode.id, anchor: 1, focus: 3 },
      cursor: { x: 5, y: 2 },
    });
  });
});
