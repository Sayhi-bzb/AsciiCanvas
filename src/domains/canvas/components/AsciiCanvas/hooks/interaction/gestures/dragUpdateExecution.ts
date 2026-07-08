import type { Point, StructuredNode, ToolType } from "@/shared/types";
import {
  resizeStructuredLine,
  resizeStructuredRect,
  resizeStructuredSplitBox,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";
import type { InteractionEvent } from "../core/interactionMachine";
import type { StructuredNodeDragPayload } from "../structured/structuredDragStart";
import type { StructuredPreviewQueueController } from "../structured/structuredPreviewQueueExecution";
import type { DragUpdateDecision } from "./dragUpdateInteraction";

type RefCell<T> = { current: T };

export type PanningDragUpdateExecutor = {
  queueOffsetDelta: (dx: number, dy: number) => void;
};

export const createPanningDragUpdateExecutor = ({
  queueOffsetDelta,
}: PanningDragUpdateExecutor): PanningDragUpdateExecutor => ({
  queueOffsetDelta,
});

export const executePanningDragUpdate = (
  delta: Point,
  executor: PanningDragUpdateExecutor
): void => {
  executor.queueOffsetDelta(delta.x, delta.y);
};
export type DragUpdateExecutor = {
  dispatchInteraction: (event: InteractionEvent) => void;
  setSelectionPreview: (selection: Extract<DragUpdateDecision, { type: "selection-preview" }>["preview"]) => void;
  draw: (point: Point) => void;
  queueStructuredMove: (
    drag: StructuredNodeDragPayload,
    delta: Point,
    scene: StructuredNode[]
  ) => void;
  queueStructuredSplitBoxResize: (
    drag: StructuredNodeDragPayload,
    point: Point,
    scene: StructuredNode[]
  ) => void;
  updateStructuredNode: (
    nodeId: string,
    updater: (node: StructuredNode) => StructuredNode,
    mode: "merge"
  ) => void;
  setStructuredTextSelection: (
    selection: Extract<DragUpdateDecision, { type: "structured-text-selection" }>["selection"]
  ) => void;
  setTextCursor: (point: Point) => void;
  setLineAxis: (axis: "horizontal" | "vertical" | null) => void;
  updateScratchForShape: (
    tool: ToolType,
    start: Point,
    end: Point,
    options: { axis: "horizontal" | "vertical" | null }
  ) => void;
  setHoveredGrid: (point: Point) => void;
};

export const executeDragUpdateDecision = (
  decision: DragUpdateDecision,
  executor: DragUpdateExecutor,
  context: {
    currentGrid: Point;
    tool: ToolType;
    structuredScene: StructuredNode[];
    updateEraserHover: boolean;
  }
): void => {
  switch (decision.type) {
    case "selection-preview":
      executor.dispatchInteraction({
        type: "updateSelection",
        current: context.currentGrid,
      });
      executor.setSelectionPreview(decision.preview);
      break;
    case "drawing":
      executor.draw(decision.point);
      break;
    case "structured-move":
      executor.queueStructuredMove(
        decision.drag,
        decision.delta,
        context.structuredScene
      );
      break;
    case "structured-rect-resize":
      executor.updateStructuredNode(
        decision.node.id,
        () => resizeStructuredRect(decision.node, decision.handle, decision.point),
        "merge"
      );
      break;
    case "structured-splitbox-begin-divider-resize":
      executor.dispatchInteraction(decision.interactionEvent);
      executor.queueStructuredSplitBoxResize(
        decision.drag,
        decision.point,
        context.structuredScene
      );
      break;
    case "structured-splitbox-divider-resize":
      executor.queueStructuredSplitBoxResize(
        decision.drag,
        decision.point,
        context.structuredScene
      );
      break;
    case "structured-splitbox-resize":
      executor.updateStructuredNode(
        decision.node.id,
        () =>
          resizeStructuredSplitBox(
            decision.node,
            decision.handle,
            decision.point
          ),
        "merge"
      );
      break;
    case "structured-line-resize":
      executor.updateStructuredNode(
        decision.node.id,
        () => resizeStructuredLine(decision.node, decision.handle, decision.point),
        "merge"
      );
      break;
    case "structured-text-selection":
      executor.setStructuredTextSelection(decision.selection);
      executor.setTextCursor(decision.cursor);
      break;
    case "shape-preview":
      if (decision.update.interactionEvent) {
        executor.dispatchInteraction(decision.update.interactionEvent);
      }
      executor.setLineAxis(decision.update.axis);
      executor.updateScratchForShape(
        context.tool,
        decision.update.start,
        decision.update.end,
        { axis: decision.update.axis }
      );
      break;
    case "none":
      break;
  }

  if (context.updateEraserHover) {
    executor.setHoveredGrid(context.currentGrid);
  }
};

export const createDragUpdateExecutor = ({
  lineAxis,
  dispatchInteraction,
  setSelectionPreview,
  draw,
  structuredPreviewQueue,
  updateStructuredNode,
  setStructuredTextSelection,
  setTextCursor,
  updateScratchForShape,
  setHoveredGrid,
}: {
  lineAxis: RefCell<"horizontal" | "vertical" | null>;
  dispatchInteraction: (event: InteractionEvent) => void;
  setSelectionPreview: DragUpdateExecutor["setSelectionPreview"];
  draw: (point: Point) => void;
  structuredPreviewQueue: StructuredPreviewQueueController;
  updateStructuredNode: DragUpdateExecutor["updateStructuredNode"];
  setStructuredTextSelection: DragUpdateExecutor["setStructuredTextSelection"];
  setTextCursor: DragUpdateExecutor["setTextCursor"];
  updateScratchForShape: DragUpdateExecutor["updateScratchForShape"];
  setHoveredGrid: DragUpdateExecutor["setHoveredGrid"];
}): DragUpdateExecutor => ({
  dispatchInteraction,
  setSelectionPreview,
  draw,
  queueStructuredMove: structuredPreviewQueue.queueMove,
  queueStructuredSplitBoxResize: structuredPreviewQueue.queueSplitBoxResize,
  updateStructuredNode,
  setStructuredTextSelection,
  setTextCursor,
  setLineAxis: (axis) => {
    lineAxis.current = axis;
  },
  updateScratchForShape,
  setHoveredGrid,
});
