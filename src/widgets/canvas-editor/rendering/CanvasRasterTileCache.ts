import {
  isIncrementalCanvasSurfaceReader,
  type CanvasSurfaceReader,
} from "@/domains/canvas/public";
import type { NodeBounds, Point } from "@/shared/types";
import {
  DEFAULT_GRID_RENDER_METRICS,
  prepareCanvasSurface,
} from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import { resolveCanvasContentLod } from "./canvasLod";
import { drawGridLayer } from "./drawGridLayer";

const DEFAULT_BYTE_BUDGET = 32 * 1024 * 1024;
const TARGET_TILE_DEVICE_PIXELS = 768;
const MIN_TILE_COLUMNS = 8;
const MIN_TILE_ROWS = 4;
const MAX_TILE_COLUMNS = 128;
const MAX_TILE_ROWS = 64;

type ViewBounds = ReturnType<typeof GridManager.getViewportGridBounds>;

type RasterTile = {
  canvas: HTMLCanvasElement;
  bounds: NodeBounds;
  bytes: number;
  reader: CanvasSurfaceReader;
};

type ReaderState = { id: number; revision: number | null };

export type CanvasRasterTileStats = {
  bytes: number;
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const floorDiv = (value: number, divisor: number) => Math.floor(value / divisor);

const intersects = (left: NodeBounds, right: NodeBounds) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

export const getCanvasRasterZoomBucket = (zoom: number) =>
  Math.max(0.125, Math.round(zoom * 64) / 64);

export const getCanvasRasterTileShape = (zoom: number, dpr: number) => {
  const rasterZoom = getCanvasRasterZoomBucket(zoom);
  const rasterDpr = Math.min(2, Math.max(1, dpr));
  return {
    columns: clamp(
      Math.floor(
        TARGET_TILE_DEVICE_PIXELS /
          (DEFAULT_GRID_RENDER_METRICS.cellWidth * rasterZoom * rasterDpr)
      ),
      MIN_TILE_COLUMNS,
      MAX_TILE_COLUMNS
    ),
    rows: clamp(
      Math.floor(
        TARGET_TILE_DEVICE_PIXELS /
          (DEFAULT_GRID_RENDER_METRICS.cellHeight * rasterZoom * rasterDpr)
      ),
      MIN_TILE_ROWS,
      MAX_TILE_ROWS
    ),
    rasterZoom,
    rasterDpr,
  };
};

export class CanvasRasterTileCache {
  readonly #byteBudget: number;
  readonly #tiles = new Map<string, RasterTile>();
  readonly #readerStates = new WeakMap<CanvasSurfaceReader, ReaderState>();
  #nextReaderId = 1;
  #bytes = 0;
  #hits = 0;
  #misses = 0;
  #evictions = 0;

  constructor(byteBudget = DEFAULT_BYTE_BUDGET) {
    this.#byteBudget = byteBudget;
  }

  clear() {
    this.#clearTiles();
  }

  getStats(): CanvasRasterTileStats {
    return {
      bytes: this.#bytes,
      entries: this.#tiles.size,
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
    };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    reader: CanvasSurfaceReader,
    viewBounds: ViewBounds,
    zoom: number,
    offset: Point,
    dpr: number
  ) {
    if (typeof document === "undefined") return false;
    const readerState = this.#syncReader(reader);
    const shape = getCanvasRasterTileShape(zoom, dpr);
    const lod = resolveCanvasContentLod(zoom);
    const minTileX = floorDiv(viewBounds.startX, shape.columns);
    const maxTileX = floorDiv(viewBounds.endX, shape.columns);
    const minTileY = floorDiv(viewBounds.startY, shape.rows);
    const maxTileY = floorDiv(viewBounds.endY, shape.rows);

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const key = [
          readerState.id,
          shape.rasterZoom,
          shape.rasterDpr,
          lod,
          shape.columns,
          shape.rows,
          tileX,
          tileY,
        ].join(":");
        const bounds = {
          x: tileX * shape.columns,
          y: tileY * shape.rows,
          width: shape.columns,
          height: shape.rows,
        };
        const tile = this.#getTile(key, reader, bounds, shape, lod);
        if (!tile) return false;
        const position = GridManager.gridToScreen(
          bounds.x,
          bounds.y,
          offset.x,
          offset.y,
          zoom
        );
        ctx.drawImage(
          tile.canvas,
          DEFAULT_GRID_RENDER_METRICS.cellWidth * shape.rasterZoom * shape.rasterDpr,
          0,
          bounds.width *
            DEFAULT_GRID_RENDER_METRICS.cellWidth *
            shape.rasterZoom *
            shape.rasterDpr,
          tile.canvas.height,
          position.x,
          position.y,
          bounds.width * DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom,
          bounds.height * DEFAULT_GRID_RENDER_METRICS.cellHeight * zoom
        );
      }
    }
    return true;
  }

  #syncReader(reader: CanvasSurfaceReader) {
    let state = this.#readerStates.get(reader);
    if (!state) {
      state = {
        id: this.#nextReaderId++,
        revision: isIncrementalCanvasSurfaceReader(reader)
          ? reader.getRevision()
          : null,
      };
      this.#readerStates.set(reader, state);
      return state;
    }
    if (!isIncrementalCanvasSurfaceReader(reader)) return state;
    const revision = reader.getRevision();
    if (state.revision === revision) return state;
    const changes = state.revision === null
      ? { revision, full: true as const }
      : reader.getChangesSince(state.revision);
    if (changes.full) {
      this.#clearReaderTiles(reader);
    } else {
      for (const [key, tile] of this.#tiles) {
        if (
          tile.reader === reader &&
          changes.bounds.some((bounds) => intersects(bounds, tile.bounds))
        ) {
          this.#deleteTile(key);
        }
      }
    }
    state.revision = revision;
    return state;
  }

  #getTile(
    key: string,
    reader: CanvasSurfaceReader,
    bounds: NodeBounds,
    shape: ReturnType<typeof getCanvasRasterTileShape>,
    lod: ReturnType<typeof resolveCanvasContentLod>
  ) {
    const cached = this.#tiles.get(key);
    if (cached) {
      this.#hits += 1;
      this.#tiles.delete(key);
      this.#tiles.set(key, cached);
      return cached;
    }
    this.#misses += 1;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const renderBounds = {
      x: bounds.x - 1,
      y: bounds.y,
      width: bounds.width + 2,
      height: bounds.height,
    };
    const width = renderBounds.width *
      DEFAULT_GRID_RENDER_METRICS.cellWidth *
      shape.rasterZoom;
    const height = bounds.height * DEFAULT_GRID_RENDER_METRICS.cellHeight * shape.rasterZoom;
    prepareCanvasSurface(canvas, ctx, width, height, shape.rasterDpr);
    drawGridLayer(
      ctx,
      reader,
      {
        startX: renderBounds.x,
        endX: renderBounds.x + renderBounds.width - 1,
        startY: renderBounds.y,
        endY: renderBounds.y + renderBounds.height - 1,
      },
      shape.rasterZoom,
      {
        x: -renderBounds.x *
          DEFAULT_GRID_RENDER_METRICS.cellWidth *
          shape.rasterZoom,
        y: -bounds.y * DEFAULT_GRID_RENDER_METRICS.cellHeight * shape.rasterZoom,
      },
      { lod }
    );
    const tile = {
      canvas,
      bounds,
      bytes: canvas.width * canvas.height * 4,
      reader,
    };
    this.#tiles.set(key, tile);
    this.#bytes += tile.bytes;
    this.#evictToBudget();
    return tile;
  }

  #deleteTile(key: string) {
    const tile = this.#tiles.get(key);
    if (!tile) return;
    this.#tiles.delete(key);
    this.#bytes -= tile.bytes;
    tile.canvas.width = 0;
    tile.canvas.height = 0;
  }

  #clearTiles() {
    for (const key of [...this.#tiles.keys()]) this.#deleteTile(key);
  }

  #clearReaderTiles(reader: CanvasSurfaceReader) {
    for (const [key, tile] of this.#tiles) {
      if (tile.reader === reader) this.#deleteTile(key);
    }
  }

  #evictToBudget() {
    while (this.#bytes > this.#byteBudget && this.#tiles.size > 1) {
      this.#deleteTile(this.#tiles.keys().next().value!);
      this.#evictions += 1;
    }
  }
}
