import type { Point } from "@/shared/types";
import type { InteractionEvent } from "../core/interactionMachine";
import type { StructuredNodeDragPayload } from "../structured/structuredDragStart";
import type { StructuredPreviewQueueController } from "../structured/structuredPreviewQueueExecution";

type RefCell<T> = { current: T };

export type DragResetExecutor = {
  clearDragStartGrid: () => void;
  clearLastGrid: () => void;
  clearLastPlacedGrid: () => void;
  clearLineAxis: () => void;
  clearStructuredNodeDrag: () => void;
  clearStructuredMoveQueueLast: () => void;
  clearStructuredSplitBoxResizeQueueLast: () => void;
  clearStructuredMovePreview: () => void;
  clearStructuredTextSelectionStart: () => void;
  dispatchInteraction: (event: InteractionEvent) => void;
};

export type DragResetController = {
  reset: () => void;
};

export type DragResetControllerRefs = {
  dragStartGrid: RefCell<Point | null>;
  lastGrid: RefCell<Point | null>;
  lastPlacedGrid: RefCell<Point | null>;
  lineAxis: RefCell<"vertical" | "horizontal" | null>;
  structuredNodeDrag: RefCell<StructuredNodeDragPayload | null>;
  structuredTextSelectionStart: RefCell<{
    nodeId: string;
    offset: number;
  } | null>;
};

export const executeDragReset = (executor: DragResetExecutor): void => {
  executor.clearDragStartGrid();
  executor.clearLastGrid();
  executor.clearLastPlacedGrid();
  executor.clearLineAxis();
  executor.clearStructuredNodeDrag();
  executor.clearStructuredMoveQueueLast();
  executor.clearStructuredSplitBoxResizeQueueLast();
  executor.clearStructuredMovePreview();
  executor.clearStructuredTextSelectionStart();
  executor.dispatchInteraction({ type: "reset" });
};

export const createDragResetController = ({
  refs,
  structuredPreviewQueue,
  clearStructuredMovePreview,
  dispatchInteraction,
}: {
  refs: DragResetControllerRefs;
  structuredPreviewQueue: StructuredPreviewQueueController;
  clearStructuredMovePreview: () => void;
  dispatchInteraction: (event: InteractionEvent) => void;
}): DragResetController => ({
  reset: () => {
    executeDragReset({
      clearDragStartGrid: () => {
        refs.dragStartGrid.current = null;
      },
      clearLastGrid: () => {
        refs.lastGrid.current = null;
      },
      clearLastPlacedGrid: () => {
        refs.lastPlacedGrid.current = null;
      },
      clearLineAxis: () => {
        refs.lineAxis.current = null;
      },
      clearStructuredNodeDrag: () => {
        refs.structuredNodeDrag.current = null;
      },
      clearStructuredMoveQueueLast: () => {
        structuredPreviewQueue.clearLastMove();
      },
      clearStructuredSplitBoxResizeQueueLast: () => {
        structuredPreviewQueue.clearLastSplitBoxResize();
      },
      clearStructuredMovePreview,
      clearStructuredTextSelectionStart: () => {
        refs.structuredTextSelectionStart.current = null;
      },
      dispatchInteraction,
    });
  },
});
