import type { Point, StructuredNode, ToolType } from "@/shared/types";
import type {
  StructuredBoxResizeHandle,
  StructuredLineResizeHandle,
  StructuredSplitBoxHandle,
} from "@/domains/canvas/state/helpers/structuredBoxEditing";

export type StructuredResizeKind = "rect" | "splitBox" | "line";
export type LegacyInteractionMode =
  | "idle"
  | "panning"
  | "selecting"
  | "drawing"
  | "shape-preview"
  | "structured-node-moving"
  | "structured-box-resizing"
  | "structured-splitbox-resize-pending"
  | "structured-splitbox-resizing"
  | "structured-line-resizing"
  | "structured-text-selecting";

export type InteractionState =
  | { type: "idle" }
  | { type: "panning"; lastScreen: Point }
  | { type: "selecting"; anchor: Point; current: Point }
  | { type: "drawing"; tool: ToolType; lastGrid: Point }
  | {
      type: "shapePreview";
      tool: ToolType;
      start: Point;
      axis: "horizontal" | "vertical" | null;
    }
  | {
      type: "structuredMoving";
      ids: string[];
      anchor: Point;
      baseScene: StructuredNode[];
    }
  | {
      type: "structuredRectResizing";
      nodeId: string;
      handle: StructuredBoxResizeHandle;
    }
  | {
      type: "structuredSplitBoxResizing";
      nodeId: string;
      handle: StructuredSplitBoxHandle;
    }
  | {
      type: "structuredSplitBoxResizePending";
      nodeId: string;
      handle: StructuredSplitBoxHandle;
    }
  | {
      type: "structuredLineResizing";
      nodeId: string;
      handle: StructuredLineResizeHandle;
    }
  | {
      type: "structuredTextSelecting";
      nodeId: string;
      anchorOffset: number;
    };

export type InteractionEvent =
  | { type: "reset" }
  | { type: "startPanning"; lastScreen: Point }
  | { type: "startSelecting"; anchor: Point; current?: Point }
  | { type: "updateSelection"; current: Point }
  | { type: "startDrawing"; tool: ToolType; lastGrid: Point }
  | { type: "updateDrawing"; lastGrid: Point }
  | {
      type: "startShapePreview";
      tool: ToolType;
      start: Point;
      axis?: "horizontal" | "vertical" | null;
    }
  | { type: "setShapePreviewAxis"; axis: "horizontal" | "vertical" | null }
  | {
      type: "startStructuredMoving";
      ids: string[];
      anchor: Point;
      baseScene: StructuredNode[];
    }
  | {
      type: "startStructuredResizing";
      kind: StructuredResizeKind | "splitBoxPending";
      nodeId: string;
      handle:
        | StructuredBoxResizeHandle
        | StructuredSplitBoxHandle
        | StructuredLineResizeHandle;
    }
  | {
      type: "startStructuredTextSelecting";
      nodeId: string;
      anchorOffset: number;
    };

export const INITIAL_INTERACTION_STATE: InteractionState = { type: "idle" };

export const transitionInteractionState = (
  state: InteractionState,
  event: InteractionEvent
): InteractionState => {
  switch (event.type) {
    case "reset":
      return INITIAL_INTERACTION_STATE;
    case "startPanning":
      return { type: "panning", lastScreen: { ...event.lastScreen } };
    case "startSelecting":
      return {
        type: "selecting",
        anchor: { ...event.anchor },
        current: { ...(event.current ?? event.anchor) },
      };
    case "updateSelection":
      return state.type === "selecting"
        ? { ...state, current: { ...event.current } }
        : state;
    case "startDrawing":
      return {
        type: "drawing",
        tool: event.tool,
        lastGrid: { ...event.lastGrid },
      };
    case "updateDrawing":
      return state.type === "drawing"
        ? { ...state, lastGrid: { ...event.lastGrid } }
        : state;
    case "startShapePreview":
      return {
        type: "shapePreview",
        tool: event.tool,
        start: { ...event.start },
        axis: event.axis ?? null,
      };
    case "setShapePreviewAxis":
      return state.type === "shapePreview"
        ? { ...state, axis: event.axis }
        : state;
    case "startStructuredMoving":
      return {
        type: "structuredMoving",
        ids: [...event.ids],
        anchor: { ...event.anchor },
        baseScene: [...event.baseScene],
      };
    case "startStructuredResizing":
      if (event.kind === "line") {
        return {
          type: "structuredLineResizing",
          nodeId: event.nodeId,
          handle: event.handle as StructuredLineResizeHandle,
        };
      }
      if (event.kind === "splitBox") {
        return {
          type: "structuredSplitBoxResizing",
          nodeId: event.nodeId,
          handle: event.handle as StructuredSplitBoxHandle,
        };
      }
      if (event.kind === "splitBoxPending") {
        return {
          type: "structuredSplitBoxResizePending",
          nodeId: event.nodeId,
          handle: event.handle as StructuredSplitBoxHandle,
        };
      }
      return {
        type: "structuredRectResizing",
        nodeId: event.nodeId,
        handle: event.handle as StructuredBoxResizeHandle,
      };
    case "startStructuredTextSelecting":
      return {
        type: "structuredTextSelecting",
        nodeId: event.nodeId,
        anchorOffset: event.anchorOffset,
      };
  }
};
export const toLegacyInteractionMode = (
  state: InteractionState
): LegacyInteractionMode => {
  switch (state.type) {
    case "idle":
    case "panning":
    case "selecting":
    case "drawing":
      return state.type;
    case "shapePreview":
      return "shape-preview";
    case "structuredMoving":
      return "structured-node-moving";
    case "structuredRectResizing":
      return "structured-box-resizing";
    case "structuredSplitBoxResizePending":
      return "structured-splitbox-resize-pending";
    case "structuredSplitBoxResizing":
      return "structured-splitbox-resizing";
    case "structuredLineResizing":
      return "structured-line-resizing";
    case "structuredTextSelecting":
      return "structured-text-selecting";
  }
};
