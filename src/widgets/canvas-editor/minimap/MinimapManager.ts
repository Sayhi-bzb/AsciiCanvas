import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import {
  clampMinimapCameraCenter,
  computeMinimapTransform,
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
  private cachedGrid: MinimapRenderState["grid"] | null = null;
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
      this.cachedGrid = null;
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
      this.cachedGrid === state.grid &&
      this.cachedForeground === this.colors.foreground
    ) {
      return;
    }
    this.cachedGrid = state.grid;
    this.cachedForeground = this.colors.foreground;
    this.colorPaths = new Map();
    const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;

    GridManager.iterate(state.grid, (cell, x, y) => {
      const hasBackground =
        !!cell.bgColor && cell.bgColor !== "transparent";
      if (!hasBackground && (!cell.char || cell.char === " ")) return;
      const color = hasBackground
        ? cell.bgColor!
        : cell.color || this.colors.foreground;
      let path = this.colorPaths.get(color);
      if (!path) {
        path = new Path2D();
        this.colorPaths.set(color, path);
      }
      const occupancy = Math.max(GridManager.getCharWidth(cell.char), 1);
      path.rect(
        x * cellWidth,
        y * cellHeight,
        Math.max(occupancy * cellWidth * 0.9, 1),
        Math.max(cellHeight * 0.9, 1)
      );
    });
  };

  render = () => {
    const state = this.renderState;
    if (!state) return;
    const transform = computeMinimapTransform({
      ...state,
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

    this.rebuildPaths(state);
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
