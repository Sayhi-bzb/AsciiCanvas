import type {
  CanvasMode,
  Point,
  SelectionArea,
  StructuredNode,
  ToolType,
} from "@/shared/types";
import type { StructuredSplitBoxHandle } from "@/domains/canvas/state/helpers/structuredBoxEditing";
import {
  getInteractionStart,
  isPrimaryDragState,
  type InteractionEvent,
  type InteractionState,
} from "../core/interactionMachine";
import { resolveSelectionCommitDecision } from "../preview/selectionInteraction";
import { resolveDragEndCommitDecision } from "../commit/commitInteraction";
import {
  executeDragEndCommitDecision,
  executeSelectionCommitDecision,
  type DragEndCommitExecutor,
  type SelectionCommitExecutor,
} from "../commit/commitExecution";
import type { SelectionPreviewController } from "../preview/selectionPreviewController";
import type { StructuredPreviewQueueController } from "../structured/structuredPreviewQueueExecution";

export type PanningDragEndExecutor = {
  flushOffset: () => void;
  dispatchInteraction: (event: InteractionEvent) => void;
  setBodyCursor: (cursor: string) => void;
  clearLinkHover: () => void;
};

export type NonPanningDragEndExecutor = {
  setBodyCursor: (cursor: string) => void;
};

export const createNonPanningDragEndExecutor = ({
  setBodyCursor,
}: NonPanningDragEndExecutor): NonPanningDragEndExecutor => ({
  setBodyCursor,
});

export const executeNonPanningDragEndCleanup = (
  executor: NonPanningDragEndExecutor
): void => {
  executor.setBodyCursor("auto");
};
export type PrimaryDragEndExecutor = SelectionCommitExecutor &
  DragEndCommitExecutor & {
    flushSelectionPreview: () => void;
    getSelectionPreview: () => SelectionArea | null;
    resetDragState: () => void;
  };

export type PrimaryDragEndContext = {
  state: InteractionState;
  tool: ToolType;
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
  dragStart: Point | null;
  endGrid: Point;
  axis: "horizontal" | "vertical" | null;
  splitBoxDividerResize: boolean;
};

export const createPanningDragEndExecutor = ({
  flushOffset,
  dispatchInteraction,
  setBodyCursor,
  clearLinkHover,
}: {
  flushOffset: () => void;
  dispatchInteraction: (event: InteractionEvent) => void;
  setBodyCursor: (cursor: string) => void;
  clearLinkHover: () => void;
}): PanningDragEndExecutor => ({
  flushOffset,
  dispatchInteraction,
  setBodyCursor,
  clearLinkHover,
});

export const executePanningDragEnd = (
  executor: PanningDragEndExecutor
): void => {
  executor.flushOffset();
  executor.dispatchInteraction({ type: "reset" });
  executor.setBodyCursor("auto");
  executor.clearLinkHover();
};


export const resolvePrimaryDragEndContext = ({
  state,
  tool,
  canvasMode,
  structuredScene,
  resolvedEndGrid,
  isDividerHandle,
}: {
  state: InteractionState;
  tool: ToolType;
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
  resolvedEndGrid: Point | null;
  isDividerHandle: (handle: StructuredSplitBoxHandle) => boolean;
}): PrimaryDragEndContext => {
  const dragStart = getInteractionStart(state);
  const structuredDrag =
    state.type === "structuredMoving" ||
    state.type === "structuredRectResizing" ||
    state.type === "structuredSplitBoxResizing" ||
    state.type === "structuredSplitBoxResizePending" ||
    state.type === "structuredLineResizing"
      ? state.drag
      : null;
  return {
    state,
    tool,
    canvasMode,
    structuredScene,
    dragStart,
    endGrid: resolvedEndGrid || dragStart || { x: 0, y: 0 },
    axis: state.type === "shapePreview" ? state.axis : null,
    splitBoxDividerResize: isStructuredSplitBoxDividerDrag({
      nodeType: structuredDrag?.node.type ?? null,
      handle:
        structuredDrag?.node.type === "splitBox"
          ? (structuredDrag.handle as StructuredSplitBoxHandle | null)
          : null,
      isDividerHandle,
    }),
  };
};
export const executePrimaryDragEnd = (
  context: PrimaryDragEndContext,
  executor: PrimaryDragEndExecutor
): boolean => {
  if (context.state.type === "selecting") {
    executor.flushSelectionPreview();
    executeSelectionCommitDecision(
      resolveSelectionCommitDecision({
        selection: executor.getSelectionPreview(),
        tool: context.tool,
        canvasMode: context.canvasMode,
        structuredScene: context.structuredScene,
      }),
      executor
    );
    executor.resetDragState();
    return true;
  }

  if (isPrimaryDragState(context.state)) {
    executeDragEndCommitDecision(
      resolveDragEndCommitDecision({
        state: context.state,
        tool: context.tool,
        canvasMode: context.canvasMode,
        isStructuredSplitBoxDividerResize: context.splitBoxDividerResize,
      }),
      executor,
      {
        tool: context.tool,
        startGrid: context.dragStart,
        endGrid: context.endGrid,
        axis: context.axis,
      }
    );
    executor.resetDragState();
    return true;
  }

  return false;
};

export const isStructuredSplitBoxDividerDrag = (input: {
  nodeType: StructuredNode["type"] | null;
  handle: StructuredSplitBoxHandle | null;
  isDividerHandle: (handle: StructuredSplitBoxHandle) => boolean;
}): boolean =>
  input.nodeType === "splitBox" &&
  !!input.handle &&
  input.isDividerHandle(input.handle);

export const createPrimaryDragEndExecutor = ({
  selectionPreview,
  structuredPreviewQueue,
  fillArea,
  setSelectedStructuredNodeIds,
  setSelectedStructuredSplitHandle,
  setStructuredGridFocus,
  setTextCursor,
  addSelection,
  clearSelections,
  commitScratch,
  forceHistorySave,
  commitStructuredShape,
  resetDragState,
}: {
  selectionPreview: SelectionPreviewController;
  structuredPreviewQueue: StructuredPreviewQueueController;
  fillArea: SelectionCommitExecutor["fillArea"];
  setSelectedStructuredNodeIds: SelectionCommitExecutor["setSelectedStructuredNodeIds"];
  setSelectedStructuredSplitHandle: SelectionCommitExecutor["setSelectedStructuredSplitHandle"];
  setStructuredGridFocus: SelectionCommitExecutor["setStructuredGridFocus"];
  setTextCursor: SelectionCommitExecutor["setTextCursor"];
  addSelection: SelectionCommitExecutor["addSelection"];
  clearSelections: SelectionCommitExecutor["clearSelections"];
  commitScratch: DragEndCommitExecutor["commitScratch"];
  forceHistorySave: DragEndCommitExecutor["forceHistorySave"];
  commitStructuredShape: DragEndCommitExecutor["commitStructuredShape"];
  resetDragState: () => void;
}): PrimaryDragEndExecutor => ({
  flushSelectionPreview: () => selectionPreview.flush(),
  getSelectionPreview: () => selectionPreview.get(),
  fillArea,
  setSelectedStructuredNodeIds,
  setSelectedStructuredSplitHandle,
  setStructuredGridFocus,
  setTextCursor,
  addSelection,
  clearSelections,
  clearSelectionPreview: () => selectionPreview.set(null, { immediate: true }),
  commitScratch,
  forceHistorySave,
  commitStructuredShape,
  flushStructuredMove: () => structuredPreviewQueue.flushMove(true),
  flushStructuredSplitBoxResize: () =>
    structuredPreviewQueue.flushSplitBoxResize(true),
  resetDragState,
});

export type PrimaryDragEndHandler = ({
  state,
  tool,
  canvasMode,
  structuredScene,
  resolvedEndGrid,
  isDividerHandle,
}: {
  state: InteractionState;
  tool: ToolType;
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
  resolvedEndGrid: Point | null;
  isDividerHandle: (handle: StructuredSplitBoxHandle) => boolean;
}) => boolean;

export const createPrimaryDragEndHandler = ({
  executor,
}: {
  executor: PrimaryDragEndExecutor;
}): PrimaryDragEndHandler => ({
  state,
  tool,
  canvasMode,
  structuredScene,
  resolvedEndGrid,
  isDividerHandle,
}) =>
  executePrimaryDragEnd(
    resolvePrimaryDragEndContext({
      state,
      tool,
      canvasMode,
      structuredScene,
      resolvedEndGrid,
      isDividerHandle,
    }),
    executor
  );
export type DragEndRouteHandler = ({
  state,
  button,
  executePrimaryEnd,
}: {
  state: InteractionState;
  button: number;
  executePrimaryEnd: () => void;
}) => void;

export const createDragEndRouteHandler = ({
  panning,
  nonPanning,
}: {
  panning: PanningDragEndExecutor;
  nonPanning: NonPanningDragEndExecutor;
}): DragEndRouteHandler =>
  ({ state, button, executePrimaryEnd }) => {
    if (state.type === "panning") {
      executePanningDragEnd(panning);
      return;
    }

    if (button === 0) executePrimaryEnd();
    executeNonPanningDragEndCleanup(nonPanning);
  };
