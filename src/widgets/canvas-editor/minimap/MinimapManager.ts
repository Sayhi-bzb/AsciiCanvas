import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import {
  clampMinimapCameraCenter,
  computeMinimapTransformFromBounds,
  computeMinimapViewportRect,
  lockMinimapPointToAxis,
  minimapPointToWorld,
} from "./geometry";
import type {
  MinimapDimensions,
  MinimapRect,
  MinimapRenderState,
  MinimapTransform,
} from "./types";
import type { Point } from "@/shared/types";

type MinimapColors = {
  background: string;
  foreground: string;
  viewportFill: string;
  viewportStroke: string;
};

const readCssColor = (name: string) =>
  getComputedStyle(document.body).getPropertyValue(name).trim();

export class MinimapManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly dimensions: MinimapDimensions;
  private readonly padding: number;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver | null;
  private renderState: MinimapRenderState | null = null;
  private transform: MinimapTransform | null = null;
  private viewportRect: MinimapRect | null = null;
  private cachedContentRevision: unknown;
  private hasCachedContent = false;
  private cachedContentBounds: MinimapRect | null = null;
  private cancelScheduledContentRebuild: (() => void) | null = null;
  private cachedForeground = "";
  private colorPaths = new Map<string, Path2D>();
  private colors: MinimapColors;

  constructor(
    canvas: HTMLCanvasElement,
    host: HTMLElement,
    dimensions: MinimapDimensions,
    padding: number
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Minimap: could not get 2D canvas context");
    this.canvas = canvas;
    this.dimensions = dimensions;
    this.padding = padding;
    this.ctx = ctx;
    this.colors = this.readColors();
    this.observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => this.render());
    this.observer?.observe(canvas);
    this.observer?.observe(host);
  }

  close = () => {
    this.observer?.disconnect();
    this.renderState = null;
    this.transform = null;
    this.viewportRect = null;
    this.cancelScheduledContentRebuild?.();
    this.cancelScheduledContentRebuild = null;
    this.colorPaths.clear();
  };

  update = (state: MinimapRenderState) => {
    this.renderState = state;
    this.render();
  };

  updateColors = () => {
    const previousForeground = this.colors.foreground;
    this.colors = this.readColors();
    if (previousForeground !== this.colors.foreground) {
      this.hasCachedContent = false;
    }
    this.render();
  };

  getTransform = () => this.transform;

  getViewportRect = () => this.viewportRect;

  hasContent = () => !!this.transform?.contentBounds;

  getWorldPoint = (
    clientX: number,
    clientY: number,
    options: {
      clampToWorld?: boolean;
      clampToContent?: boolean;
      axisOrigin?: Point;
    } = {}
  ): Point | null => {
    const transform = this.transform;
    if (!transform) return null;
    const rect = this.canvas.getBoundingClientRect();
    let point = minimapPointToWorld(
      { x: clientX - rect.left, y: clientY - rect.top },
      transform,
      options.clampToWorld
    );
    if (options.clampToContent) {
      point = clampMinimapCameraCenter(
        point,
        transform.contentBounds,
        transform.viewportBounds
      );
    }
    if (options.axisOrigin) {
      point = lockMinimapPointToAxis(point, options.axisOrigin);
    }
    return point;
  };

  private readColors = (): MinimapColors => ({
    background: readCssColor("--background") || "transparent",
    foreground: readCssColor("--foreground") || "currentColor",
    viewportFill: readCssColor("--muted-foreground") || "#737373",
    viewportStroke:
      readCssColor("--primary") ||
      readCssColor("--muted-foreground") ||
      "#737373",
  });

  private rebuildPaths = (state: MinimapRenderState) => {
    if (
      this.hasCachedContent &&
      this.cachedContentRevision === state.contentRevision &&
      this.cachedForeground === this.colors.foreground
    ) {
      return;
    }
    this.hasCachedContent = true;
    this.cachedContentRevision = state.contentRevision;
    this.cachedForeground = this.colors.foreground;
    this.cachedContentBounds = null;
    this.colorPaths = new Map();
    const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
    const bounds = state.reader.getContentBounds();
    if (!bounds) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const row of state.reader.rows(bounds)) {
      for (const span of row.spans) {
        let x = span.x;
        for (const cell of span.cells) {
          const occupancy = Math.max(GridManager.getCharWidth(cell.char), 1);
          const hasBackground = !!cell.bgColor && cell.bgColor !== "transparent";
          if (hasBackground || (cell.char && cell.char !== " ")) {
            const color = hasBackground
              ? cell.bgColor!
              : cell.color || this.colors.foreground;
            let path = this.colorPaths.get(color);
            if (!path) {
              path = new Path2D();
              this.colorPaths.set(color, path);
            }
            path.rect(
              x * cellWidth,
              row.y * cellHeight,
              Math.max(occupancy * cellWidth * 0.9, 1),
              Math.max(cellHeight * 0.9, 1)
            );
            minX = Math.min(minX, x * cellWidth);
            minY = Math.min(minY, row.y * cellHeight);
            maxX = Math.max(maxX, (x + occupancy) * cellWidth);
            maxY = Math.max(maxY, (row.y + 1) * cellHeight);
          }
          x += occupancy;
        }
      }
    }
    this.cachedContentBounds = Number.isFinite(minX)
      ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      : null;
  };

  private scheduleContentRebuild = () => {
    if (this.cancelScheduledContentRebuild) return;
    const rebuild = () => {
      this.cancelScheduledContentRebuild = null;
      const state = this.renderState;
      if (!state) return;
      this.hasCachedContent = false;
      this.rebuildPaths(state);
      this.render();
    };
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    const frameHandle = window.requestAnimationFrame(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(rebuild, { timeout: 250 });
      } else {
        timeoutHandle = window.setTimeout(rebuild, 50);
      }
    });
    this.cancelScheduledContentRebuild = () => {
      window.cancelAnimationFrame(frameHandle);
      if (idleHandle !== null) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
    };
  };

  render = () => {
    const state = this.renderState;
    if (!state) return;
    const contentChanged =
      this.hasCachedContent &&
      this.cachedContentRevision !== state.contentRevision;
    if (contentChanged) this.scheduleContentRebuild();
    else this.rebuildPaths(state);
    const transform = computeMinimapTransformFromBounds({
      ...state,
      contentBounds: this.cachedContentBounds,
      dimensions: this.dimensions,
      padding: this.padding,
    });
    this.transform = transform;
    this.viewportRect = transform
      ? computeMinimapViewportRect(transform)
      : null;

    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.round(this.dimensions.width * dpr);
    const height = Math.round(this.dimensions.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.canvas.style.width = `${this.dimensions.width}px`;
    this.canvas.style.height = `${this.dimensions.height}px`;

    const { ctx } = this;
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, width, height);
    if (!transform) return;

    const { scale, drawableRect, worldBounds } = transform;
    ctx.setTransform(
      dpr * scale,
      0,
      0,
      dpr * scale,
      dpr * (drawableRect.x - worldBounds.x * scale),
      dpr * (drawableRect.y - worldBounds.y * scale)
    );

    for (const [color, path] of this.colorPaths) {
      ctx.fillStyle = color;
      ctx.fill(path);
    }

    const viewport = transform.viewportBounds;
    const radius = Math.min(
      viewport.width / 4,
      viewport.height / 4,
      4 / scale
    );
    ctx.beginPath();
    if (radius * scale < 1) {
      ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    } else {
      ctx.roundRect(
        viewport.x,
        viewport.y,
        viewport.width,
        viewport.height,
        radius
      );
    }
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = this.colors.viewportFill;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = this.colors.viewportStroke;
    ctx.stroke();
  };
}
