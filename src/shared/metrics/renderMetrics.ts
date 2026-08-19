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

const getCellPixelSize = (
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

export type RenderFontSample =
  | string
  | { grapheme: string; bold?: boolean; italic?: boolean };

export const loadRenderFonts = async (samplesToLoad: Iterable<RenderFontSample>) => {
  if (typeof document === "undefined" || !document.fonts) return;

  try {
    const samples = new Map<
      string,
      {
        route: RenderFontRoute;
        bold: boolean;
        italic: boolean;
        graphemes: Set<string>;
      }
    >();
    for (const sample of samplesToLoad) {
      const grapheme = typeof sample === "string" ? sample : sample.grapheme;
      if (!grapheme) continue;
      const route = resolveRenderFontRoute(grapheme);
      const bold = typeof sample === "string" ? false : !!sample.bold;
      const italic = typeof sample === "string" ? false : !!sample.italic;
      const key = `${route}:${bold ? 1 : 0}:${italic ? 1 : 0}`;
      const group = samples.get(key) ?? {
        route,
        bold,
        italic,
        graphemes: new Set<string>(),
      };
      group.graphemes.add(grapheme);
      samples.set(key, group);
    }
    await Promise.all(
      Array.from(samples.values(), ({ route, bold, italic, graphemes }) =>
        document.fonts.load(
          getCanvasFont(DEFAULT_GRID_RENDER_METRICS, 1, { route, bold, italic }),
          Array.from(graphemes).join("")
        )
      )
    );
    await document.fonts.ready;
  } catch {
    // System fallback remains valid when a self-hosted face cannot load.
  }
};
