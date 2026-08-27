import {
  alignCharDeskCanvasCoordinate,
  DEFAULT_CHARDESK_CANVAS_METRICS,
  getCharDeskCanvasFont,
  loadCharDeskCanvasFonts,
  prepareCharDeskCanvasSurface,
  type CharDeskCanvasFontSample,
  type CharDeskCanvasContext,
  type CharDeskCanvasMetrics,
  type CharDeskCanvasSurface,
} from "@chardesk/rendering/canvas";
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

export const alignCanvasCoordinate = alignCharDeskCanvasCoordinate;

export const prepareCanvasSurface = (
  canvas: CharDeskCanvasSurface,
  ctx: CharDeskCanvasContext,
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
