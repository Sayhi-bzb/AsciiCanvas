import type { GridMap } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import {
  getAnimationFrameIndex,
  type AnimationFrame,
  type AnimationTimeline,
} from "@/domains/animation/public";

export const resolveAnimationGhostLayers = ({
  canvasMode,
  timeline,
  playbackFrameId,
  getFrameGrid,
}: {
  canvasMode: CanvasMode;
  timeline: AnimationTimeline | null;
  playbackFrameId: string | null;
  getFrameGrid: (frame: AnimationFrame) => GridMap;
}) => {
  if (canvasMode !== "animation" || !timeline?.onionSkin.enabled) return [];
  const currentIndex = getAnimationFrameIndex(
    timeline,
    playbackFrameId ?? timeline.currentFrameId
  );
  if (currentIndex === -1) return [];

  const { backwardLayers, forwardLayers, opacityFalloff } = timeline.onionSkin;
  const layers: Array<{ grid: GridMap; alpha: number }> = [];
  for (let distance = backwardLayers; distance >= 1; distance -= 1) {
    const frame = timeline.frames[currentIndex - distance];
    const alpha = opacityFalloff[distance - 1] ?? 0;
    if (frame && alpha > 0) layers.push({ grid: getFrameGrid(frame), alpha });
  }
  for (let distance = 1; distance <= forwardLayers; distance += 1) {
    const frame = timeline.frames[currentIndex + distance];
    const alpha = opacityFalloff[distance - 1] ?? 0;
    if (frame && alpha > 0) layers.push({ grid: getFrameGrid(frame), alpha });
  }
  return layers;
};
