import type { Point } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import {
  buildStructuredMoveCommitScene,
  buildStructuredMovePreview,
  buildStructuredSplitBoxResizeCommitScene,
  buildStructuredSplitBoxResizePreview,
  type StructuredMovePreview,
} from "./structuredInteractionPreview";
import {
  createRafPreviewQueue,
  type RafPreviewQueue,
} from "../preview/rafPreviewQueue";
import type { StructuredNodeDragPayload } from "./structuredDragStart";

type QueuedStructuredMove = {
  drag: StructuredNodeDragPayload;
  delta: Point;
  scene: StructuredNode[];
};

type QueuedStructuredSplitBoxResize = {
  drag: StructuredNodeDragPayload;
  point: Point;
  scene: StructuredNode[];
};

type StructuredMovePreviewQueue = RafPreviewQueue<QueuedStructuredMove>;
type StructuredSplitBoxResizePreviewQueue =
  RafPreviewQueue<QueuedStructuredSplitBoxResize>;

export type StructuredPreviewQueueController = {
  queueMove: (
    drag: StructuredNodeDragPayload,
    delta: Point,
    scene: StructuredNode[]
  ) => void;
  queueSplitBoxResize: (
    drag: StructuredNodeDragPayload,
    point: Point,
    scene: StructuredNode[]
  ) => void;
  flushMove: (commit?: boolean) => void;
  flushSplitBoxResize: (commit?: boolean) => void;
  clearLastMove: () => void;
  clearLastSplitBoxResize: () => void;
  cancel: () => void;
};

export const createStructuredMovePreviewQueue = ({
  setStructuredMovePreview,
}: {
  setStructuredMovePreview: (preview: StructuredMovePreview) => void;
}): StructuredMovePreviewQueue =>
  createRafPreviewQueue({
    onFlush: (queued) => {
      setStructuredMovePreview(
        buildStructuredMovePreview(queued.drag, queued.delta)
      );
    },
  });

export const createStructuredSplitBoxResizePreviewQueue = ({
  setStructuredMovePreview,
}: {
  setStructuredMovePreview: (preview: StructuredMovePreview) => void;
}): StructuredSplitBoxResizePreviewQueue =>
  createRafPreviewQueue({
    onFlush: (queued) => {
      const preview = buildStructuredSplitBoxResizePreview(
        queued.drag,
        queued.point
      );
      if (preview) setStructuredMovePreview(preview);
    },
  });

export const queueStructuredMovePreview = (
  queue: StructuredMovePreviewQueue,
  drag: StructuredNodeDragPayload,
  delta: Point,
  scene: StructuredNode[]
): void => {
  queue.queue({ drag, delta, scene });
};

export const queueStructuredSplitBoxResizePreview = (
  queue: StructuredSplitBoxResizePreviewQueue,
  drag: StructuredNodeDragPayload,
  point: Point,
  scene: StructuredNode[]
): void => {
  queue.queue({ drag, point, scene });
};

export const flushStructuredMovePreviewQueue = ({
  queue,
  commit,
  applyStructuredScene,
  clearStructuredMovePreview,
}: {
  queue: StructuredMovePreviewQueue;
  commit: boolean;
  applyStructuredScene: (scene: StructuredNode[], merge: true) => void;
  clearStructuredMovePreview: () => void;
}): void => {
  const queued = queue.flush({ useLast: commit });
  if (!queued || !commit) return;
  applyStructuredScene(
    buildStructuredMoveCommitScene(
      queued.scene,
      queued.drag.selectedNodes,
      queued.delta
    ),
    true
  );
  clearStructuredMovePreview();
};

export const flushStructuredSplitBoxResizePreviewQueue = ({
  queue,
  commit,
  applyStructuredScene,
  clearStructuredMovePreview,
}: {
  queue: StructuredSplitBoxResizePreviewQueue;
  commit: boolean;
  applyStructuredScene: (scene: StructuredNode[], merge: true) => void;
  clearStructuredMovePreview: () => void;
}): void => {
  const queued = queue.flush({ useLast: commit });
  if (!queued || !commit) return;
  const nextScene = buildStructuredSplitBoxResizeCommitScene(
    queued.scene,
    queued.drag,
    queued.point
  );
  if (!nextScene) return;
  applyStructuredScene(nextScene, true);
  clearStructuredMovePreview();
};

export const createStructuredPreviewQueueController = ({
  setStructuredMovePreview,
  applyStructuredScene,
  clearStructuredMovePreview,
}: {
  setStructuredMovePreview: (preview: StructuredMovePreview) => void;
  applyStructuredScene: (scene: StructuredNode[], merge: true) => void;
  clearStructuredMovePreview: () => void;
}): StructuredPreviewQueueController => {
  const moveQueue = createStructuredMovePreviewQueue({
    setStructuredMovePreview,
  });
  const splitBoxResizeQueue = createStructuredSplitBoxResizePreviewQueue({
    setStructuredMovePreview,
  });

  return {
    queueMove: (drag, delta, scene) => {
      queueStructuredMovePreview(moveQueue, drag, delta, scene);
    },
    queueSplitBoxResize: (drag, point, scene) => {
      queueStructuredSplitBoxResizePreview(
        splitBoxResizeQueue,
        drag,
        point,
        scene
      );
    },
    flushMove: (commit = false) => {
      flushStructuredMovePreviewQueue({
        queue: moveQueue,
        commit,
        applyStructuredScene,
        clearStructuredMovePreview,
      });
    },
    flushSplitBoxResize: (commit = false) => {
      flushStructuredSplitBoxResizePreviewQueue({
        queue: splitBoxResizeQueue,
        commit,
        applyStructuredScene,
        clearStructuredMovePreview,
      });
    },
    clearLastMove: () => {
      moveQueue.clearLast();
    },
    clearLastSplitBoxResize: () => {
      splitBoxResizeQueue.clearLast();
    },
    cancel: () => {
      splitBoxResizeQueue.cancel();
      moveQueue.cancel();
    },
  };
};
