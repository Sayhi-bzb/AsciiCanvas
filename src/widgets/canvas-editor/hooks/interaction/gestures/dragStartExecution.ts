import type { Point, SelectionArea } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "@/domains/canvas/public";
import {
  resolveDragStartRouteDecision,
  resolveDrawingShapeDragStartDecision,
  resolveSelectionDragStartDecision,
  type DrawingShapeDragStartDecision,
  type SelectionDragStartDecision,
} from "./dragStartInteraction";
import type { InteractionEvent } from "../core/interactionMachine";

type PanningDragStartExecutor = {
  dispatchInteraction: (event: InteractionEvent) => void;
  setCursor: (cursor: string) => void;
};

export const createPanningDragStartExecutor = ({
  dispatchInteraction,
  setCursor,
}: {
  dispatchInteraction: (event: InteractionEvent) => void;
  setCursor: (cursor: string) => void;
}): PanningDragStartExecutor => ({
  dispatchInteraction,
  setCursor,
});

export const executePanningDragStart = (
  lastScreen: Point,
  executor: PanningDragStartExecutor
): void => {
  executor.dispatchInteraction({ type: "startPanning", lastScreen });
  executor.setCursor("grabbing");
};
type SelectionDragStartExecutor = {
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

type DrawingShapeDragStartExecutor = {
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

type PrimaryCanvasDragStartContext = {
  start: Point;
  canvasMode: CanvasMode;
  tool: ToolType;
  shiftKey: boolean;
  anchorGrid: Point | null;
  brushChar: string;
  executeStructuredSelectStart: (() => boolean) | null;
};

const executePrimaryCanvasDragStart = (
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


type PrimaryCanvasDragStartHandler = (
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

type DragStartRouteHandler = ({
  tool,
  button,
  isCtrlOrMetaPressed,
  hasColorPickerTarget,
  hasCanvasRect,
  screenPoint,
  executeColorPickerStart,
  executePrimaryCanvasStart,
}: {
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
  tool,
  button,
  isCtrlOrMetaPressed,
  hasColorPickerTarget,
  hasCanvasRect,
  screenPoint,
  shiftKey,
  anchorGrid,
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
    brushChar,
    mouseDetail,
    preventDefault,
    resolveGridPoint,
    resolveLocalPoint,
  }) =>
    route({
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
