import type { CanvasMode, Point, SelectionArea, ToolType } from "@/shared/types";
import {
  resolveDragStartRouteDecision,
  resolveDrawingShapeDragStartDecision,
  resolveSelectionDragStartDecision,
  type DrawingShapeDragStartDecision,
  type SelectionDragStartDecision,
} from "./dragStartInteraction";
import type { InteractionEvent } from "../core/interactionMachine";

export type PanningDragStartExecutor = {
  dispatchInteraction: (event: InteractionEvent) => void;
  setBodyCursor: (cursor: string) => void;
};

export const createPanningDragStartExecutor = ({
  dispatchInteraction,
  setBodyCursor,
}: {
  dispatchInteraction: (event: InteractionEvent) => void;
  setBodyCursor: (cursor: string) => void;
}): PanningDragStartExecutor => ({
  dispatchInteraction,
  setBodyCursor,
});

export const executePanningDragStart = (
  lastScreen: Point,
  executor: PanningDragStartExecutor
): void => {
  executor.dispatchInteraction({ type: "startPanning", lastScreen });
  executor.setBodyCursor("grabbing");
};
export type SelectionDragStartExecutor = {
  dispatchInteraction: (event: InteractionEvent) => void;
  clearInteractionState: () => void;
  clearSelections: () => void;
  setAnchorGrid: (point: Point | null) => void;
  setSelectionPreview: (selection: SelectionArea) => void;
  clearTextCursor: () => void;
};

export const executeSelectionDragStartDecision = (
  decision: SelectionDragStartDecision,
  executor: SelectionDragStartExecutor
): boolean => {
  if (decision.type !== "selection") return false;

  executor.dispatchInteraction({
    type: "startSelecting",
    anchor: decision.dragStart,
    current: decision.interactionAnchor,
  });
  if (decision.clearInteractionState) executor.clearInteractionState();
  if (decision.clearExistingSelection) executor.clearSelections();
  if (decision.nextAnchor !== null) executor.setAnchorGrid(decision.nextAnchor);
  executor.setSelectionPreview(decision.preview);
  executor.clearTextCursor();
  return true;
};

export const createSelectionDragStartExecutor = ({
  setAnchorGrid,
  dispatchInteraction,
  clearInteractionState,
  clearSelections,
  setSelectionPreview,
  clearTextCursor,
}: {
  setAnchorGrid: (point: Point | null) => void;
  dispatchInteraction: (event: InteractionEvent) => void;
  clearInteractionState: () => void;
  clearSelections: () => void;
  setSelectionPreview: (selection: SelectionArea) => void;
  clearTextCursor: () => void;
}): SelectionDragStartExecutor => ({
  dispatchInteraction,
  clearInteractionState,
  clearSelections,
  setAnchorGrid,
  setSelectionPreview,
  clearTextCursor,
});

export type DrawingShapeDragStartExecutor = {
  clearInteractionState: () => void;
  clearEditingStructuredTextNode: () => void;
  clearStructuredTextSelection: () => void;
  setAnchorGrid: (point: Point) => void;
  dispatchInteraction: (event: InteractionEvent) => void;
  addScratchPoint: (point: { x: number; y: number; char: string }) => void;
  erasePoint: (point: Point) => void;
};

export const executeDrawingShapeDragStartDecision = (
  decision: DrawingShapeDragStartDecision,
  start: Point,
  executor: DrawingShapeDragStartExecutor
): boolean => {
  if (decision.type === "ignore") return false;

  executor.clearInteractionState();
  executor.clearEditingStructuredTextNode();
  executor.clearStructuredTextSelection();
  executor.setAnchorGrid(start);
  executor.dispatchInteraction(decision.event);

  if (decision.type === "drawing") {
    if (decision.scratchPoint) executor.addScratchPoint(decision.scratchPoint);
    if (decision.erasePoint) executor.erasePoint(decision.erasePoint);
  }

  return true;
};

export const createDrawingShapeDragStartExecutor = ({
  setAnchorGrid,
  dispatchInteraction,
  clearInteractionState,
  clearEditingStructuredTextNode,
  clearStructuredTextSelection,
  addScratchPoint,
  erasePoint,
}: {
  setAnchorGrid: (point: Point) => void;
  dispatchInteraction: (event: InteractionEvent) => void;
  clearInteractionState: () => void;
  clearEditingStructuredTextNode: () => void;
  clearStructuredTextSelection: () => void;
  addScratchPoint: (point: { x: number; y: number; char: string }) => void;
  erasePoint: (point: Point) => void;
}): DrawingShapeDragStartExecutor => ({
  clearInteractionState,
  clearEditingStructuredTextNode,
  clearStructuredTextSelection,
  setAnchorGrid,
  dispatchInteraction,
  addScratchPoint,
  erasePoint,
});

export type PrimaryCanvasDragStartContext = {
  start: Point;
  canvasMode: CanvasMode;
  tool: ToolType;
  shiftKey: boolean;
  anchorGrid: Point | null;
  canvasBounds: { width: number; height: number } | null;
  brushChar: string;
  executeStructuredSelectStart: (() => boolean) | null;
};

export const executePrimaryCanvasDragStart = (
  context: PrimaryCanvasDragStartContext,
  executors: {
    selection: SelectionDragStartExecutor;
    drawingShape: DrawingShapeDragStartExecutor;
  }
): boolean => {
  if (context.canvasMode === "structured" && context.tool === "select") {
    if (context.executeStructuredSelectStart?.()) return true;
  }

  const selectionDecision = resolveSelectionDragStartDecision({
    tool: context.tool,
    canvasMode: context.canvasMode,
    start: context.start,
    shiftKey: context.shiftKey,
    anchorGrid: context.anchorGrid,
    canvasBounds: context.canvasBounds,
  });
  if (executeSelectionDragStartDecision(selectionDecision, executors.selection)) {
    return true;
  }

  const dragStartDecision = resolveDrawingShapeDragStartDecision({
    tool: context.tool,
    canvasMode: context.canvasMode,
    start: context.start,
    brushChar: context.brushChar,
  });

  return executeDrawingShapeDragStartDecision(
    dragStartDecision,
    context.start,
    executors.drawingShape
  );
};


export type PrimaryCanvasDragStartHandler = (
  context: PrimaryCanvasDragStartContext
) => boolean;

export const createPrimaryCanvasDragStartHandler = ({
  selection,
  drawingShape,
}: {
  selection: SelectionDragStartExecutor;
  drawingShape: DrawingShapeDragStartExecutor;
}): PrimaryCanvasDragStartHandler => (context) =>
  executePrimaryCanvasDragStart(context, { selection, drawingShape });

export type DragStartRouteHandler = ({
  canvasMode,
  tool,
  button,
  isCtrlOrMetaPressed,
  hasColorPickerTarget,
  hasCanvasRect,
  screenPoint,
  executeColorPickerStart,
  executePrimaryCanvasStart,
}: {
  canvasMode: CanvasMode;
  tool: ToolType;
  button: number;
  isCtrlOrMetaPressed: boolean;
  hasColorPickerTarget: boolean;
  hasCanvasRect: boolean;
  screenPoint: Point;
  executeColorPickerStart: () => boolean;
  executePrimaryCanvasStart: () => boolean;
}) => boolean;

export const createDragStartRouteHandler = ({
  panning,
}: {
  panning: PanningDragStartExecutor;
}): DragStartRouteHandler => ({
  canvasMode,
  tool,
  button,
  isCtrlOrMetaPressed,
  hasColorPickerTarget,
  hasCanvasRect,
  screenPoint,
  executeColorPickerStart,
  executePrimaryCanvasStart,
}) => {
  const routeDecision = resolveDragStartRouteDecision({
    canvasMode,
    tool,
    button,
    isCtrlOrMetaPressed,
    hasColorPickerTarget,
    hasCanvasRect,
  });

  switch (routeDecision.type) {
    case "color-picker":
      return executeColorPickerStart();
    case "pan":
      executePanningDragStart(screenPoint, panning);
      return true;
    case "primary-canvas":
      return executePrimaryCanvasStart();
    case "ignore":
      return false;
  }
};
export type CanvasDragStartRouteAdapter = ({
  canvasMode,
  tool,
  button,
  isCtrlOrMetaPressed,
  hasColorPickerTarget,
  hasCanvasRect,
  screenPoint,
  shiftKey,
  anchorGrid,
  canvasBounds,
  brushChar,
  mouseDetail,
  preventDefault,
  resolveGridPoint,
  resolveLocalPoint,
}: {
  canvasMode: CanvasMode;
  tool: ToolType;
  button: number;
  isCtrlOrMetaPressed: boolean;
  hasColorPickerTarget: boolean;
  hasCanvasRect: boolean;
  screenPoint: Point;
  shiftKey: boolean;
  anchorGrid: Point | null;
  canvasBounds: { width: number; height: number } | null;
  brushChar: string;
  mouseDetail: number;
  preventDefault: () => void;
  resolveGridPoint: (screenPoint: Point) => Point | null;
  resolveLocalPoint: (screenPoint: Point) => Point | null;
}) => boolean;

export const createCanvasDragStartRouteAdapter = ({
  route,
  colorPicker,
  primaryCanvas,
  structuredSelect,
}: {
  route: DragStartRouteHandler;
  colorPicker: (input: {
    point: Point | null;
    preventDefault: () => void;
  }) => boolean;
  primaryCanvas: PrimaryCanvasDragStartHandler;
  structuredSelect: (input: {
    screenPoint: Point | null;
    start: Point;
    mouseDetail: number;
  }) => boolean;
}): CanvasDragStartRouteAdapter =>
  ({
    canvasMode,
    tool,
    button,
    isCtrlOrMetaPressed,
    hasColorPickerTarget,
    hasCanvasRect,
    screenPoint,
    shiftKey,
    anchorGrid,
    canvasBounds,
    brushChar,
    mouseDetail,
    preventDefault,
    resolveGridPoint,
    resolveLocalPoint,
  }) =>
    route({
      canvasMode,
      tool,
      button,
      isCtrlOrMetaPressed,
      hasColorPickerTarget,
      hasCanvasRect,
      screenPoint,
      executeColorPickerStart: () =>
        colorPicker({
          point: resolveGridPoint(screenPoint),
          preventDefault,
        }),
      executePrimaryCanvasStart: () => {
        const start = resolveGridPoint(screenPoint);
        if (!start) return false;

        return primaryCanvas({
          start,
          canvasMode,
          tool,
          shiftKey,
          anchorGrid,
          canvasBounds,
          brushChar,
          executeStructuredSelectStart: () =>
            structuredSelect({
              screenPoint: resolveLocalPoint(screenPoint),
              start,
              mouseDetail,
            }),
        });
      },
    });
