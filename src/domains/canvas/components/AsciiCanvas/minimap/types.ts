import type { Point } from "@/shared/types";

export type MinimapMeta = {
  valid: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  contentWidth: number;
  contentHeight: number;
  scale: number;
};

export type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MinimapPoint = Point;
