import type { StateCreator } from "zustand";
import type { CanvasState, AnimationSlice } from "../interfaces";
import type { AnimationFrame, AnimationTimeline, AnimationCanvasSize, GridCell } from "@/shared/types";
import {
  cloneAnimationTimeline,
  getAnimationFrameEntries,
  normalizeAnimationCanvasSize,
  updateAnimationFrameEntries,
  getAnimationFrameIndex,
  createEmptyAnimationFrame,
  createNextAnimationFrameName,
  getUniqueAnimationFrameName,
  createDuplicateAnimationFrameName,
  cloneAnimationFrame,
  DEFAULT_ANIMATION_SIZE,
} from "../helpers/animationHelpers";
import { withActiveCanvasSnapshot } from "../helpers/sessionHelpers";
import { createMapFromEntries, serializeGrid } from "../helpers/snapshotHelpers";
import { applyFreeformSnapshotToYMaps } from "../helpers/gridHelpers";

export const createAnimationSlice: StateCreator<
  CanvasState,
  [],
  [],
  AnimationSlice
> = (set, get) => {
  const syncAnimationRuntime = (
    timeline: AnimationTimeline,
    options?: {
      currentFrameId?: string;
      size?: AnimationCanvasSize;
      isPlaying?: boolean;
    }
  ) => {
    const state = get();
    const nextTimeline = cloneAnimationTimeline(timeline);
    if (
      options?.currentFrameId &&
      nextTimeline.frames.some((frame) => frame.id === options.currentFrameId)
    ) {
      nextTimeline.currentFrameId = options.currentFrameId;
    }
    const nextGridEntries = getAnimationFrameEntries(
      nextTimeline,
      nextTimeline.currentFrameId
    );
    const nextBounds = normalizeAnimationCanvasSize(
      options?.size ?? state.canvasBounds ?? DEFAULT_ANIMATION_SIZE
    );

    set({
      canvasMode: "animation",
      structuredScene: [],
      grid: createMapFromEntries(nextGridEntries),
      canvasBounds: nextBounds,
      animationTimeline: nextTimeline,
      animationIsPlaying: options?.isPlaying ?? state.animationIsPlaying,
      selections: [],
      textCursor: null,
      hoveredGrid: null,
      scratchLayer: null,
      canvasSessions: withActiveCanvasSnapshot(
        state.canvasSessions,
        state.activeCanvasId,
        {
          mode: "animation",
          scene: [],
          grid: nextGridEntries,
          size: nextBounds,
          timeline: nextTimeline,
        }
      ),
    });
    applyFreeformSnapshotToYMaps(nextGridEntries);
  };

  return {
    setAnimationCurrentFrame: (frameId) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      if (
        !state.animationTimeline.frames.some((frame) => frame.id === frameId)
      ) {
        return;
      }

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      syncAnimationRuntime(syncedTimeline, {
        currentFrameId: frameId,
        isPlaying: state.animationIsPlaying,
      });
    },
    insertAnimationFrame: (position = "after") => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      const currentIndex = getAnimationFrameIndex(
        syncedTimeline,
        syncedTimeline.currentFrameId
      );
      const nextFrame = createEmptyAnimationFrame(
        undefined,
        createNextAnimationFrameName(syncedTimeline.frames)
      );
      const insertIndex =
        position === "before" ? currentIndex : currentIndex + 1;
      const nextTimeline = cloneAnimationTimeline(syncedTimeline);
      nextTimeline.frames.splice(insertIndex, 0, nextFrame);
      nextTimeline.currentFrameId = nextFrame.id;
      syncAnimationRuntime(nextTimeline, { isPlaying: false });
    },
    renameAnimationFrame: (frameId, nextName) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      if (!nextName.trim()) return;

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      const targetIndex = getAnimationFrameIndex(syncedTimeline, frameId);
      if (targetIndex === -1) return;

      const resolvedName = getUniqueAnimationFrameName(
        syncedTimeline.frames,
        nextName,
        frameId
      );
      const nextTimeline = cloneAnimationTimeline(syncedTimeline);
      nextTimeline.frames[targetIndex] = {
        ...nextTimeline.frames[targetIndex],
        name: resolvedName,
      };
      syncAnimationRuntime(nextTimeline, {
        isPlaying: state.animationIsPlaying,
      });
    },
    duplicateAnimationFrame: (frameId) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      const sourceFrameId = frameId ?? syncedTimeline.currentFrameId;
      const sourceIndex = getAnimationFrameIndex(syncedTimeline, sourceFrameId);
      if (sourceIndex === -1) return;
      const nextTimeline = cloneAnimationTimeline(syncedTimeline);
      const sourceFrame = nextTimeline.frames[sourceIndex];
      const duplicated = {
        id: createEmptyAnimationFrame().id,
        name: createDuplicateAnimationFrameName(
          nextTimeline.frames,
          sourceFrame.name
        ),
        grid: sourceFrame.grid.map(
          ([key, cell]) => [key, { ...cell }] as [string, GridCell]
        ),
      };
      nextTimeline.frames.splice(sourceIndex + 1, 0, duplicated);
      nextTimeline.currentFrameId = duplicated.id;
      syncAnimationRuntime(nextTimeline, { isPlaying: false });
    },
    removeAnimationFrame: (frameId) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      if (syncedTimeline.frames.length <= 1) {
        const clearedTimeline = updateAnimationFrameEntries(
          syncedTimeline,
          syncedTimeline.currentFrameId,
          []
        );
        syncAnimationRuntime(clearedTimeline, { isPlaying: false });
        return;
      }

      const targetFrameId = frameId ?? syncedTimeline.currentFrameId;
      const targetIndex = getAnimationFrameIndex(syncedTimeline, targetFrameId);
      if (targetIndex === -1) return;

      const nextTimeline = cloneAnimationTimeline(syncedTimeline);
      nextTimeline.frames.splice(targetIndex, 1);
      const fallbackIndex = Math.min(
        targetIndex,
        nextTimeline.frames.length - 1
      );
      nextTimeline.currentFrameId = nextTimeline.frames[fallbackIndex].id;
      syncAnimationRuntime(nextTimeline, { isPlaying: false });
    },
    moveAnimationFrame: (frameId, direction) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      const currentIndex = getAnimationFrameIndex(syncedTimeline, frameId);
      if (currentIndex === -1) return;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= syncedTimeline.frames.length) return;

      const nextTimeline = cloneAnimationTimeline(syncedTimeline);
      const [frame] = nextTimeline.frames.splice(currentIndex, 1);
      nextTimeline.frames.splice(nextIndex, 0, frame);
      syncAnimationRuntime(nextTimeline, {
        isPlaying: state.animationIsPlaying,
      });
    },
    reorderAnimationFrames: (frameIds) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      if (frameIds.length !== state.animationTimeline.frames.length) return;

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      const frameMap = new Map(
        syncedTimeline.frames.map((frame) => [frame.id, frame] as const)
      );
      if (frameMap.size !== frameIds.length) return;

      const nextFrames = frameIds
        .map((frameId) => frameMap.get(frameId))
        .filter((frame): frame is (typeof syncedTimeline.frames)[number] => !!frame);

      if (nextFrames.length !== syncedTimeline.frames.length) return;

      const nextTimeline = cloneAnimationTimeline(syncedTimeline);
      nextTimeline.frames = nextFrames.map((frame) => cloneAnimationFrame(frame));

      syncAnimationRuntime(nextTimeline, {
        isPlaying: state.animationIsPlaying,
      });
    },
    setAnimationFps: (fps) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      syncedTimeline.fps = Math.max(1, Math.min(24, Math.round(fps)));
      syncAnimationRuntime(syncedTimeline, {
        isPlaying: state.animationIsPlaying,
      });
    },
    toggleAnimationLoop: () => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      syncedTimeline.loop = !syncedTimeline.loop;
      syncAnimationRuntime(syncedTimeline, {
        isPlaying: state.animationIsPlaying,
      });
    },
    setOnionSkinSettings: (settings) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      syncedTimeline.onionSkin = {
        ...syncedTimeline.onionSkin,
        ...settings,
        opacityFalloff: Array.isArray(settings.opacityFalloff)
          ? settings.opacityFalloff
              .filter((value): value is number => typeof value === "number")
              .map((value) => Math.max(0, Math.min(1, value)))
          : syncedTimeline.onionSkin.opacityFalloff,
      };
      syncAnimationRuntime(syncedTimeline, {
        isPlaying: state.animationIsPlaying,
      });
    },
    setAnimationCanvasSize: (size) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      const nextBounds = normalizeAnimationCanvasSize(size);
      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid).filter(([key]) => {
          const [x, y] = key.split(",").map(Number);
          return (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            x >= 0 &&
            y >= 0 &&
            x < nextBounds.width &&
            y < nextBounds.height
          );
        })
      );
      syncedTimeline.frames = syncedTimeline.frames.map((frame) => ({
        ...frame,
        grid: frame.grid.filter(([key]) => {
          const [x, y] = key.split(",").map(Number);
          return (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            x >= 0 &&
            y >= 0 &&
            x < nextBounds.width &&
            y < nextBounds.height
          );
        }),
      }));
      syncAnimationRuntime(syncedTimeline, {
        size: nextBounds,
        isPlaying: state.animationIsPlaying,
      });
    },
    applyGeneratedAnimationFrames: (
      frames: AnimationFrame[],
      mode: "insert-after-current" | "replace-animation" | "append-to-end",
      options?: { fps?: number; size?: AnimationCanvasSize }
    ) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      if (frames.length === 0) return;

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      const sourceFrames = frames.map(
        (frame, index) =>
          ({
            ...frame,
            id: `${frame.id}-${Date.now().toString(36)}-${index}`,
            grid: frame.grid.map(
              ([key, cell]) => [key, { ...cell }] as [string, GridCell]
            ),
          } satisfies AnimationFrame)
      );
      const nextTimeline = cloneAnimationTimeline(syncedTimeline);

      if (mode === "replace-animation") {
        nextTimeline.frames = sourceFrames;
        nextTimeline.currentFrameId = sourceFrames[0].id;
      } else if (mode === "append-to-end") {
        nextTimeline.frames.push(...sourceFrames);
        nextTimeline.currentFrameId = sourceFrames[0].id;
      } else {
        const currentIndex = getAnimationFrameIndex(
          nextTimeline,
          nextTimeline.currentFrameId
        );
        const insertIndex = currentIndex === -1 ? nextTimeline.frames.length : currentIndex + 1;
        nextTimeline.frames.splice(insertIndex, 0, ...sourceFrames);
        nextTimeline.currentFrameId = sourceFrames[0].id;
      }

      if (options?.fps) {
        nextTimeline.fps = Math.max(1, Math.min(24, Math.round(options.fps)));
      }

      syncAnimationRuntime(nextTimeline, {
        currentFrameId: nextTimeline.currentFrameId,
        size: options?.size,
        isPlaying: false,
      });
    },
    playAnimation: () => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;
      set({ animationIsPlaying: true });
    },
    pauseAnimation: () => {
      const state = get();
      if (state.canvasMode !== "animation") return;
      set({ animationIsPlaying: false });
    },
    stepAnimationFrame: (direction = 1) => {
      const state = get();
      if (state.canvasMode !== "animation" || !state.animationTimeline) return;

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      const currentIndex = getAnimationFrameIndex(
        syncedTimeline,
        syncedTimeline.currentFrameId
      );
      if (currentIndex === -1) return;

      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) {
        nextIndex = syncedTimeline.loop
          ? syncedTimeline.frames.length - 1
          : currentIndex;
      }
      if (nextIndex >= syncedTimeline.frames.length) {
        nextIndex = syncedTimeline.loop ? 0 : currentIndex;
      }

      syncAnimationRuntime(syncedTimeline, {
        currentFrameId: syncedTimeline.frames[nextIndex].id,
        isPlaying: state.animationIsPlaying,
      });
    },
    tickAnimationPlayback: () => {
      const state = get();
      if (
        state.canvasMode !== "animation" ||
        !state.animationTimeline ||
        !state.animationIsPlaying
      ) {
        return;
      }

      const syncedTimeline = updateAnimationFrameEntries(
        state.animationTimeline,
        state.animationTimeline.currentFrameId,
        serializeGrid(state.grid)
      );
      const currentIndex = getAnimationFrameIndex(
        syncedTimeline,
        syncedTimeline.currentFrameId
      );
      if (currentIndex === -1) return;

      const nextIndex = currentIndex + 1;
      if (nextIndex >= syncedTimeline.frames.length) {
        if (!syncedTimeline.loop) {
          set({ animationIsPlaying: false, animationTimeline: syncedTimeline });
          return;
        }
        syncAnimationRuntime(syncedTimeline, {
          currentFrameId: syncedTimeline.frames[0].id,
          isPlaying: true,
        });
        return;
      }

      syncAnimationRuntime(syncedTimeline, {
        currentFrameId: syncedTimeline.frames[nextIndex].id,
        isPlaying: true,
      });
    },
  };
};
