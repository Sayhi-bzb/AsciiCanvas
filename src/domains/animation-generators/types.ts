import type { AnimationFrame, GridCell } from "@/shared/types";

export type GeneratedAnimationApplyMode =
  | "insert-after-current"
  | "replace-animation"
  | "append-to-end";

export type AnimationGeneratorKind =
  | "spinner"
  | "sweep-highlight"
  | "reveal"
  | "color-flow";

export type AnimationGeneratorConfig =
  | {
      kind: "spinner";
      sequence: string;
      x: number;
      y: number;
      color: string;
      loops: number;
    }
  | {
      kind: "sweep-highlight";
      direction: "left-to-right" | "right-to-left";
      highlightColor: string;
      width: number;
      frameCount: number;
      preserveBaseColor: boolean;
    }
  | {
      kind: "reveal";
      direction: "left-to-right" | "top-to-bottom";
      frameCount: number;
    }
  | {
      kind: "color-flow";
      fromColor: string;
      toColor: string;
      direction: "left-to-right" | "top-to-bottom";
      frameCount: number;
    };

export interface AnimationGeneratorInput {
  grid: [string, GridCell][];
  fallbackColor: string;
}

export interface GeneratedAnimation {
  frames: AnimationFrame[];
}
