import type { Point } from "@/shared/types";
import type { CanvasSurfaceReader } from "@/domains/canvas/public";

export type MinimapDimensions = {
  width: number;
  height: number;
};

export type MinimapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MinimapTransform = {
  dimensions: MinimapDimensions;
  contentBounds: MinimapRect | null;
  viewportBounds: MinimapRect;
  worldBounds: MinimapRect;
  drawableRect: MinimapRect;
  scale: number;
};

export type MinimapRenderState = {
  reader: CanvasSurfaceReader;
  contentRevision: unknown;
  offset: Point;
  zoom: number;
  viewportSize: MinimapDimensions;
};
