import type { InteractionEvent } from "../core/interactionMachine";
import type { SelectionPreviewController } from "../preview/selectionPreviewController";
import type { StructuredPreviewQueueController } from "../structured/structuredPreviewQueueExecution";

export type DragResetExecutor = {
  clearStructuredMoveQueueLast: () => void;
  clearStructuredSplitBoxResizeQueueLast: () => void;
  clearStructuredMovePreview: () => void;
  clearSelectionPreview: () => void;
  dispatchInteraction: (event: InteractionEvent) => void;
};

type DragResetController = {
  reset: () => void;
};

export const executeDragReset = (executor: DragResetExecutor): void => {
  executor.clearStructuredMoveQueueLast();
  executor.clearStructuredSplitBoxResizeQueueLast();
  executor.clearStructuredMovePreview();
  executor.clearSelectionPreview();
  executor.dispatchInteraction({ type: "reset" });
};

export const createDragResetController = ({
  structuredPreviewQueue,
  clearStructuredMovePreview,
  selectionPreview,
  dispatchInteraction,
}: {
  structuredPreviewQueue: StructuredPreviewQueueController;
  clearStructuredMovePreview: () => void;
  selectionPreview: SelectionPreviewController;
  dispatchInteraction: (event: InteractionEvent) => void;
}): DragResetController => ({
  reset: () => {
    executeDragReset({
      clearStructuredMoveQueueLast: structuredPreviewQueue.clearLastMove,
      clearStructuredSplitBoxResizeQueueLast:
        structuredPreviewQueue.clearLastSplitBoxResize,
      clearStructuredMovePreview,
      clearSelectionPreview: () =>
        selectionPreview.set(null, { immediate: true }),
      dispatchInteraction,
    });
  },
});
