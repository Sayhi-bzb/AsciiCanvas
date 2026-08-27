import {
  CellPlaneIndex,
  isIncrementalCanvasSurfaceReader,
  type CellPlaneRow,
  type CanvasSurfaceReader,
} from "@/domains/canvas/public";
import type { NodeBounds, Point } from "@/shared/types";
import type { CanvasRenderActivityMode } from "../engine/CanvasRenderActivity";
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
import { getIncrementalBackgroundBounds } from "./incrementalBackground";
import {
  CanvasViewportResidencyManager,
  type CanvasTileResidency,
} from "./CanvasViewportResidencyManager";
import {
  CanvasMemoryGovernor,
  type CanvasMemoryPressure,
} from "./CanvasMemoryGovernor";

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
  rasterZoom: number;
  rasterDpr: number;
};

type ReaderState = {
  id: number;
  revision: number | null;
  dirtyBounds: NodeBounds[] | null | undefined;
};

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
  residency: CanvasTileResidency;
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
  presentationFrames: number;
  deferredBatches: number;
  hotPatchBounds: number;
  memoryBudget: number;
  memoryPressure: string;
  warmEntries: number;
};

type CanvasRasterDrawOptions = {
  paneId: string;
  mode?: CanvasRenderActivityMode;
  onTileReady?: () => void;
};

type CanvasRasterDrawResult = {
  status: "complete" | "pending" | "presentation" | "fallback";
  patchBounds: readonly NodeBounds[];
  uncoveredBounds: readonly NodeBounds[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const floorDiv = (value: number, divisor: number) => Math.floor(value / divisor);

const intersects = (left: NodeBounds, right: NodeBounds) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const mergeBounds = (input: readonly NodeBounds[]) => {
  const result: NodeBounds[] = [];
  for (const bounds of input) {
    let merged = { ...bounds };
    for (let index = result.length - 1; index >= 0; index -= 1) {
      const existing = result[index]!;
      const touches = merged.x <= existing.x + existing.width &&
        merged.x + merged.width >= existing.x &&
        merged.y <= existing.y + existing.height &&
        merged.y + merged.height >= existing.y;
      if (!touches) continue;
      result.splice(index, 1);
      const x = Math.min(merged.x, existing.x);
      const y = Math.min(merged.y, existing.y);
      merged = {
        x,
        y,
        width: Math.max(merged.x + merged.width, existing.x + existing.width) - x,
        height: Math.max(merged.y + merged.height, existing.y + existing.height) - y,
      };
    }
    result.push(merged);
  }
  return result;
};

const subtractBounds = (source: NodeBounds, cover: NodeBounds): NodeBounds[] => {
  if (!intersects(source, cover)) return [source];
  const x1 = Math.max(source.x, cover.x);
  const y1 = Math.max(source.y, cover.y);
  const x2 = Math.min(source.x + source.width, cover.x + cover.width);
  const y2 = Math.min(source.y + source.height, cover.y + cover.height);
  return [
    { x: source.x, y: source.y, width: source.width, height: y1 - source.y },
    { x: source.x, y: y2, width: source.width, height: source.y + source.height - y2 },
    { x: source.x, y: y1, width: x1 - source.x, height: y2 - y1 },
    { x: x2, y: y1, width: source.x + source.width - x2, height: y2 - y1 },
  ].filter(({ width, height }) => width > 0 && height > 0);
};

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
  readonly #memoryGovernor: CanvasMemoryGovernor;
  readonly #tiles = new Map<string, RasterTile>();
  readonly #pendingTiles = new Map<string, PendingTile>();
  readonly #readerStates = new WeakMap<CanvasSurfaceReader, ReaderState>();
  readonly #renderWorker: CanvasRenderWorkerClient | null;
  readonly #workerFallbackReaders = new WeakSet<CanvasSurfaceReader>();
  readonly #paneKeys = new Map<string, Set<string>>();
  readonly #panePresentedKeys = new Map<string, Set<string>>();
  readonly #paneEpochs = new Map<string, number>();
  readonly #paneSignatures = new Map<string, string>();
  readonly #paneDeferredSignatures = new Map<string, string>();
  readonly #paneBatches = new Map<string, PendingBatch>();
  readonly #warmKeys = new Set<string>();
  readonly #paneWarmKeys = new Map<string, Set<string>>();
  readonly #residency = new CanvasViewportResidencyManager();
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
  #presentationFrames = 0;
  #deferredBatches = 0;
  #hotPatchBounds = 0;

  constructor(
    byteBudget = DEFAULT_BYTE_BUDGET,
    renderWorker: CanvasRenderWorkerClient | null = null,
    memoryGovernor = new CanvasMemoryGovernor(Math.max(byteBudget * 2, 8 * 1024 * 1024))
  ) {
    this.#byteBudget = byteBudget;
    this.#renderWorker = renderWorker;
    this.#memoryGovernor = memoryGovernor;
  }

  clear() {
    this.#clearTiles();
  }

  setMemoryPressure(pressure: CanvasMemoryPressure) {
    this.#memoryGovernor.setPressure(pressure);
    this.#evictToBudget();
  }

  retain(reader: CanvasSurfaceReader, paneId: string) {
    this.#retainCount += 1;
    const releaseWorker = reader instanceof CellPlaneIndex && this.#renderWorker
      ? this.#renderWorker.retain(reader)
      : () => {};
    return () => {
      this.#releaseCount += 1;
      releaseWorker();
      this.#cancelPaneBatch(paneId);
      this.#paneKeys.delete(paneId);
      this.#panePresentedKeys.delete(paneId);
      this.#paneEpochs.delete(paneId);
      this.#paneSignatures.delete(paneId);
      this.#paneDeferredSignatures.delete(paneId);
      this.#residency.release(paneId);
      this.#paneWarmKeys.delete(paneId);
      this.#rebuildWarmKeys();
      this.#evictToBudget();
    };
  }

  getStats(): CanvasRasterTileStats {
    const memory = this.#memoryGovernor.getStats();
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
      presentationFrames: this.#presentationFrames,
      deferredBatches: this.#deferredBatches,
      hotPatchBounds: this.#hotPatchBounds,
      memoryBudget: Math.min(this.#byteBudget, memory.rasterLimit),
      memoryPressure: memory.pressure,
      warmEntries: [...this.#warmKeys].filter((key) => this.#tiles.has(key)).length,
    };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    reader: CanvasSurfaceReader,
    viewBounds: ViewBounds,
    zoom: number,
    offset: Point,
    dpr: number,
    options: CanvasRasterDrawOptions
  ): CanvasRasterDrawResult {
    const emptyResult: CanvasRasterDrawResult = {
      status: "fallback",
      patchBounds: [],
      uncoveredBounds: [],
    };
    if (typeof document === "undefined") return emptyResult;
    const paneId = options.paneId;
    const mode = options.mode ?? "settled";
    const readerState = this.#syncReader(reader);
    const shape = getCanvasRasterTileShape(zoom, dpr);
    const lod = resolveCanvasContentLod(zoom);
    const minTileX = floorDiv(viewBounds.startX, shape.columns);
    const maxTileX = floorDiv(viewBounds.endX, shape.columns);
    const minTileY = floorDiv(viewBounds.startY, shape.rows);
    const maxTileY = floorDiv(viewBounds.endY, shape.rows);

    const residencySignature = [
      readerState.id,
      shape.rasterZoom,
      shape.rasterDpr,
      lod,
      shape.columns,
      shape.rows,
    ].join(":");
    const residentTiles = this.#residency.update({
      paneId,
      signature: residencySignature,
      minTileX,
      maxTileX,
      minTileY,
      maxTileY,
      mode,
    });
    const requests: TileRequest[] = [];
    for (const { x: tileX, y: tileY, residency } of residentTiles) {
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
        requests.push({ key, bounds, residency });
    }
    const visibleRequests = requests.filter(({ residency }) => residency === "visible");
    const visibleKeys = new Set(visibleRequests.map(({ key }) => key));
    this.#paneWarmKeys.set(paneId, new Set(
      requests.filter(({ residency }) => residency === "warm").map(({ key }) => key)
    ));
    this.#rebuildWarmKeys();
    const presentedKeys = this.#panePresentedKeys.get(paneId) ?? new Set<string>();
    this.#paneKeys.set(
      paneId,
      mode === "viewport-interaction"
        ? new Set([...visibleKeys, ...presentedKeys])
        : visibleKeys
    );
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
    if (mode === "settled") {
      this.#paneDeferredSignatures.delete(paneId);
      this.#requestWorkerTiles(
        reader,
        readerState.revision ?? 0,
        paneId,
        viewportEpoch,
        missingRequests,
        shape,
        lod,
        options.onTileReady
      );
    } else {
      if (
        missingRequests.length > 0 &&
        this.#paneDeferredSignatures.get(paneId) !== signature
      ) {
        this.#deferredBatches += 1;
        this.#paneDeferredSignatures.set(paneId, signature);
      }
      if (mode === "viewport-interaction") this.#cancelPaneBatch(paneId);
    }

    const presentationTiles = [...presentedKeys]
      .map((key) => this.#tiles.get(key))
      .filter((tile): tile is RasterTile => tile !== undefined && tile.reader === reader);
    if (mode === "viewport-interaction" && presentationTiles.length > 0) {
      this.#presentationFrames += 1;
      presentationTiles.forEach((tile) => this.#drawTile(ctx, tile, zoom, offset));
    }

    const pendingKeys = new Set<string>();
    const refreshingKeys = new Set<string>();
    const missingBounds: NodeBounds[] = [];
    for (const { key, bounds } of visibleRequests) {
      const tile = this.#getTile(
        key,
        reader,
        readerState.revision ?? 0,
        bounds,
        shape,
        lod,
        mode !== "settled"
      );
      if (!tile) {
        if (this.#pendingTiles.has(key)) {
          pendingKeys.add(key);
        }
        let fragments = [{ ...bounds }];
        for (const presentation of presentationTiles) {
          fragments = fragments.flatMap((fragment) =>
            subtractBounds(fragment, presentation.bounds)
          );
        }
        missingBounds.push(...fragments);
        continue;
      }
      if (this.#pendingTiles.has(key)) refreshingKeys.add(key);
      if (mode === "viewport-interaction" && presentedKeys.has(key)) continue;
      this.#drawTile(ctx, tile, zoom, offset);
    }
    const listenerKeys = new Set([...pendingKeys, ...refreshingKeys]);
    if (listenerKeys.size > 0 && options.onTileReady) {
      listenerKeys.forEach((key) => {
        this.#pendingTiles.get(key)?.listeners.add(options.onTileReady!);
      });
    }
    if (
      mode === "settled" &&
      missingBounds.length === 0 &&
      pendingKeys.size === 0 &&
      refreshingKeys.size === 0
    ) {
      this.#panePresentedKeys.set(paneId, visibleKeys);
      if (![...this.#tiles.values()].some(
        (tile) => tile.reader === reader && tile.stale
      )) {
        readerState.dirtyBounds = undefined;
      }
    }
    const viewportBounds = {
      x: viewBounds.startX,
      y: viewBounds.startY,
      width: viewBounds.endX - viewBounds.startX + 1,
      height: viewBounds.endY - viewBounds.startY + 1,
    };
    const patchBounds = readerState.dirtyBounds === null
      ? [viewportBounds]
      : readerState.dirtyBounds
        ? getIncrementalBackgroundBounds(
            { revision: readerState.revision ?? 0, full: false, bounds: readerState.dirtyBounds },
            viewportBounds
          ) ?? [viewportBounds]
        : [];
    this.#hotPatchBounds += patchBounds.length;
    return {
      status: mode === "viewport-interaction" && presentationTiles.length > 0
        ? "presentation"
        : missingBounds.length > 0
          ? "fallback"
          : pendingKeys.size > 0 || refreshingKeys.size > 0
            ? "pending"
            : "complete",
      patchBounds,
      uncoveredBounds: mergeBounds(missingBounds),
    };
  }

  #drawTile(
    ctx: CanvasRenderingContext2D,
    tile: RasterTile,
    zoom: number,
    offset: Point
  ) {
    const position = GridManager.gridToScreen(
      tile.bounds.x,
      tile.bounds.y,
      offset.x,
      offset.y,
      zoom
    );
    ctx.drawImage(
      tile.image,
      DEFAULT_GRID_RENDER_METRICS.cellWidth * tile.rasterZoom * tile.rasterDpr,
      0,
      tile.bounds.width * DEFAULT_GRID_RENDER_METRICS.cellWidth *
        tile.rasterZoom * tile.rasterDpr,
      tile.image.height,
      position.x,
      position.y,
      tile.bounds.width * DEFAULT_GRID_RENDER_METRICS.cellWidth * zoom,
      tile.bounds.height * DEFAULT_GRID_RENDER_METRICS.cellHeight * zoom
    );
  }

  #requestWorkerTiles(
    reader: CanvasSurfaceReader,
    revision: number,
    paneId: string,
    viewportEpoch: number,
    requests: readonly TileRequest[],
    shape: ReturnType<typeof getCanvasRasterTileShape>,
    lod: CanvasContentLod,
    onTileReady?: () => void
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
    const delivered = new Set<string>();
    const rendered = this.#renderWorker.renderTiles(reader, {
      paneId,
      viewportEpoch,
      tiles: ownedRequests.map(({ key, bounds, residency }) => ({
        key,
        bounds,
        renderBounds: this.#getRenderBounds(bounds),
        rasterZoom: shape.rasterZoom,
        rasterDpr: shape.rasterDpr,
        lod,
        priority: residency === "visible"
          ? "visible"
          : "prefetch",
      })),
      onTile: (tile) => {
        const pending = this.#pendingTiles.get(tile.key);
        if (
          !pending ||
          pending.batch !== batch ||
          pending.reader !== reader ||
          pending.revision !== revision ||
          this.#readerStates.get(reader)?.revision !== revision
        ) {
          tile.bitmap.close();
          return;
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
          rasterZoom: shape.rasterZoom,
          rasterDpr: shape.rasterDpr,
        });
        this.#bytes += tile.bytes;
        this.#asyncTiles += 1;
        this.#workerRasterTiles += 1;
        pending.listeners.forEach((listener) => listener());
        this.#evictToBudget();
      },
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

    void rendered.then(() => {
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
      onTileReady?.();
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
        dirtyBounds: undefined,
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
      state.dirtyBounds = null;
    } else {
      state.dirtyBounds = mergeBounds([
        ...(state.dirtyBounds ?? []),
        ...changes.bounds,
      ]);
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
    lod: ReturnType<typeof resolveCanvasContentLod>,
    preserveStale: boolean
  ) {
    const cached = this.#tiles.get(key);
    if (cached) {
      if (cached.stale && !this.#pendingTiles.has(key) && !preserveStale) {
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
    if (preserveStale) return null;
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
      rasterZoom: shape.rasterZoom,
      rasterDpr: shape.rasterDpr,
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
    [...this.#paneBatches.keys()].forEach((paneId) => this.#cancelPaneBatch(paneId));
    for (const key of [...this.#tiles.keys()]) this.#deleteTile(key);
    this.#pendingTiles.clear();
    this.#paneKeys.clear();
    this.#panePresentedKeys.clear();
    this.#paneEpochs.clear();
    this.#paneSignatures.clear();
    this.#paneDeferredSignatures.clear();
    this.#residency.clear();
    this.#paneBatches.clear();
    this.#warmKeys.clear();
    this.#paneWarmKeys.clear();
  }

  #clearReaderTiles(reader: CanvasSurfaceReader) {
    for (const [key, tile] of this.#tiles) {
      if (tile.reader === reader) this.#deleteTile(key);
    }
  }

  #clearReaderPending(reader: CanvasSurfaceReader) {
    const paneIds = new Set<string>();
    for (const [key, pending] of this.#pendingTiles) {
      if (pending.reader !== reader) continue;
      if (pending.batch) paneIds.add(pending.batch.paneId);
      this.#pendingTiles.delete(key);
    }
    paneIds.forEach((paneId) => this.#cancelPaneBatch(paneId));
  }

  #cancelPaneBatch(paneId: string) {
    const batch = this.#paneBatches.get(paneId);
    if (!batch) return;
    this.#paneBatches.delete(paneId);
    this.#renderWorker?.cancelPane(paneId);
    for (const [key, pending] of this.#pendingTiles) {
      if (pending.batch !== batch) continue;
      this.#pendingTiles.delete(key);
      pending.listeners.forEach((listener) => listener());
    }
  }

  #isProtected(key: string) {
    for (const keys of this.#paneKeys.values()) {
      if (keys.has(key)) return true;
    }
    return false;
  }

  #rebuildWarmKeys() {
    this.#warmKeys.clear();
    this.#paneWarmKeys.forEach((keys) => keys.forEach((key) => this.#warmKeys.add(key)));
  }

  #evictToBudget() {
    this.#memoryGovernor.report("raster", this.#bytes);
    const budget = Math.min(this.#byteBudget, this.#memoryGovernor.getLimit("raster"));
    while (this.#bytes > budget && this.#tiles.size > 1) {
      const key = [...this.#tiles.keys()].find(
        (candidate) => !this.#isProtected(candidate) && this.#warmKeys.has(candidate)
      ) ?? [...this.#tiles.keys()].find(
        (candidate) => !this.#isProtected(candidate)
      );
      if (!key) break;
      this.#deleteTile(key);
      this.#evictions += 1;
    }
    this.#memoryGovernor.report("raster", this.#bytes);
  }
}
