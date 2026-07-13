import type { InteractionEvent } from "../core/interactionMachine";
import type { StructuredPreviewQueueController } from "../structured/structuredPreviewQueueExecution";

export type DragResetExecutor = {
  clearStructuredMoveQueueLast: () => void;
  clearStructuredSplitBoxResizeQueueLast: () => void;
  clearStructuredMovePreview: () => void;
  dispatchInteraction: (event: InteractionEvent) => void;
};

export type DragResetController = {
  reset: () => void;
};

export const executeDragReset = (executor: DragResetExecutor): void => {
  executor.clearStructuredMoveQueueLast();
  executor.clearStructuredSplitBoxResizeQueueLast();
  executor.clearStructuredMovePreview();
  executor.dispatchInteraction({ type: "reset" });
};

export const createDragResetController = ({
  structuredPreviewQueue,
  clearStructuredMovePreview,
  dispatchInteraction,
}: {
  structuredPreviewQueue: StructuredPreviewQueueController;
  clearStructuredMovePreview: () => void;
  dispatchInteraction: (event: InteractionEvent) => void;
}): DragResetController => ({
  reset: () => {
    executeDragReset({
      clearStructuredMoveQueueLast: structuredPreviewQueue.clearLastMove,
      clearStructuredSplitBoxResizeQueueLast:
        structuredPreviewQueue.clearLastSplitBoxResize,
      clearStructuredMovePreview,
      dispatchInteraction,
    });
  },
});
