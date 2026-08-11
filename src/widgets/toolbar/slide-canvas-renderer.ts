import type { Slide, SlideSize } from "@/domains/slides/public";
import { CELL_HEIGHT, CELL_WIDTH } from "@/shared/lib/constants";
import {
  drawCellBackground,
  drawCellText,
  prepareCanvasSurface,
} from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
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
  backdropColor?: string;
  dpr?: number;
};

export const drawSlideCanvas = ({
  canvas,
  slide,
  size,
  viewportWidth,
  viewportHeight,
  padding,
  backdropColor = "#111827",
  dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
}: DrawSlideCanvasOptions): SlidePlaybackLayout | null => {
  if (viewportWidth <= 0 || viewportHeight <= 0) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  prepareCanvasSurface(canvas, ctx, viewportWidth, viewportHeight, dpr);
  ctx.fillStyle = backdropColor;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const layout = resolveSlidePlaybackLayout({
    viewportWidth,
    viewportHeight,
    columns: size.columns,
    rows: size.rows,
    padding,
  });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
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
    drawCellText(
      ctx,
      cell,
      layout.x + x * CELL_WIDTH * layout.zoom,
      layout.y + y * CELL_HEIGHT * layout.zoom,
      { zoom: layout.zoom }
    );
  }

  ctx.restore();
  return layout;
};
