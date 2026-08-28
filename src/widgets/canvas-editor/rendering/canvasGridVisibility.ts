import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";

export const shouldDrawCanvasGrid = (zoom: number) =>
  DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom >= 4;
