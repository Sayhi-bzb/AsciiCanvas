import type { GridCell, Point } from "@/shared/types";
import type { CanvasMode } from "./mode";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { AnimationCanvasSize, AnimationTimeline } from "@/domains/animation/public";

export interface CanvasViewport {
  offset: Point;
  zoom: number;
}

export interface CanvasSession {
  id: string;
  name: string;
  mode: CanvasMode;
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
  grid: [string, GridCell][];
  size?: AnimationCanvasSize;
  timeline?: AnimationTimeline;
  viewport?: CanvasViewport;
}

export type CanvasImportSnapshot = {
  mode: CanvasMode;
  scene: StructuredNode[];
  components: StructuredComponentInstance[];
  grid: [string, GridCell][];
  size?: AnimationCanvasSize;
  timeline?: AnimationTimeline;
};
