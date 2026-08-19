import type { SelectionPreviewController } from "../preview/selectionPreviewController";
import type { StructuredPreviewQueueController } from "../structured/structuredPreviewQueueExecution";

export type DragResetExecutor = {
  clearScratch: () => void;
  clearStructuredMoveQueueLast: () => void;
  clearStructuredSplitBoxResizeQueueLast: () => void;
  clearStructuredMovePreview: () => void;
  clearSelectionPreview: () => void;
};

type DragResetController = {
  reset: () => void;
};

export const executeDragReset = (executor: DragResetExecutor): void => {
  executor.clearScratch();
  executor.clearStructuredMoveQueueLast();
  executor.clearStructuredSplitBoxResizeQueueLast();
  executor.clearStructuredMovePreview();
  executor.clearSelectionPreview();
};

export const createDragResetController = ({
  clearScratch,
  structuredPreviewQueue,
  clearStructuredMovePreview,
  selectionPreview,
}: {
  clearScratch: () => void;
  structuredPreviewQueue: StructuredPreviewQueueController;
  clearStructuredMovePreview: () => void;
  selectionPreview: SelectionPreviewController;
}): DragResetController => ({
  reset: () => {
    executeDragReset({
      clearScratch,
      clearStructuredMoveQueueLast: structuredPreviewQueue.clearLastMove,
      clearStructuredSplitBoxResizeQueueLast:
        structuredPreviewQueue.clearLastSplitBoxResize,
      clearStructuredMovePreview,
      clearSelectionPreview: () =>
        selectionPreview.set(null, { immediate: true }),
    });
  },
});
