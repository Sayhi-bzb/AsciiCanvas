import type {
  CanvasMode,
  Point,
  SelectionArea,
  StructuredNode,
  ToolType,
} from "@/shared/types";
import type { StructuredSplitBoxHandle } from "@/domains/canvas/state/helpers/structuredBoxEditing";
import type { LegacyInteractionMode, InteractionEvent } from "../core/interactionMachine";
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

type RefCell<T> = { current: T };

export type PanningDragEndExecutor = {
  flushOffset: () => void;
  setIsPanning: (isPanning: boolean) => void;
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
  mode: LegacyInteractionMode;
  tool: ToolType;
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
  dragStart: Point | null;
  endGrid: Point;
  axis: "horizontal" | "vertical" | null;
  splitBoxDividerResize: boolean;
};

const primaryCommitModes = new Set<LegacyInteractionMode>([
  "drawing",
  "shape-preview",
  "structured-node-moving",
  "structured-box-resizing",
  "structured-line-resizing",
  "structured-splitbox-resizing",
]);

export const createPanningDragEndExecutor = ({
  isPanning,
  flushOffset,
  dispatchInteraction,
  setBodyCursor,
  clearLinkHover,
}: {
  isPanning: RefCell<boolean>;
  flushOffset: () => void;
  dispatchInteraction: (event: InteractionEvent) => void;
  setBodyCursor: (cursor: string) => void;
  clearLinkHover: () => void;
}): PanningDragEndExecutor => ({
  flushOffset,
  setIsPanning: (nextIsPanning) => {
    isPanning.current = nextIsPanning;
  },
  dispatchInteraction,
  setBodyCursor,
  clearLinkHover,
});

export const executePanningDragEnd = (
  executor: PanningDragEndExecutor
): void => {
  executor.flushOffset();
  executor.setIsPanning(false);
  executor.dispatchInteraction({ type: "reset" });
  executor.setBodyCursor("auto");
  executor.clearLinkHover();
};


export const resolvePrimaryDragEndContext = ({
  mode,
  tool,
  canvasMode,
  structuredScene,
  dragStart,
  resolvedEndGrid,
  axis,
  dragNodeType,
  dragHandle,
  isDividerHandle,
}: {
  mode: LegacyInteractionMode;
  tool: ToolType;
  canvasMode: CanvasMode;
  structuredScene: StructuredNode[];
  dragStart: Point | null;
  resolvedEndGrid: Point | null;
  axis: "horizontal" | "vertical" | null;
  dragNodeType: StructuredNode["type"] | null;
  dragHandle: string | null;
  isDividerHandle: (handle: StructuredSplitBoxHandle) => boolean;
}): PrimaryDragEndContext => ({
  mode,
  tool,
  canvasMode,
  structuredScene,
  dragStart,
  endGrid: resolvedEndGrid || dragStart || { x: 0, y: 0 },
  axis,
  splitBoxDividerResize: isStructuredSplitBoxDividerDrag({
    nodeType: dragNodeType,
    handle:
      dragNodeType === "splitBox"
        ? (dragHandle as StructuredSplitBoxHandle | null)
        : null,
    isDividerHandle,
  }),
});
export const executePrimaryDragEnd = (
  context: PrimaryDragEndContext,
  executor: PrimaryDragEndExecutor
): boolean => {
  if (context.mode === "selecting") {
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

  if (primaryCommitModes.has(context.mode)) {
    executeDragEndCommitDecision(
      resolveDragEndCommitDecision({
        mode: context.mode,
        tool: context.tool,
        canvasMode: context.canvasMode,
        hasDragStart: !!context.dragStart,
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
