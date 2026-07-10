import type {
  CanvasMode,
  Point,
  SelectionArea,
  StructuredNode,
  ToolType,
} from "@/shared/types";
import { clampSelectionToBounds } from "@/domains/canvas/state/helpers/animationHelpers";
import {
  getStructuredTextCaretPoint,
  getStructuredTextOffsetAtPoint,
} from "@/shared/utils/structuredTextRanges";
import {
  isStructuredSplitBoxLineHandle,
  type StructuredBoxResizeHandle,
  type StructuredLineResizeHandle,
  type StructuredSplitBoxHandle,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";
import type {
  InteractionEvent,
  InteractionState,
} from "../core/interactionMachine";
import { isShapeTool } from "./dragStartInteraction";
import type { StructuredNodeDragPayload } from "../structured/structuredDragStart";

export type StructuredTextSelectionStart = {
  nodeId: string;
  offset: number;
};

export type ShapePreviewUpdate = {
  start: Point;
  end: Point;
  axis: "horizontal" | "vertical" | null;
  interactionEvent: InteractionEvent | null;
};

export type DragUpdateDecision =
  | { type: "selection-preview"; preview: SelectionArea }
  | { type: "drawing"; point: Point }
  | { type: "structured-move"; drag: StructuredNodeDragPayload; delta: Point }
  | {
      type: "structured-rect-resize";
      node: Extract<StructuredNode, { type: "box" | "bg" }>;
      handle: StructuredBoxResizeHandle;
      point: Point;
    }
  | {
      type: "structured-splitbox-begin-divider-resize";
      drag: StructuredNodeDragPayload;
      point: Point;
      interactionEvent: InteractionEvent;
    }
  | {
      type: "structured-splitbox-divider-resize";
      drag: StructuredNodeDragPayload;
      point: Point;
    }
  | {
      type: "structured-splitbox-resize";
      node: Extract<StructuredNode, { type: "splitBox" }>;
      handle: StructuredSplitBoxHandle;
      point: Point;
    }
  | {
      type: "structured-line-resize";
      node: Extract<StructuredNode, { type: "line" }>;
      handle: StructuredLineResizeHandle;
      point: Point;
    }
  | {
      type: "structured-text-selection";
      selection: { nodeId: string; anchor: number; focus: number };
      cursor: Point;
    }
  | { type: "shape-preview"; update: ShapePreviewUpdate }
  | { type: "none" };

export const resolveSelectionDragUpdatePreview = ({
  dragStart,
  currentGrid,
  canvasMode,
  canvasBounds,
}: {
  dragStart: Point;
  currentGrid: Point;
  canvasMode: CanvasMode;
  canvasBounds: { width: number; height: number } | null;
}): SelectionArea =>
  canvasMode === "animation"
    ? clampSelectionToBounds({ start: dragStart, end: currentGrid }, canvasBounds)
    : { start: dragStart, end: currentGrid };

export const resolveShapePreviewUpdate = ({
  tool,
  canvasMode,
  dragStart,
  currentGrid,
  currentAxis,
}: {
  tool: ToolType;
  canvasMode: CanvasMode;
  dragStart: Point;
  currentGrid: Point;
  currentAxis: "horizontal" | "vertical" | null;
}): ShapePreviewUpdate | null => {
  if (!isShapeTool(tool, canvasMode)) return null;

  let axis = currentAxis;
  if (tool === "line" && !axis) {
    const dx = Math.abs(currentGrid.x - dragStart.x);
    const dy = Math.abs(currentGrid.y - dragStart.y);
    if (dx > 0 || dy > 0) axis = dy > dx ? "vertical" : "horizontal";
  }

  return {
    start: dragStart,
    end: currentGrid,
    axis,
    interactionEvent:
      axis !== currentAxis ? { type: "setShapePreviewAxis", axis } : null,
  };
};

export const resolveStructuredTextDragSelection = ({
  selectionStart,
  currentGrid,
  structuredScene,
}: {
  selectionStart: StructuredTextSelectionStart | null;
  currentGrid: Point;
  structuredScene: StructuredNode[];
}): Extract<DragUpdateDecision, { type: "structured-text-selection" }> | null => {
  if (!selectionStart) return null;
  const node = structuredScene.find(
    (sceneNode) =>
      sceneNode.id === selectionStart.nodeId && sceneNode.type === "text"
  );
  if (!node || node.type !== "text") return null;
  const focus = getStructuredTextOffsetAtPoint(node, currentGrid);
  return {
    type: "structured-text-selection",
    selection: {
      nodeId: node.id,
      anchor: selectionStart.offset,
      focus,
    },
    cursor: getStructuredTextCaretPoint(node, focus),
  };
};

export const resolveDragUpdateDecision = ({
  canvasMode,
  currentGrid,
  canvasBounds,
  structuredScene,
  state,
}: {
  canvasMode: CanvasMode;
  currentGrid: Point;
  canvasBounds: { width: number; height: number } | null;
  structuredScene: StructuredNode[];
  state: InteractionState;
}): DragUpdateDecision => {
  switch (state.type) {
    case "selecting":
      return {
        type: "selection-preview",
        preview: resolveSelectionDragUpdatePreview({
          dragStart: state.anchor,
          currentGrid,
          canvasMode,
          canvasBounds,
        }),
      };
    case "drawing":
      return state.tool === "brush" || state.tool === "eraser"
        ? { type: "drawing", point: currentGrid }
        : { type: "none" };
    case "structuredMoving":
      return {
        type: "structured-move",
        drag: state.drag,
        delta: {
          x: currentGrid.x - state.anchor.x,
          y: currentGrid.y - state.anchor.y,
        },
      };
    case "structuredRectResizing":
      if (
        (state.drag.node.type === "box" || state.drag.node.type === "bg") &&
        state.drag.handle
      ) {
        return {
          type: "structured-rect-resize",
          node: state.drag.node,
          handle: state.drag.handle as StructuredBoxResizeHandle,
          point: currentGrid,
        };
      }
      return { type: "none" };
    case "structuredSplitBoxResizePending":
      if (
        currentGrid.x === state.anchor.x &&
        currentGrid.y === state.anchor.y
      ) {
        return { type: "none" };
      }
      if (state.drag.node.type === "splitBox" && state.drag.handle) {
        return {
          type: "structured-splitbox-begin-divider-resize",
          drag: state.drag,
          point: currentGrid,
          interactionEvent: {
            type: "startStructuredResizing",
            kind: "splitBox",
            anchor: state.anchor,
            drag: state.drag,
          },
        };
      }
      return { type: "none" };
    case "structuredSplitBoxResizing":
      if (state.drag.node.type === "splitBox" && state.drag.handle) {
        const handle = state.drag.handle as StructuredSplitBoxHandle;
        if (isStructuredSplitBoxLineHandle(handle)) {
          return {
            type: "structured-splitbox-divider-resize",
            drag: state.drag,
            point: currentGrid,
          };
        }
        return {
          type: "structured-splitbox-resize",
          node: state.drag.node,
          handle,
          point: currentGrid,
        };
      }
      return { type: "none" };
    case "structuredLineResizing":
      if (state.drag.node.type === "line" && state.drag.handle) {
        return {
          type: "structured-line-resize",
          node: state.drag.node,
          handle: state.drag.handle as StructuredLineResizeHandle,
          point: currentGrid,
        };
      }
      return { type: "none" };
    case "structuredTextSelecting":
      return (
        resolveStructuredTextDragSelection({
          selectionStart: {
            nodeId: state.nodeId,
            offset: state.anchorOffset,
          },
          currentGrid,
          structuredScene,
        }) ?? { type: "none" }
      );
    case "shapePreview": {
      const update = resolveShapePreviewUpdate({
        tool: state.tool,
        canvasMode,
        dragStart: state.start,
        currentGrid,
        currentAxis: state.axis,
      });
      return update ? { type: "shape-preview", update } : { type: "none" };
    }
    default:
      return { type: "none" };
  }
};
