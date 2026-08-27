import type { Slide, SlideSize } from "@/domains/slides/public";
import {
  BACKGROUND_COLOR,
  CELL_HEIGHT,
  CELL_WIDTH,
  COLOR_PRIMARY_TEXT,
} from "@/shared/lib/constants";
import {
  drawCellBackground,
  drawCellText,
  prepareCanvasSurface,
} from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import { effectiveCellStyle } from "@/shared/utils/ansi";
import {
  resolveSlidePlaybackLayout,
  type SlidePlaybackLayout,
} from "./slide-playback-model";

type DrawSlideCanvasOptions = {
  canvas: HTMLCanvasElement;
  slide: Slide;
  size: SlideSize;
  viewportWidth: number;
  viewportHeight: number;
  padding?: number;
  backdropColor?: string | null;
  pageColor?: string | null;
  defaultTextColor?: string;
  dpr?: number;
};

export const drawSlideCanvas = ({
  canvas,
  slide,
  size,
  viewportWidth,
  viewportHeight,
  padding,
  backdropColor,
  pageColor = BACKGROUND_COLOR,
  defaultTextColor,
  dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
}: DrawSlideCanvasOptions): SlidePlaybackLayout | null => {
  if (viewportWidth <= 0 || viewportHeight <= 0) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  prepareCanvasSurface(canvas, ctx, viewportWidth, viewportHeight, dpr);
  const resolvedBackdropColor = backdropColor === undefined
    ? pageColor
    : backdropColor;
  if (resolvedBackdropColor !== null) {
    ctx.fillStyle = resolvedBackdropColor;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  }

  const layout = resolveSlidePlaybackLayout({
    viewportWidth,
    viewportHeight,
    columns: size.columns,
    rows: size.rows,
    padding,
  });
  if (pageColor !== null) {
    ctx.fillStyle = pageColor;
    ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.x, layout.y, layout.width, layout.height);
  ctx.clip();

  const cells = slide.grid
    .map(([key, cell]) => ({ ...GridManager.fromKey(key), cell }))
    .filter(
      ({ x, y }) =>
        x >= 0 && x < size.columns && y >= 0 && y < size.rows
    );

  for (const { x, y, cell } of cells) {
    drawCellBackground(
      ctx,
      cell,
      layout.x + x * CELL_WIDTH * layout.zoom,
      layout.y + y * CELL_HEIGHT * layout.zoom,
      { zoom: layout.zoom }
    );
  }
  for (const { x, y, cell } of cells) {
    if (cell.char === " " && !cell.attrs) continue;
    const style = effectiveCellStyle(cell);
    const color =
      defaultTextColor &&
      (!style.bgColor || style.bgColor === "transparent") &&
      style.color.toLowerCase() === COLOR_PRIMARY_TEXT
        ? defaultTextColor
        : undefined;
    drawCellText(
      ctx,
      cell,
      layout.x + x * CELL_WIDTH * layout.zoom,
      layout.y + y * CELL_HEIGHT * layout.zoom,
      { color, zoom: layout.zoom }
    );
  }

  ctx.restore();
  return layout;
};
