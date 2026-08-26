import { CHARDESK_FONT_PROFILE } from "@chardesk/fonts";
import type { CharDeskTextAttributes } from "@chardesk/protocol";
import type {
  CharDeskCellVisual,
  CharDeskRenderFontRoute,
  CharDeskRenderModel,
} from "./index.js";
import { resolveCharDeskFontRoute } from "./index.js";

export type CharDeskCanvasMetrics = {
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
  fontFamily: string;
};

export type CharDeskCanvasPalette = {
  color: string;
  background: string;
};

export type CharDeskCanvasFontAvailability = Record<
  CharDeskRenderFontRoute,
  boolean
>;

export type CharDeskCanvasFontFamilies = Record<
  CharDeskRenderFontRoute,
  { regular: string; bold?: string }
>;

export type CharDeskCanvasCellDrawOptions = {
  color?: string;
  underline?: boolean;
  zoom?: number;
  metrics?: CharDeskCanvasMetrics;
  palette?: CharDeskCanvasPalette;
  fontAvailability?: CharDeskCanvasFontAvailability;
  fontFamilies?: CharDeskCanvasFontFamilies;
};

export type CharDeskCanvasCellDrawEntry = {
  cell: CharDeskCellVisual;
  x: number;
  y: number;
  options?: CharDeskCanvasCellDrawOptions;
  drawBackground?: boolean;
  drawText?: boolean;
};

export type CharDeskCanvasCellVisual = CharDeskCellVisual & {
  color: string;
};

export type CharDeskCanvasDocumentOptions = {
  metrics?: CharDeskCanvasMetrics;
  palette: CharDeskCanvasPalette;
  padding?: number;
  zoom?: number;
  fontAvailability?: CharDeskCanvasFontAvailability;
  fontFamilies?: CharDeskCanvasFontFamilies;
};

export type CharDeskCanvasDocumentLayout = {
  width: number;
  height: number;
  padding: number;
  metrics: CharDeskCanvasMetrics;
};

export type CharDeskCanvasFontSample =
  | string
  | { grapheme: string; bold?: boolean; italic?: boolean };

export const DEFAULT_CHARDESK_CANVAS_METRICS: CharDeskCanvasMetrics = {
  cellWidth: 9,
  cellHeight: 19,
  fontSize: 15,
  fontFamily: CHARDESK_FONT_PROFILE.families.text,
};

export const DEFAULT_CHARDESK_CANVAS_FONT_AVAILABILITY: CharDeskCanvasFontAvailability = {
  text: true,
  emoji: true,
};

const DEFAULT_PALETTE: CharDeskCanvasPalette = {
  color: "#000000",
  background: "#ffffff",
};

export const getCharDeskCanvasFont = (
  metrics: CharDeskCanvasMetrics = DEFAULT_CHARDESK_CANVAS_METRICS,
  zoom = 1,
  options?: {
    bold?: boolean;
    italic?: boolean;
    route?: CharDeskRenderFontRoute;
    fontFamily?: string;
  }
) => {
  const route = options?.route ?? "text";
  const fontFamily = options?.fontFamily ?? (route === "emoji"
    ? CHARDESK_FONT_PROFILE.families.emoji
    : metrics.fontFamily);
  return `${options?.italic ? "italic " : ""}${options?.bold ? "700 " : ""}${
    metrics.fontSize * zoom
  }px ${fontFamily}`;
};

export const alignCharDeskCanvasCoordinate = (
  value: number,
  lineWidth = 1
) => {
  const rounded = Math.round(value);
  return lineWidth % 2 === 1 ? rounded + 0.5 : rounded;
};

export const getCharDeskCanvasCellAnchor = (
  x: number,
  y: number,
  width: 1 | 2,
  zoom = 1,
  metrics: CharDeskCanvasMetrics = DEFAULT_CHARDESK_CANVAS_METRICS
) => ({
  x: x + metrics.cellWidth * zoom * width / 2,
  y: y + metrics.cellHeight * zoom / 2,
});

export const prepareCharDeskCanvasSurface = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number
) => {
  const targetWidth = Math.round(width * dpr);
  const targetHeight = Math.round(height * dpr);
  if (canvas.style) {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, targetWidth, targetHeight);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

export const resolveCharDeskCanvasCellVisual = (
  cell: CharDeskCellVisual,
  palette: CharDeskCanvasPalette = DEFAULT_PALETTE
): CharDeskCanvasCellVisual => {
  const color = cell.color ?? palette.color;
  if (!cell.attrs?.inverse) {
    return { ...cell, color };
  }
  return {
    ...cell,
    color: cell.bgColor ?? palette.background,
    bgColor: color,
  };
};

const drawDecoration = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
  lineWidth: number
) => {
  const lineY = alignCharDeskCanvasCoordinate(y, lineWidth);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.moveTo(x, lineY);
  ctx.lineTo(x + width, lineY);
  ctx.stroke();
};

const drawCellBackground = (
  ctx: CanvasRenderingContext2D,
  entry: CharDeskCanvasCellDrawEntry
) => {
  const options = entry.options;
  const metrics = options?.metrics ?? DEFAULT_CHARDESK_CANVAS_METRICS;
  const zoom = options?.zoom ?? 1;
  const palette = options?.palette ?? DEFAULT_PALETTE;
  const visual = resolveCharDeskCanvasCellVisual(entry.cell, palette);
  if (!visual.bgColor) return;
  ctx.fillStyle = visual.bgColor;
  ctx.fillRect(
    entry.x,
    entry.y,
    metrics.cellWidth * zoom * entry.cell.width,
    metrics.cellHeight * zoom
  );
};

const drawCellText = (
  ctx: CanvasRenderingContext2D,
  entry: CharDeskCanvasCellDrawEntry
) => {
  const options = entry.options;
  const metrics = options?.metrics ?? DEFAULT_CHARDESK_CANVAS_METRICS;
  const zoom = options?.zoom ?? 1;
  const palette = options?.palette ?? DEFAULT_PALETTE;
  const availability = options?.fontAvailability ??
    DEFAULT_CHARDESK_CANVAS_FONT_AVAILABILITY;
  const visual = resolveCharDeskCanvasCellVisual(entry.cell, palette);
  const color = visual.color;
  const attrs: CharDeskTextAttributes | undefined = visual.attrs;
  const route = visual.fontRoute;
  const routeFamilies = options?.fontFamilies?.[route];
  const fontFamily = attrs?.bold
    ? routeFamilies?.bold ?? routeFamilies?.regular
    : routeFamilies?.regular;
  const text = route === "emoji" && !availability.emoji ? "□" : visual.text;
  const anchor = getCharDeskCanvasCellAnchor(
    entry.x,
    entry.y,
    visual.width,
    zoom,
    metrics
  );

  ctx.font = getCharDeskCanvasFont(metrics, zoom, {
    bold: !!attrs?.bold,
    italic: !!attrs?.italic,
    route,
    fontFamily,
  });
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = options?.color ?? color;
  ctx.fillText(text, Math.round(anchor.x), Math.round(anchor.y));

  const cellWidth = metrics.cellWidth * zoom * visual.width;
  const cellHeight = metrics.cellHeight * zoom;
  const lineWidth = Math.max(1, Math.round(zoom));
  const decorationColor = options?.color ?? color;
  if (attrs?.underline || options?.underline) {
    drawDecoration(
      ctx,
      entry.x,
      entry.y + cellHeight * 0.82,
      cellWidth,
      decorationColor,
      lineWidth
    );
  }
  if (attrs?.strike) {
    drawDecoration(
      ctx,
      entry.x,
      entry.y + cellHeight * 0.54,
      cellWidth,
      decorationColor,
      lineWidth
    );
  }
};

export const drawCharDeskCanvasCells = (
  ctx: CanvasRenderingContext2D,
  entries: readonly CharDeskCanvasCellDrawEntry[]
) => {
  ctx.save();
  for (const entry of entries) {
    if (entry.drawBackground !== false) drawCellBackground(ctx, entry);
  }
  for (const entry of entries) {
    if (entry.drawText !== false) drawCellText(ctx, entry);
  }
  ctx.restore();
};

export const measureCharDeskCanvasDocument = (
  model: CharDeskRenderModel,
  options: Pick<CharDeskCanvasDocumentOptions, "metrics" | "padding" | "zoom"> = {}
): CharDeskCanvasDocumentLayout => {
  const metrics = options.metrics ?? DEFAULT_CHARDESK_CANVAS_METRICS;
  const zoom = options.zoom ?? 1;
  const padding = (options.padding ?? 16) * zoom;
  return {
    width: model.document.width * metrics.cellWidth * zoom + padding * 2,
    height: model.document.height * metrics.cellHeight * zoom + padding * 2,
    padding,
    metrics,
  };
};

export const drawCharDeskCanvasDocument = (
  ctx: CanvasRenderingContext2D,
  model: CharDeskRenderModel,
  options: CharDeskCanvasDocumentOptions
) => {
  const layout = measureCharDeskCanvasDocument(model, options);
  const zoom = options.zoom ?? 1;
  const entries = model.cells.map((cell) => ({
    cell,
    x: layout.padding + cell.x * layout.metrics.cellWidth * zoom,
    y: layout.padding + cell.y * layout.metrics.cellHeight * zoom,
    options: {
      metrics: layout.metrics,
      zoom,
      palette: options.palette,
      ...(options.fontAvailability
        ? { fontAvailability: options.fontAvailability }
        : {}),
      ...(options.fontFamilies ? { fontFamilies: options.fontFamilies } : {}),
    },
  }));
  drawCharDeskCanvasCells(ctx, entries);
  return layout;
};

export const loadCharDeskCanvasFonts = async (
  samplesToLoad: Iterable<CharDeskCanvasFontSample>
): Promise<CharDeskCanvasFontAvailability> => {
  if (typeof document === "undefined" || !document.fonts) {
    return { text: false, emoji: false };
  }

  const groups = new Map<string, {
    route: CharDeskRenderFontRoute;
    bold: boolean;
    italic: boolean;
    graphemes: Set<string>;
  }>();
  for (const sample of samplesToLoad) {
    const grapheme = typeof sample === "string" ? sample : sample.grapheme;
    if (!grapheme) continue;
    const route = resolveCharDeskFontRoute(grapheme);
    const bold = typeof sample === "string" ? false : !!sample.bold;
    const italic = typeof sample === "string" ? false : !!sample.italic;
    const key = `${route}:${bold ? 1 : 0}:${italic ? 1 : 0}`;
    const group = groups.get(key) ?? {
      route,
      bold,
      italic,
      graphemes: new Set<string>(),
    };
    group.graphemes.add(grapheme);
    groups.set(key, group);
  }

  const availability: CharDeskCanvasFontAvailability = {
    text: !Array.from(groups.values()).some(({ route }) => route === "text"),
    emoji: !Array.from(groups.values()).some(({ route }) => route === "emoji"),
  };
  await Promise.all(Array.from(groups.values(), async (group) => {
    try {
      const faces = await document.fonts.load(
        getCharDeskCanvasFont(DEFAULT_CHARDESK_CANVAS_METRICS, 1, group),
        Array.from(group.graphemes).join("")
      );
      availability[group.route] ||= faces.length > 0;
    } catch {
      availability[group.route] ||= false;
    }
  }));
  try {
    await document.fonts.ready;
  } catch {
    // Per-route availability already records font loading failures.
  }
  return availability;
};
