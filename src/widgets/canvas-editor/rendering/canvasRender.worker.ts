/// <reference lib="webworker" />

import { CellPlaneIndex } from "@/domains/canvas/public";
import { DEFAULT_GRID_RENDER_METRICS, prepareCanvasSurface } from "@/shared/metrics";
import { drawGridLayer } from "./drawGridLayer";
import {
  canvasWorkerFontFaceCovers,
  CANVAS_WORKER_FONT_CALIBRATION_TEXT,
  type CanvasWorkerFontFace,
} from "./canvasWorkerFonts";
import type {
  CanvasRenderedTile,
  CanvasRenderTileSpec,
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
  rendered: CanvasRenderedTile[];
  durationMs: number;
};

const sources = new Map<number, Source>();
const batches = new Map<string, RenderBatch>();
const paneOrder: string[] = [];
const loadedFaces = new Map<string, Promise<FontFace>>();
let fontFaces: readonly CanvasWorkerFontFace[] = [];
let fontRevision = "unconfigured";
let rasterAvailable = false;
let rasterUnavailableReason: string | undefined;
let processing = false;
let nextPaneIndex = 0;

const respond = (
  response: CanvasRenderWorkerResponse,
  transfer: Transferable[] = []
) => self.postMessage(response, transfer);

const closeRendered = (tiles: readonly CanvasRenderedTile[]) => {
  tiles.forEach(({ bitmap }) => bitmap.close());
};

const staleBatch = (batch: RenderBatch) => {
  closeRendered(batch.rendered);
  respond({
    type: "stale",
    requestId: batch.requestId,
    sourceId: batch.sourceId,
    revision: batch.revision,
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
};

const cancelSourceBatches = (sourceId: number) => {
  for (const [paneId, batch] of batches) {
    if (batch.sourceId === sourceId) cancelBatch(paneId);
  }
};

const codePoints = (text: string) =>
  Array.from(text, (character) => character.codePointAt(0)!)
    .filter(Number.isSafeInteger);

const numericWeight = (weight: string) => {
  const value = Number.parseInt(weight, 10);
  return Number.isFinite(value) ? value : 400;
};

const loadFace = (descriptor: CanvasWorkerFontFace) => {
  let promise = loadedFaces.get(descriptor.id);
  if (promise) return promise;
  const face = new FontFace(
    descriptor.family,
    `url(${JSON.stringify(descriptor.sourceUrl)}) format("woff2")`,
    {
      weight: descriptor.weight,
      style: descriptor.style,
      ...(descriptor.unicodeRange
        ? { unicodeRange: descriptor.unicodeRange }
        : {}),
    }
  );
  self.fonts.add(face);
  promise = face.load();
  loadedFaces.set(descriptor.id, promise);
  return promise;
};

const ensureTileFonts = async (
  source: Source,
  tile: CanvasRenderTileSpec
) => {
  if (tile.lod === "density") return;
  const regularPoints = new Set<number>();
  const boldPoints = new Set<number>();
  for (const span of source.index.query(tile.renderBounds)) {
    for (const cell of span.cells) {
      if (cell.char.trim() === "") continue;
      const target = cell.attrs?.bold ? boldPoints : regularPoints;
      codePoints(cell.char).forEach((point) => target.add(point));
    }
  }
  if (regularPoints.size === 0 && boldPoints.size === 0) return;
  const regularCodePoints = [...regularPoints];
  const boldCodePoints = [...boldPoints];
  const selected = fontFaces.filter((face) => {
    const weight = numericWeight(face.weight);
    const points = weight >= 700 ? boldCodePoints : regularCodePoints;
    return points.length > 0 && canvasWorkerFontFaceCovers(face, points);
  });
  await Promise.all(selected.map(loadFace));
};

const supportsWorkerRaster = () => {
  if (
    typeof OffscreenCanvas === "undefined" ||
    typeof FontFace === "undefined" ||
    !("fonts" in self)
  ) return false;
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.transferToImageBitmap !== "function") return false;
  ctx.font = `${DEFAULT_GRID_RENDER_METRICS.fontSize}px ${
    DEFAULT_GRID_RENDER_METRICS.fontFamily
  }`;
  const measurement = ctx.measureText(CANVAS_WORKER_FONT_CALIBRATION_TEXT);
  return Number.isFinite(measurement.width) && measurement.width > 0;
};

const renderTile = async (
  source: Source,
  tile: CanvasRenderTileSpec
): Promise<CanvasRenderedTile> => {
  await ensureTileFonts(source, tile);
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
    { lod: tile.lod }
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
  const transfer = batch.rendered.map(({ bitmap }) => bitmap as Transferable);
  respond({
    type: "renderedBatch",
    requestId: batch.requestId,
    sourceId: batch.sourceId,
    revision: batch.revision,
    paneId: batch.paneId,
    viewportEpoch: batch.viewportEpoch,
    fontRevision: batch.fontRevision,
    tiles: batch.rendered,
    durationMs: batch.durationMs,
  }, transfer);
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
  try {
    const rendered = await renderTile(source, tile);
    if (batches.get(paneId) !== batch) {
      rendered.bitmap.close();
    } else {
      batch.rendered.push(rendered);
      batch.durationMs += performance.now() - startedAt;
      if (batch.tiles.length === 0) finishBatch(batch);
    }
  } catch (error) {
    if (batches.get(paneId) === batch) {
      batches.delete(paneId);
      removePane(paneId);
      closeRendered(batch.rendered);
      respond({
        type: "font-error",
        requestId: batch.requestId,
        sourceId: batch.sourceId,
        revision: batch.revision,
        error: error instanceof Error ? error.message : "Worker tile rendering failed",
      });
    }
  }
  scheduleNext();
};

self.onmessage = (event: MessageEvent<CanvasRenderWorkerRequest>) => {
  const request = event.data;
  if (request.type === "configure") {
    fontFaces = request.fontFaces;
    fontRevision = request.fontRevision;
    rasterAvailable = supportsWorkerRaster() && fontFaces.length > 0;
    rasterUnavailableReason = rasterAvailable
      ? undefined
      : "OffscreenCanvas or worker fonts unavailable";
    respond({
      type: "configured",
      rasterAvailable,
      fontRevision,
      ...(rasterUnavailableReason ? { reason: rasterUnavailableReason } : {}),
    });
    return;
  }
  if (request.type === "sync") {
    cancelSourceBatches(request.sourceId);
    sources.get(request.sourceId)?.index.dispose();
    sources.set(request.sourceId, {
      revision: request.revision,
      index: new CellPlaneIndex(request.operations),
    });
    return;
  }
  if (request.type === "append") {
    const source = sources.get(request.sourceId);
    if (!source || request.revision <= source.revision) return;
    cancelSourceBatches(request.sourceId);
    request.operations.forEach((operation) => source.index.append(operation));
    source.revision = request.revision;
    return;
  }
  if (request.type === "release") {
    cancelSourceBatches(request.sourceId);
    sources.get(request.sourceId)?.index.dispose();
    sources.delete(request.sourceId);
    return;
  }
  if (request.type === "dispose") {
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
    } catch (error) {
      respond({
        type: "error",
        requestId: request.requestId,
        sourceId: request.sourceId,
        revision: request.revision,
        error: error instanceof Error ? error.message : "Canvas projection failed",
      });
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
  const batch: RenderBatch = {
    requestId: request.requestId,
    sourceId: request.sourceId,
    revision: request.revision,
    paneId: request.paneId,
    viewportEpoch: request.viewportEpoch,
    fontRevision: request.fontRevision,
    tiles: [...request.tiles],
    rendered: [],
    durationMs: 0,
  };
  batches.set(request.paneId, batch);
  paneOrder.push(request.paneId);
  scheduleNext();
};
