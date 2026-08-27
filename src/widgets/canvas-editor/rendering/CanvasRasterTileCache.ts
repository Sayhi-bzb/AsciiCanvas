import {
  CellPlaneIndex,
  isIncrementalCanvasSurfaceReader,
  type CellPlaneRow,
  type CanvasSurfaceReader,
} from "@/domains/canvas/public";
import type { NodeBounds, Point } from "@/shared/types";
import {
  DEFAULT_GRID_RENDER_METRICS,
  prepareCanvasSurface,
} from "@/shared/metrics";
import { GridManager } from "@/shared/utils/grid";
import {
  resolveCanvasContentLod,
  type CanvasContentLod,
} from "./canvasLod";
import { drawGridLayer } from "./drawGridLayer";
import {
  CanvasRenderWorkerError,
  type CanvasRenderWorkerClient,
} from "./CanvasRenderWorkerClient";

const DEFAULT_BYTE_BUDGET = 32 * 1024 * 1024;
const TARGET_TILE_DEVICE_PIXELS = 768;
const MIN_TILE_COLUMNS = 8;
const MIN_TILE_ROWS = 4;
const MAX_TILE_COLUMNS = 128;
const MAX_TILE_ROWS = 64;

type ViewBounds = ReturnType<typeof GridManager.getViewportGridBounds>;

type RasterTile = {
  image: HTMLCanvasElement | ImageBitmap;
  bounds: NodeBounds;
  bytes: number;
  reader: CanvasSurfaceReader;
  stale: boolean;
};

type ReaderState = { id: number; revision: number | null };

type PendingTile = {
  reader: CanvasSurfaceReader;
  revision: number;
  bounds: NodeBounds;
  batch: PendingBatch | null;
  listeners: Set<() => void>;
};

type PendingBatch = {
  paneId: string;
  viewportEpoch: number;
  signature: string;
};

type TileRequest = {
  key: string;
  bounds: NodeBounds;
};

export type CanvasRasterTileStats = {
  bytes: number;
  entries: number;
  hits: number;
  misses: number;
  evictions: number;
  pending: number;
  asyncTiles: number;
  workerRasterTiles: number;
  mainRasterTiles: number;
  paneEpochChanges: number;
  workerBatchRequests: number;
  retainCount: number;
  releaseCount: number;
  staleEntries: number;
  staleRefreshes: number;
};

export type CanvasRasterDrawStatus = "complete" | "pending" | "fallback";

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
  readonly #pendingTiles = new Map<string, PendingTile>();
  readonly #readerStates = new WeakMap<CanvasSurfaceReader, ReaderState>();
  readonly #renderWorker: CanvasRenderWorkerClient | null;
  readonly #workerFallbackReaders = new WeakSet<CanvasSurfaceReader>();
  readonly #paneKeys = new Map<string, Set<string>>();
  readonly #paneEpochs = new Map<string, number>();
  readonly #paneSignatures = new Map<string, string>();
  readonly #paneBatches = new Map<string, PendingBatch>();
  #nextReaderId = 1;
  #bytes = 0;
  #hits = 0;
  #misses = 0;
  #evictions = 0;
  #asyncTiles = 0;
  #workerRasterTiles = 0;
  #mainRasterTiles = 0;
  #paneEpochChanges = 0;
  #workerBatchRequests = 0;
  #retainCount = 0;
  #releaseCount = 0;
  #staleRefreshes = 0;

  constructor(
    byteBudget = DEFAULT_BYTE_BUDGET,
    renderWorker: CanvasRenderWorkerClient | null = null
  ) {
    this.#byteBudget = byteBudget;
    this.#renderWorker = renderWorker;
  }

  clear() {
    this.#clearTiles();
  }

  retain(reader: CanvasSurfaceReader, paneId: string) {
    this.#retainCount += 1;
    const releaseWorker = reader instanceof CellPlaneIndex && this.#renderWorker
      ? this.#renderWorker.retain(reader)
      : () => {};
    return () => {
      this.#releaseCount += 1;
      releaseWorker();
      this.#paneKeys.delete(paneId);
      this.#paneEpochs.delete(paneId);
      this.#paneSignatures.delete(paneId);
      this.#paneBatches.delete(paneId);
      this.#evictToBudget();
    };
  }

  getStats(): CanvasRasterTileStats {
    return {
      bytes: this.#bytes,
      entries: this.#tiles.size,
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
      pending: this.#pendingTiles.size,
      asyncTiles: this.#asyncTiles,
      workerRasterTiles: this.#workerRasterTiles,
      mainRasterTiles: this.#mainRasterTiles,
      paneEpochChanges: this.#paneEpochChanges,
      workerBatchRequests: this.#workerBatchRequests,
      retainCount: this.#retainCount,
      releaseCount: this.#releaseCount,
      staleEntries: [...this.#tiles.values()].filter(({ stale }) => stale).length,
      staleRefreshes: this.#staleRefreshes,
    };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    reader: CanvasSurfaceReader,
    viewBounds: ViewBounds,
    zoom: number,
    offset: Point,
    dpr: number,
    paneId: string,
    onTileReady?: () => void
  ): CanvasRasterDrawStatus {
    if (typeof document === "undefined") return "fallback";
    const readerState = this.#syncReader(reader);
    const shape = getCanvasRasterTileShape(zoom, dpr);
    const lod = resolveCanvasContentLod(zoom);
    const minTileX = floorDiv(viewBounds.startX, shape.columns);
    const maxTileX = floorDiv(viewBounds.endX, shape.columns);
    const minTileY = floorDiv(viewBounds.startY, shape.rows);
    const maxTileY = floorDiv(viewBounds.endY, shape.rows);

    const requests: TileRequest[] = [];
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
        requests.push({ key, bounds });
      }
    }
    const visibleKeys = new Set(requests.map(({ key }) => key));
    this.#paneKeys.set(paneId, visibleKeys);
    const signature = [
      readerState.id,
      readerState.revision ?? 0,
      shape.rasterZoom,
      shape.rasterDpr,
      lod,
      ...visibleKeys,
    ].join(":");
    let viewportEpoch = this.#paneEpochs.get(paneId) ?? 0;
    if (this.#paneSignatures.get(paneId) !== signature) {
      this.#paneEpochChanges += 1;
      viewportEpoch += 1;
      this.#paneEpochs.set(paneId, viewportEpoch);
      this.#paneSignatures.set(paneId, signature);
    }
    this.#evictToBudget();

    const missingRequests = requests.filter(({ key }) => {
      const tile = this.#tiles.get(key);
      return !tile || tile.stale;
    });
    this.#requestWorkerTiles(
      reader,
      readerState.revision ?? 0,
      paneId,
      viewportEpoch,
      missingRequests,
      shape,
      lod
    );

    const pendingKeys = new Set<string>();
    const refreshingKeys = new Set<string>();
    for (const { key, bounds } of requests) {
      const tile = this.#getTile(
        key,
        reader,
        readerState.revision ?? 0,
        bounds,
        shape,
        lod
      );
      if (!tile) {
        if (this.#pendingTiles.has(key)) {
          pendingKeys.add(key);
          continue;
        }
        return "fallback";
      }
      if (this.#pendingTiles.has(key)) refreshingKeys.add(key);
      const position = GridManager.gridToScreen(
        bounds.x,
        bounds.y,
        offset.x,
        offset.y,
        zoom
      );
      ctx.drawImage(
        tile.image,
        DEFAULT_GRID_RENDER_METRICS.cellWidth * shape.rasterZoom * shape.rasterDpr,
        0,
        bounds.width *
          DEFAULT_GRID_RENDER_METRICS.cellWidth *
          shape.rasterZoom *
          shape.rasterDpr,
        tile.image.height,
        position.x,
        position.y,
        bounds.width * DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom,
        bounds.height * DEFAULT_GRID_RENDER_METRICS.cellHeight * zoom
      );
    }
    const listenerKeys = new Set([...pendingKeys, ...refreshingKeys]);
    if (listenerKeys.size > 0 && onTileReady) {
      const complete = (key: string) => {
        listenerKeys.delete(key);
        if (listenerKeys.size === 0) onTileReady();
      };
      listenerKeys.forEach((key) => {
        this.#pendingTiles.get(key)?.listeners.add(() => complete(key));
      });
    }
    return pendingKeys.size > 0 ? "pending" : "complete";
  }

  #requestWorkerTiles(
    reader: CanvasSurfaceReader,
    revision: number,
    paneId: string,
    viewportEpoch: number,
    requests: readonly TileRequest[],
    shape: ReturnType<typeof getCanvasRasterTileShape>,
    lod: CanvasContentLod
  ) {
    if (
      requests.length === 0 ||
      !(reader instanceof CellPlaneIndex) ||
      !this.#renderWorker ||
      this.#workerFallbackReaders.has(reader)
    ) return;
    const ownedRequests = requests.filter(({ key }) => {
      const pending = this.#pendingTiles.get(key);
      return !pending || pending.batch?.paneId === paneId;
    });
    if (ownedRequests.length === 0) return;
    const signature = [
      revision,
      shape.rasterZoom,
      shape.rasterDpr,
      lod,
      ...ownedRequests.map(({ key }) => key),
    ].join(":");
    if (this.#paneBatches.get(paneId)?.signature === signature) return;
    const batch: PendingBatch = { paneId, viewportEpoch, signature };
    const rendered = this.#renderWorker.renderTiles(reader, {
      paneId,
      viewportEpoch,
      tiles: ownedRequests.map(({ key, bounds }) => ({
        key,
        bounds,
        renderBounds: this.#getRenderBounds(bounds),
        rasterZoom: shape.rasterZoom,
        rasterDpr: shape.rasterDpr,
        lod,
      })),
    });
    if (!rendered) return;
    this.#paneBatches.set(paneId, batch);
    this.#workerBatchRequests += 1;
    for (const { key, bounds } of ownedRequests) {
      this.#pendingTiles.set(key, {
        reader,
        revision,
        bounds,
        batch,
        listeners: new Set(),
      });
    }

    void rendered.then((tiles) => {
      const delivered = new Set<string>();
      for (const tile of tiles) {
        const pending = this.#pendingTiles.get(tile.key);
        if (
          !pending ||
          pending.batch !== batch ||
          pending.reader !== reader ||
          pending.revision !== revision ||
          this.#readerStates.get(reader)?.revision !== revision
        ) {
          tile.bitmap.close();
          continue;
        }
        delivered.add(tile.key);
        this.#pendingTiles.delete(tile.key);
        this.#deleteTile(tile.key);
        this.#tiles.set(tile.key, {
          image: tile.bitmap,
          bounds: tile.bounds,
          bytes: tile.bytes,
          reader,
          stale: false,
        });
        this.#bytes += tile.bytes;
        this.#asyncTiles += 1;
        this.#workerRasterTiles += 1;
        pending.listeners.forEach((listener) => listener());
      }
      for (const { key } of ownedRequests) {
        if (delivered.has(key)) continue;
        const pending = this.#pendingTiles.get(key);
        if (pending?.batch === batch) {
          this.#pendingTiles.delete(key);
          pending.listeners.forEach((listener) => listener());
        }
      }
      if (this.#paneBatches.get(paneId) === batch) {
        this.#paneBatches.delete(paneId);
      }
      this.#evictToBudget();
    }).catch((error: unknown) => {
      if (
        error instanceof CanvasRenderWorkerError &&
        !error.recoverable &&
        !error.rasterOnly
      ) {
        this.#workerFallbackReaders.add(reader);
      }
      for (const { key } of ownedRequests) {
        const pending = this.#pendingTiles.get(key);
        if (pending?.batch !== batch) continue;
        this.#pendingTiles.delete(key);
        pending.listeners.forEach((listener) => listener());
      }
      if (this.#paneBatches.get(paneId) === batch) {
        this.#paneBatches.delete(paneId);
      }
    });
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
      for (const tile of this.#tiles.values()) {
        if (
          tile.reader === reader &&
          changes.bounds.some((bounds) => intersects(bounds, tile.bounds))
        ) {
          if (!tile.stale) this.#staleRefreshes += 1;
          tile.stale = true;
        }
      }
    }
    this.#clearReaderPending(reader);
    state.revision = revision;
    return state;
  }

  #getTile(
    key: string,
    reader: CanvasSurfaceReader,
    revision: number,
    bounds: NodeBounds,
    shape: ReturnType<typeof getCanvasRasterTileShape>,
    lod: ReturnType<typeof resolveCanvasContentLod>
  ) {
    const cached = this.#tiles.get(key);
    if (cached) {
      if (cached.stale && !this.#pendingTiles.has(key)) {
        this.#deleteTile(key);
      } else {
        this.#hits += 1;
        this.#tiles.delete(key);
        this.#tiles.set(key, cached);
        return cached;
      }
    }
    const pending = this.#pendingTiles.get(key);
    if (pending) return null;
    this.#misses += 1;
    if (
      reader instanceof CellPlaneIndex &&
      this.#renderWorker &&
      !this.#workerFallbackReaders.has(reader)
    ) {
      const renderBounds = this.#getRenderBounds(bounds);
      const projection = this.#renderWorker.project(reader, renderBounds);
      if (projection) {
        const task: PendingTile = {
          reader,
          revision,
          bounds,
          batch: null,
          listeners: new Set(),
        };
        this.#pendingTiles.set(key, task);
        void projection.then((rows) => {
          if (
            this.#pendingTiles.get(key) !== task ||
            this.#readerStates.get(reader)?.revision !== revision
          ) return;
          const tile = this.#createTile(
            reader,
            bounds,
            shape,
            lod,
            this.#createRowsReader(rows)
          );
          this.#pendingTiles.delete(key);
          if (tile) {
            this.#tiles.set(key, tile);
            this.#bytes += tile.bytes;
            this.#asyncTiles += 1;
            this.#mainRasterTiles += 1;
            this.#evictToBudget();
          }
          task.listeners.forEach((listener) => listener());
        }).catch((error: unknown) => {
          if (this.#pendingTiles.get(key) !== task) return;
          this.#pendingTiles.delete(key);
          if (
            !(error instanceof CanvasRenderWorkerError) ||
            !error.recoverable
          ) {
            this.#workerFallbackReaders.add(reader);
          }
          task.listeners.forEach((listener) => listener());
        });
        return null;
      }
    }
    const tile = this.#createTile(reader, bounds, shape, lod, reader);
    if (!tile) return null;
    this.#tiles.set(key, tile);
    this.#bytes += tile.bytes;
    this.#mainRasterTiles += 1;
    this.#evictToBudget();
    return tile;
  }

  #createTile(
    owner: CanvasSurfaceReader,
    bounds: NodeBounds,
    shape: ReturnType<typeof getCanvasRasterTileShape>,
    lod: ReturnType<typeof resolveCanvasContentLod>,
    reader: CanvasSurfaceReader
  ) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const renderBounds = this.#getRenderBounds(bounds);
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
      image: canvas,
      bounds,
      bytes: canvas.width * canvas.height * 4,
      reader: owner,
      stale: false,
    };
    return tile;
  }

  #getRenderBounds(bounds: NodeBounds) {
    return {
      x: bounds.x - 1,
      y: bounds.y,
      width: bounds.width + 2,
      height: bounds.height,
    };
  }

  #createRowsReader(rows: readonly CellPlaneRow[]): CanvasSurfaceReader {
    return {
      getCell: () => undefined,
      *query() {
        for (const row of rows) {
          for (const span of row.spans) yield { ...span, y: row.y };
        }
      },
      *rows() { yield* rows; },
      getContentBounds: () => null,
      materialize: () => new Map(),
    };
  }

  #deleteTile(key: string) {
    const tile = this.#tiles.get(key);
    if (!tile) return;
    this.#tiles.delete(key);
    this.#bytes -= tile.bytes;
    if (
      typeof ImageBitmap !== "undefined" &&
      tile.image instanceof ImageBitmap
    ) {
      tile.image.close();
    } else if (tile.image instanceof HTMLCanvasElement) {
      tile.image.width = 0;
      tile.image.height = 0;
    }
  }

  #clearTiles() {
    for (const key of [...this.#tiles.keys()]) this.#deleteTile(key);
    this.#pendingTiles.clear();
    this.#paneKeys.clear();
    this.#paneEpochs.clear();
    this.#paneSignatures.clear();
    this.#paneBatches.clear();
  }

  #clearReaderTiles(reader: CanvasSurfaceReader) {
    for (const [key, tile] of this.#tiles) {
      if (tile.reader === reader) this.#deleteTile(key);
    }
  }

  #clearReaderPending(reader: CanvasSurfaceReader) {
    for (const [key, pending] of this.#pendingTiles) {
      if (pending.reader === reader) this.#pendingTiles.delete(key);
    }
  }

  #isProtected(key: string) {
    for (const keys of this.#paneKeys.values()) {
      if (keys.has(key)) return true;
    }
    return false;
  }

  #evictToBudget() {
    while (this.#bytes > this.#byteBudget && this.#tiles.size > 1) {
      const key = [...this.#tiles.keys()].find(
        (candidate) => !this.#isProtected(candidate)
      );
      if (!key) break;
      this.#deleteTile(key);
      this.#evictions += 1;
    }
  }
}
