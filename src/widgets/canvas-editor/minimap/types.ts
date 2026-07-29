import type { GridMap, Point } from "@/shared/types";

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
  grid: GridMap;
  offset: Point;
  zoom: number;
  viewportSize: MinimapDimensions;
};

export type MinimapCameraAdapter = {
  setOffset: (updater: (previous: Point) => Point) => void;
  setZoom: (updater: (previous: number) => number) => void;
};
