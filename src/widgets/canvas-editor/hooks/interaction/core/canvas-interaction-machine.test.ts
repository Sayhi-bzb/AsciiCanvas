import { describe, expect, it } from "vitest";
import {
  INITIAL_INTERACTION_STATE,
  getInteractionStart,
  transitionInteractionState,
  type StructuredNodeDragPayload,
} from "@/widgets/canvas-editor/hooks/interaction/core/interactionMachine";
import { createCanvasInteractionRuntime } from "@/widgets/canvas-editor/hooks/interaction/core/interactionRuntime";
import type { StructuredBoxNode } from "@/domains/structured-content/public";

const boxNode: StructuredBoxNode = {
  id: "box-1",
  type: "box",
  order: 1,
  start: { x: 0, y: 0 },
  end: { x: 4, y: 2 },
  style: { color: "#ffffff" },
};

const drag: StructuredNodeDragPayload = {
  node: boxNode,
  selectedIds: [boxNode.id],
  selectedNodes: [boxNode],
  baseScene: [],
  baseGrid: new Map(),
  handle: null,
};

describe("canvas interaction machine", () => {
  it("starts and resets panning", () => {
    const panning = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startPanning",
      lastScreen: { x: 12, y: 24 },
    });

    expect(panning).toEqual({
      type: "panning",
      lastScreen: { x: 12, y: 24 },
    });
    expect(transitionInteractionState(panning, { type: "reset" })).toBe(
      INITIAL_INTERACTION_STATE
    );
  });

  it("keeps selection geometry in typed state", () => {
    const selecting = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startSelecting",
      anchor: { x: 1, y: 2 },
      current: { x: 2, y: 3 },
    });

    expect(
      transitionInteractionState(selecting, {
        type: "updateSelection",
        current: { x: 5, y: 6 },
      })
    ).toEqual({
      type: "selecting",
      anchor: { x: 1, y: 2 },
      current: { x: 5, y: 6 },
    });
  });

  it("tracks drawing progress and shape preview axis", () => {
    const drawing = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startDrawing",
      tool: "brush",
      start: { x: 0, y: 0 },
    });
    expect(
      transitionInteractionState(drawing, {
        type: "updateDrawing",
        lastGrid: { x: 2, y: 0 },
        lastPlacedGrid: { x: 2, y: 0 },
      })
    ).toMatchObject({
      type: "drawing",
      lastGrid: { x: 2, y: 0 },
      lastPlacedGrid: { x: 2, y: 0 },
    });

    const preview = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startShapePreview",
      tool: "line",
      start: { x: 0, y: 0 },
    });
    expect(
      transitionInteractionState(preview, {
        type: "setShapePreviewAxis",
        axis: "vertical",
      })
    ).toMatchObject({ type: "shapePreview", axis: "vertical" });
  });

  it("keeps structured drag payloads in move and resize states", () => {
    const moving = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startStructuredMoving",
      anchor: { x: 1, y: 1 },
      drag,
    });
    expect(moving).toMatchObject({
      type: "structuredMoving",
      anchor: { x: 1, y: 1 },
      drag,
    });

    const resizing = transitionInteractionState(INITIAL_INTERACTION_STATE, {
      type: "startStructuredResizing",
      kind: "rect",
      anchor: { x: 4, y: 2 },
      drag: { ...drag, handle: "se" },
    });
    expect(resizing).toMatchObject({
      type: "structuredRectResizing",
      anchor: { x: 4, y: 2 },
      drag: { handle: "se" },
    });
    expect(getInteractionStart(resizing)).toEqual({ x: 4, y: 2 });
  });

  it("keeps structured text selection anchors in state", () => {
    expect(
      transitionInteractionState(INITIAL_INTERACTION_STATE, {
        type: "startStructuredTextSelecting",
        nodeId: "text-1",
        anchorOffset: 3,
        start: { x: 2, y: 4 },
      })
    ).toEqual({
      type: "structuredTextSelecting",
      nodeId: "text-1",
      anchorOffset: 3,
      start: { x: 2, y: 4 },
    });
  });

  it("owns the cross-gesture selection anchor in one runtime", () => {
    const runtime = createCanvasInteractionRuntime();
    runtime.setSelectionAnchor({ x: 3, y: 4 });
    runtime.dispatch({
      type: "startSelecting",
      anchor: { x: 3, y: 4 },
      current: { x: 5, y: 6 },
    });

    expect(runtime.getSelectionAnchor()).toEqual({ x: 3, y: 4 });
    expect(runtime.getState()).toMatchObject({ type: "selecting" });
    expect(runtime.reset()).toBe(INITIAL_INTERACTION_STATE);
  });
});
