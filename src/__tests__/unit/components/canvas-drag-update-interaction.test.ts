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
import type { StructuredNodeDragPayload } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/structured/structuredDragStart";

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 0, y: 0 },
  end: { x: 4, y: 2 },
  style: { color: "#ffffff" },
};

const splitBoxNode: StructuredSplitBoxNode = {
  id: "split-1",
  type: "splitBox",
  order: 2,
  start: { x: 0, y: 0 },
  end: { x: 8, y: 4 },
  verticalSplitRatio: 0.5,
  topSplitRatio: 0.5,
  bottomSplitRatio: 0.5,
  style: { color: "#ffffff" },
};

const lineNode: StructuredLineNode = {
  id: "line-1",
  type: "line",
  order: 3,
  start: { x: 0, y: 0 },
  end: { x: 5, y: 0 },
  axis: "horizontal",
  style: { color: "#ffffff" },
};

const textNode: StructuredTextNode = {
  id: "text-1",
  type: "text",
  order: 4,
  position: { x: 2, y: 2 },
  text: "hello",
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
    expect(
      resolveSelectionDragUpdatePreview({
        dragStart: { x: 1, y: 1 },
        currentGrid: { x: 8, y: 5 },
        canvasMode: "animation",
        canvasBounds: { width: 4, height: 3 },
      })
    ).toEqual({ start: { x: 1, y: 1 }, end: { x: 3, y: 2 } });
  });

  it("locks line shape previews to the first dominant axis", () => {
    expect(
      resolveShapePreviewUpdate({
        tool: "line",
        canvasMode: "freeform",
        dragStart: { x: 0, y: 0 },
        currentGrid: { x: 1, y: 4 },
        currentAxis: null,
      })
    ).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 1, y: 4 },
      axis: "vertical",
      interactionEvent: { type: "setShapePreviewAxis", axis: "vertical" },
    });

    expect(
      resolveShapePreviewUpdate({
        tool: "line",
        canvasMode: "freeform",
        dragStart: { x: 0, y: 0 },
        currentGrid: { x: 5, y: 1 },
        currentAxis: "vertical",
      })?.axis
    ).toBe("vertical");
  });

  it("computes structured move deltas from the drag start", () => {
    expect(
      resolveDragUpdateDecision({
        mode: "structured-node-moving",
        tool: "select",
        canvasMode: "structured",
        dragStart: { x: 2, y: 3 },
        currentGrid: { x: 5, y: 1 },
        canvasBounds: null,
        drag: makeDrag(boxNode),
        structuredScene: [boxNode],
        textSelectionStart: null,
        lineAxis: null,
      })
    ).toMatchObject({
      type: "structured-move",
      delta: { x: 3, y: -2 },
    });
  });

  it("keeps splitBox divider resize pending until the pointer moves", () => {
    expect(
      resolveDragUpdateDecision({
        mode: "structured-splitbox-resize-pending",
        tool: "select",
        canvasMode: "structured",
        dragStart: { x: 2, y: 2 },
        currentGrid: { x: 2, y: 2 },
        canvasBounds: null,
        drag: makeDrag(splitBoxNode, "split:split-middle"),
        structuredScene: [splitBoxNode],
        textSelectionStart: null,
        lineAxis: null,
      })
    ).toEqual({ type: "none" });

    expect(
      resolveDragUpdateDecision({
        mode: "structured-splitbox-resize-pending",
        tool: "select",
        canvasMode: "structured",
        dragStart: { x: 2, y: 2 },
        currentGrid: { x: 3, y: 2 },
        canvasBounds: null,
        drag: makeDrag(splitBoxNode, "split:split-middle"),
        structuredScene: [splitBoxNode],
        textSelectionStart: null,
        lineAxis: null,
      })
    ).toMatchObject({
      type: "structured-splitbox-begin-divider-resize",
      interactionEvent: {
        type: "startStructuredResizing",
        kind: "splitBox",
        nodeId: splitBoxNode.id,
        handle: "split:split-middle",
      },
    });
  });

  it("distinguishes splitBox divider previews from normal splitBox resizes", () => {
    expect(
      resolveDragUpdateDecision({
        mode: "structured-splitbox-resizing",
        tool: "select",
        canvasMode: "structured",
        dragStart: { x: 0, y: 0 },
        currentGrid: { x: 3, y: 2 },
        canvasBounds: null,
        drag: makeDrag(splitBoxNode, "split:split-middle"),
        structuredScene: [splitBoxNode],
        textSelectionStart: null,
        lineAxis: null,
      })
    ).toMatchObject({ type: "structured-splitbox-divider-resize" });

    expect(
      resolveDragUpdateDecision({
        mode: "structured-splitbox-resizing",
        tool: "select",
        canvasMode: "structured",
        dragStart: { x: 0, y: 0 },
        currentGrid: { x: 3, y: 2 },
        canvasBounds: null,
        drag: makeDrag(splitBoxNode, "se"),
        structuredScene: [splitBoxNode],
        textSelectionStart: null,
        lineAxis: null,
      })
    ).toMatchObject({ type: "structured-splitbox-resize", handle: "se" });
  });

  it("resolves structured text drag selection focus and cursor", () => {
    expect(
      resolveStructuredTextDragSelection({
        selectionStart: { nodeId: textNode.id, offset: 1 },
        currentGrid: { x: 5, y: 2 },
        structuredScene: [textNode, lineNode],
      })
    ).toMatchObject({
      type: "structured-text-selection",
      selection: { nodeId: textNode.id, anchor: 1, focus: 3 },
      cursor: { x: 5, y: 2 },
    });
  });
});
