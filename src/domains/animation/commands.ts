import type { AnimationCanvasSize, AnimationFrame, OnionSkinSettings } from "@/domains/animation/public";

export interface AnimationCommands {
  setAnimationCurrentFrame: (frameId: string) => void;
  insertAnimationFrame: (position?: "before" | "after") => void;
  renameAnimationFrame: (frameId: string, nextName: string) => void;
  duplicateAnimationFrame: (frameId?: string) => void;
  duplicateAnimationFrames: (frameIds: string[]) => string[];
  removeAnimationFrame: (frameId?: string) => void;
  removeAnimationFrames: (frameIds: string[]) => string[];
  moveAnimationFrame: (frameId: string, direction: -1 | 1) => void;
  reorderAnimationFrames: (frameIds: string[]) => void;
  setAnimationFps: (fps: number) => void;
  toggleAnimationLoop: () => void;
  setOnionSkinSettings: (settings: Partial<OnionSkinSettings>) => void;
  setAnimationCanvasSize: (size: AnimationCanvasSize) => void;
  applyGeneratedAnimationFrames: (
    frames: AnimationFrame[],
    mode: "insert-after-current" | "replace-animation" | "append-to-end",
    options?: { fps?: number; size?: AnimationCanvasSize }
  ) => void;
  playAnimation: () => void;
  pauseAnimation: () => void;
  stepAnimationFrame: (direction?: -1 | 1) => void;
  tickAnimationPlayback: () => void;
}
