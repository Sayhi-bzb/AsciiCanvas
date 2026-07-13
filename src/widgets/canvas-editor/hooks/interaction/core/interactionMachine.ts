import type { GridMap, Point, StructuredNode, ToolType } from "@/shared/types";
import type {
  StructuredBoxResizeHandle,
  StructuredLineResizeHandle,
  StructuredSplitBoxHandle,
} from "@/domains/structured-content/public";

export type StructuredResizeKind = "rect" | "splitBox" | "line";

export type StructuredNodeDragPayload = {
  node: StructuredNode;
  selectedIds: string[];
  selectedNodes: StructuredNode[];
  baseScene: StructuredNode[];
  baseGrid: GridMap;
  handle:
    | StructuredBoxResizeHandle
    | StructuredSplitBoxHandle
    | StructuredLineResizeHandle
    | null;
};

type StructuredResizeStateBase = {
  anchor: Point;
  drag: StructuredNodeDragPayload;
};

export type InteractionState =
  | { type: "idle" }
  | { type: "panning"; lastScreen: Point }
  | { type: "selecting"; anchor: Point; current: Point }
  | {
      type: "drawing";
      tool: Extract<ToolType, "brush" | "eraser">;
      start: Point;
      lastGrid: Point;
      lastPlacedGrid: Point | null;
    }
  | {
      type: "shapePreview";
      tool: ToolType;
      start: Point;
      axis: "horizontal" | "vertical" | null;
    }
  | ({ type: "structuredMoving" } & StructuredResizeStateBase)
  | ({ type: "structuredRectResizing" } & StructuredResizeStateBase)
  | ({ type: "structuredSplitBoxResizing" } & StructuredResizeStateBase)
  | ({ type: "structuredSplitBoxResizePending" } & StructuredResizeStateBase)
  | ({ type: "structuredLineResizing" } & StructuredResizeStateBase)
  | {
      type: "structuredTextSelecting";
      nodeId: string;
      anchorOffset: number;
      start: Point;
    };

export type InteractionEvent =
  | { type: "reset" }
  | { type: "startPanning"; lastScreen: Point }
  | { type: "startSelecting"; anchor: Point; current?: Point }
  | { type: "updateSelection"; current: Point }
  | {
      type: "startDrawing";
      tool: Extract<ToolType, "brush" | "eraser">;
      start: Point;
    }
  | {
      type: "updateDrawing";
      lastGrid: Point;
      lastPlacedGrid: Point | null;
    }
  | {
      type: "startShapePreview";
      tool: ToolType;
      start: Point;
      axis?: "horizontal" | "vertical" | null;
    }
  | { type: "setShapePreviewAxis"; axis: "horizontal" | "vertical" | null }
  | {
      type: "startStructuredMoving";
      anchor: Point;
      drag: StructuredNodeDragPayload;
    }
  | {
      type: "startStructuredResizing";
      kind: StructuredResizeKind | "splitBoxPending";
      anchor: Point;
      drag: StructuredNodeDragPayload;
    }
  | {
      type: "startStructuredTextSelecting";
      nodeId: string;
      anchorOffset: number;
      start: Point;
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
        start: { ...event.start },
        lastGrid: { ...event.start },
        lastPlacedGrid: { ...event.start },
      };
    case "updateDrawing":
      return state.type === "drawing"
        ? {
            ...state,
            lastGrid: { ...event.lastGrid },
            lastPlacedGrid: event.lastPlacedGrid
              ? { ...event.lastPlacedGrid }
              : null,
          }
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
        anchor: { ...event.anchor },
        drag: event.drag,
      };
    case "startStructuredResizing": {
      const base = {
        anchor: { ...event.anchor },
        drag: event.drag,
      };
      if (event.kind === "line") {
        return { type: "structuredLineResizing", ...base };
      }
      if (event.kind === "splitBox") {
        return { type: "structuredSplitBoxResizing", ...base };
      }
      if (event.kind === "splitBoxPending") {
        return { type: "structuredSplitBoxResizePending", ...base };
      }
      return { type: "structuredRectResizing", ...base };
    }
    case "startStructuredTextSelecting":
      return {
        type: "structuredTextSelecting",
        nodeId: event.nodeId,
        anchorOffset: event.anchorOffset,
        start: { ...event.start },
      };
  }
};

export const getInteractionStart = (state: InteractionState): Point | null => {
  switch (state.type) {
    case "selecting":
      return state.anchor;
    case "drawing":
    case "shapePreview":
    case "structuredTextSelecting":
      return state.start;
    case "structuredMoving":
    case "structuredRectResizing":
    case "structuredSplitBoxResizing":
    case "structuredSplitBoxResizePending":
    case "structuredLineResizing":
      return state.anchor;
    default:
      return null;
  }
};

export const isPrimaryDragState = (state: InteractionState): boolean =>
  state.type !== "idle" && state.type !== "panning";
