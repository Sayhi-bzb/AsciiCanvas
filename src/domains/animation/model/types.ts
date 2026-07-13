import type { GridCell } from "@/shared/types";

export interface AnimationCanvasSize {
  width: number;
  height: number;
}

export interface OnionSkinSettings {
  enabled: boolean;
  backwardLayers: number;
  forwardLayers: number;
  opacityFalloff: number[];
}

export interface AnimationFrame {
  id: string;
  name: string;
  grid: [string, GridCell][];
}

export interface AnimationTimeline {
  frames: AnimationFrame[];
  currentFrameId: string;
  fps: number;
  loop: boolean;
  onionSkin: OnionSkinSettings;
}
