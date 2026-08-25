import {
  alignCharDeskCanvasCoordinate,
  DEFAULT_CHARDESK_CANVAS_METRICS,
  getCharDeskCanvasCellAnchor,
  getCharDeskCanvasFont,
  loadCharDeskCanvasFonts,
  prepareCharDeskCanvasSurface,
  type CharDeskCanvasFontSample,
  type CharDeskCanvasMetrics,
} from "@chardesk/rendering/canvas";
import { getCellOccupancy } from "./cellOccupancy";
import type { RenderFontRoute } from "./fontRouting";

export type GridRenderMetrics = CharDeskCanvasMetrics;

export const DEFAULT_GRID_RENDER_METRICS = DEFAULT_CHARDESK_CANVAS_METRICS;

export const getCanvasFont = (
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS,
  zoom = 1,
  options?: {
    bold?: boolean;
    italic?: boolean;
    route?: RenderFontRoute;
  }
) => getCharDeskCanvasFont(metrics, zoom, options);

export const getTextCellAnchor = (
  cellX: number,
  cellY: number,
  grapheme: string,
  zoom: number,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
) => getCharDeskCanvasCellAnchor(
  cellX,
  cellY,
  getCellOccupancy(grapheme),
  zoom,
  metrics
);

export const alignCanvasCoordinate = alignCharDeskCanvasCoordinate;

export const prepareCanvasSurface = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number
) => prepareCharDeskCanvasSurface(canvas, ctx, width, height, dpr);

type RenderFontSample = CharDeskCanvasFontSample;

export const loadRenderFonts = async (
  samplesToLoad: Iterable<RenderFontSample>
) => {
  await loadCharDeskCanvasFonts(samplesToLoad);
};
