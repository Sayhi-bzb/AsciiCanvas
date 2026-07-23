import {
  CELL_HEIGHT,
  CELL_WIDTH,
  FONT_SIZE,
} from "@/shared/lib/constants";
import { getCellOccupancy } from "./cellOccupancy";
import {
  getRenderFontFamily,
  type RenderFontRoute,
  resolveRenderFontRoute,
} from "./fontRouting";

const RENDER_FONT_FAMILY = getRenderFontFamily("text");

export type GridRenderMetrics = {
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
  fontFamily: string;
};

export const DEFAULT_GRID_RENDER_METRICS: GridRenderMetrics = {
  cellWidth: CELL_WIDTH,
  cellHeight: CELL_HEIGHT,
  fontSize: FONT_SIZE,
  fontFamily: RENDER_FONT_FAMILY,
};

export const getCanvasFont = (
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS,
  zoom = 1,
  options?: {
    bold?: boolean;
    italic?: boolean;
    route?: RenderFontRoute;
  }
) => {
  const fontFamily =
    options?.route === "emoji"
      ? getRenderFontFamily("emoji")
      : metrics.fontFamily;
  return `${options?.italic ? "italic " : ""}${options?.bold ? "700 " : ""}${
    metrics.fontSize * zoom
  }px ${fontFamily}`;
};

export const getCellPixelSize = (
  zoom: number,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
) => ({
  width: metrics.cellWidth * zoom,
  height: metrics.cellHeight * zoom,
});

export const getTextCellAnchor = (
  cellX: number,
  cellY: number,
  grapheme: string,
  zoom: number,
  metrics: GridRenderMetrics = DEFAULT_GRID_RENDER_METRICS
) => {
  const { width, height } = getCellPixelSize(zoom, metrics);
  const occupancy = getCellOccupancy(grapheme);
  return {
    x: cellX + (occupancy > 1 ? width : width / 2),
    y: cellY + height / 2,
  };
};

export const alignCanvasCoordinate = (value: number, lineWidth = 1) => {
  const rounded = Math.round(value);
  return lineWidth % 2 === 1 ? rounded + 0.5 : rounded;
};

export const prepareCanvasSurface = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number
) => {
  const targetWidth = Math.floor(width * dpr);
  const targetHeight = Math.floor(height * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, targetWidth, targetHeight);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

export const loadRenderFonts = async (graphemes: Iterable<string>) => {
  if (typeof document === "undefined" || !document.fonts) return;

  try {
    const samples = new Map<RenderFontRoute, Set<string>>();
    for (const grapheme of graphemes) {
      if (!grapheme) continue;
      const route = resolveRenderFontRoute(grapheme);
      const routeSamples = samples.get(route) ?? new Set<string>();
      routeSamples.add(grapheme);
      samples.set(route, routeSamples);
    }
    await Promise.all(
      Array.from(samples, ([route, routeSamples]) =>
        document.fonts.load(
          getCanvasFont(DEFAULT_GRID_RENDER_METRICS, 1, { route }),
          Array.from(routeSamples).join("")
        )
      )
    );
    await document.fonts.ready;
  } catch {
    // System fallback remains valid when a self-hosted face cannot load.
  }
};
