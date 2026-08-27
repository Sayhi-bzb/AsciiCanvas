/// <reference lib="webworker" />

import { CellPlaneIndex } from "@/domains/canvas/public";
import { DEFAULT_GRID_RENDER_METRICS, prepareCanvasSurface } from "@/shared/metrics";
import { drawGridLayer } from "./drawGridLayer";
import type {
  CanvasRenderedTile,
  CanvasRenderTileSpec,
  CanvasRenderWorkerResourceStats,
  CanvasRenderWorkerRequest,
  CanvasRenderWorkerResponse,
} from "./canvasRenderWorkerProtocol";

type Source = { revision: number; index: CellPlaneIndex };

type RenderBatch = {
  requestId: number;
  sourceId: number;
  revision: number;
  paneId: string;
  viewportEpoch: number;
  fontRevision: string;
  tiles: CanvasRenderTileSpec[];
  renderedCount: number;
  durationMs: number;
  queuedAt: number;
};

const sources = new Map<number, Source>();
const batches = new Map<string, RenderBatch>();
const paneOrder: string[] = [];
let fontRevision = "unconfigured";
let rasterAvailable = false;
let rasterUnavailableReason: string | undefined;
let processing = false;
let nextPaneIndex = 0;
let resourceReportTimer: ReturnType<typeof setTimeout> | null = null;

const respond = (
  response: CanvasRenderWorkerResponse,
  transfer: Transferable[] = []
) => self.postMessage(response, transfer);

const readResourceStats = (): CanvasRenderWorkerResourceStats => {
  let sourcePayloadBytes = 0;
  let sourceResidentBytes = 0;
  sources.forEach(({ index }) => {
    const stats = index.getStats();
    sourcePayloadBytes += stats.encodedPayloadBytes;
    sourceResidentBytes += stats.residentBytes;
  });
  return {
    sourcePayloadBytes,
    sourceResidentBytes,
    sources: sources.size,
    queuedBatches: batches.size,
    queuedTiles: [...batches.values()].reduce(
      (count, batch) => count + batch.tiles.length,
      0
    ),
    loadedFontFaces: 0,
  };
};

const scheduleResourceReport = () => {
  if (resourceReportTimer !== null) return;
  resourceReportTimer = setTimeout(() => {
    resourceReportTimer = null;
    respond({ type: "resources", stats: readResourceStats() });
  }, 250);
};

const staleBatch = (batch: RenderBatch) => {
  respond({
    type: "stale",
    requestId: batch.requestId,
    sourceId: batch.sourceId,
    revision: batch.revision,
    cancelledTiles: batch.tiles.length,
  });
};

const removePane = (paneId: string) => {
  const index = paneOrder.indexOf(paneId);
  if (index >= 0) paneOrder.splice(index, 1);
  if (nextPaneIndex >= paneOrder.length) nextPaneIndex = 0;
};

const cancelBatch = (paneId: string) => {
  const batch = batches.get(paneId);
  if (!batch) return;
  batches.delete(paneId);
  removePane(paneId);
  staleBatch(batch);
  scheduleResourceReport();
};

const cancelSourceBatches = (sourceId: number) => {
  for (const [paneId, batch] of batches) {
    if (batch.sourceId === sourceId) cancelBatch(paneId);
  }
};

const supportsWorkerRaster = () => {
  if (
    typeof OffscreenCanvas === "undefined" ||
    typeof OffscreenCanvas.prototype.transferToImageBitmap !== "function"
  ) return false;
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d");
  return !!ctx;
};

const renderTile = async (
  source: Source,
  tile: CanvasRenderTileSpec
): Promise<CanvasRenderedTile> => {
  const width = tile.renderBounds.width *
    DEFAULT_GRID_RENDER_METRICS.cellWidth * tile.rasterZoom;
  const height = tile.bounds.height *
    DEFAULT_GRID_RENDER_METRICS.cellHeight * tile.rasterZoom;
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
  prepareCanvasSurface(canvas, ctx, width, height, tile.rasterDpr);
  drawGridLayer(
    ctx,
    source.index,
    {
      startX: tile.renderBounds.x,
      endX: tile.renderBounds.x + tile.renderBounds.width - 1,
      startY: tile.renderBounds.y,
      endY: tile.renderBounds.y + tile.renderBounds.height - 1,
    },
    tile.rasterZoom,
    {
      x: -tile.renderBounds.x *
        DEFAULT_GRID_RENDER_METRICS.cellWidth * tile.rasterZoom,
      y: -tile.bounds.y *
        DEFAULT_GRID_RENDER_METRICS.cellHeight * tile.rasterZoom,
    },
    { lod: tile.lod, content: "background" }
  );
  const bitmap = canvas.transferToImageBitmap();
  return {
    key: tile.key,
    bounds: tile.bounds,
    bitmap,
    bytes: bitmap.width * bitmap.height * 4,
  };
};

const finishBatch = (batch: RenderBatch) => {
  batches.delete(batch.paneId);
  removePane(batch.paneId);
  respond({
    type: "renderedBatchComplete",
    requestId: batch.requestId,
    sourceId: batch.sourceId,
    revision: batch.revision,
    paneId: batch.paneId,
    viewportEpoch: batch.viewportEpoch,
    fontRevision: batch.fontRevision,
    tileCount: batch.renderedCount,
    durationMs: batch.durationMs,
  });
};

const scheduleNext = () => {
  if (processing || paneOrder.length === 0) return;
  processing = true;
  setTimeout(() => void processNext(), 0);
};

const processNext = async () => {
  processing = false;
  if (paneOrder.length === 0) return;
  if (nextPaneIndex >= paneOrder.length) nextPaneIndex = 0;
  const paneId = paneOrder[nextPaneIndex]!;
  nextPaneIndex = (nextPaneIndex + 1) % Math.max(1, paneOrder.length);
  const batch = batches.get(paneId);
  if (!batch) {
    removePane(paneId);
    scheduleNext();
    return;
  }
  const source = sources.get(batch.sourceId);
  if (!source || source.revision !== batch.revision) {
    cancelBatch(paneId);
    scheduleNext();
    return;
  }
  const tile = batch.tiles.shift();
  if (!tile) {
    finishBatch(batch);
    scheduleNext();
    return;
  }
  const startedAt = performance.now();
  const queueLatencyMs = startedAt - batch.queuedAt;
  try {
    const rendered = await renderTile(source, tile);
    if (batches.get(paneId) !== batch) {
      rendered.bitmap.close();
    } else {
      const durationMs = performance.now() - startedAt;
      batch.renderedCount += 1;
      batch.durationMs += durationMs;
      respond({
        type: "renderedTile",
        requestId: batch.requestId,
        sourceId: batch.sourceId,
        revision: batch.revision,
        paneId: batch.paneId,
        viewportEpoch: batch.viewportEpoch,
        fontRevision: batch.fontRevision,
        tile: rendered,
        durationMs,
        queueLatencyMs,
      }, [rendered.bitmap]);
      batch.queuedAt = performance.now();
      if (batch.tiles.length === 0) {
        finishBatch(batch);
        scheduleResourceReport();
      }
    }
  } catch (error) {
    if (batches.get(paneId) === batch) {
      batches.delete(paneId);
      removePane(paneId);
      respond({
        type: "error",
        requestId: batch.requestId,
        sourceId: batch.sourceId,
        revision: batch.revision,
        error: error instanceof Error ? error.message : "Worker tile rendering failed",
      });
      scheduleResourceReport();
    }
  }
  scheduleNext();
};

self.onmessage = (event: MessageEvent<CanvasRenderWorkerRequest>) => {
  const request = event.data;
  if (request.type === "configure") {
    fontRevision = request.fontRevision;
    rasterAvailable = supportsWorkerRaster();
    rasterUnavailableReason = rasterAvailable
      ? undefined
      : "OffscreenCanvas unavailable";
    respond({
      type: "configured",
      rasterAvailable,
      fontRevision,
      ...(rasterUnavailableReason ? { reason: rasterUnavailableReason } : {}),
    });
    scheduleResourceReport();
    return;
  }
  if (request.type === "sync") {
    cancelSourceBatches(request.sourceId);
    sources.get(request.sourceId)?.index.dispose();
    sources.set(request.sourceId, {
      revision: request.revision,
      index: new CellPlaneIndex(request.operations),
    });
    scheduleResourceReport();
    return;
  }
  if (request.type === "append") {
    const source = sources.get(request.sourceId);
    if (!source || request.revision <= source.revision) return;
    cancelSourceBatches(request.sourceId);
    request.operations.forEach((operation) => source.index.append(operation));
    source.revision = request.revision;
    scheduleResourceReport();
    return;
  }
  if (request.type === "release") {
    cancelSourceBatches(request.sourceId);
    sources.get(request.sourceId)?.index.dispose();
    sources.delete(request.sourceId);
    scheduleResourceReport();
    return;
  }
  if (request.type === "cancelPane") {
    cancelBatch(request.paneId);
    return;
  }
  if (request.type === "dispose") {
    if (resourceReportTimer !== null) clearTimeout(resourceReportTimer);
    resourceReportTimer = null;
    for (const paneId of [...paneOrder]) cancelBatch(paneId);
    sources.forEach(({ index }) => index.dispose());
    sources.clear();
    self.close();
    return;
  }
  const source = sources.get(request.sourceId);
  if (!source || source.revision !== request.revision) {
    respond({
      type: "stale",
      requestId: request.requestId,
      sourceId: request.sourceId,
      revision: request.revision,
    });
    return;
  }
  if (request.type === "project") {
    const startedAt = performance.now();
    try {
      respond({
        type: "projected",
        requestId: request.requestId,
        sourceId: request.sourceId,
        revision: request.revision,
        rows: [...source.index.rows(request.bounds)],
        durationMs: performance.now() - startedAt,
      });
      scheduleResourceReport();
    } catch (error) {
      respond({
        type: "error",
        requestId: request.requestId,
        sourceId: request.sourceId,
        revision: request.revision,
        error: error instanceof Error ? error.message : "Canvas projection failed",
      });
      scheduleResourceReport();
    }
    return;
  }
  if (!rasterAvailable || request.fontRevision !== fontRevision) {
    respond({
      type: "unsupported",
      requestId: request.requestId,
      sourceId: request.sourceId,
      revision: request.revision,
      error: rasterUnavailableReason ?? "Worker font revision mismatch",
    });
    return;
  }
  cancelBatch(request.paneId);
  const centerX = request.tiles.reduce(
    (sum, tile) => sum + tile.bounds.x + tile.bounds.width / 2,
    0
  ) / Math.max(1, request.tiles.length);
  const centerY = request.tiles.reduce(
    (sum, tile) => sum + tile.bounds.y + tile.bounds.height / 2,
    0
  ) / Math.max(1, request.tiles.length);
  const tiles = [...request.tiles].sort((left, right) => {
    const priority = (left.priority === "prefetch" ? 1 : 0) -
      (right.priority === "prefetch" ? 1 : 0);
    if (priority !== 0) return priority;
    const leftDistance = Math.abs(left.bounds.x + left.bounds.width / 2 - centerX) +
      Math.abs(left.bounds.y + left.bounds.height / 2 - centerY);
    const rightDistance = Math.abs(right.bounds.x + right.bounds.width / 2 - centerX) +
      Math.abs(right.bounds.y + right.bounds.height / 2 - centerY);
    return leftDistance - rightDistance;
  });
  const batch: RenderBatch = {
    requestId: request.requestId,
    sourceId: request.sourceId,
    revision: request.revision,
    paneId: request.paneId,
    viewportEpoch: request.viewportEpoch,
    fontRevision: request.fontRevision,
    tiles,
    renderedCount: 0,
    durationMs: 0,
    queuedAt: performance.now(),
  };
  batches.set(request.paneId, batch);
  paneOrder.push(request.paneId);
  scheduleNext();
};
