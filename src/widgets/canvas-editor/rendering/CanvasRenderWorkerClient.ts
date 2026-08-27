import { CellPlaneIndex, type CellPlaneRow } from "@/domains/canvas/public";
import type { NodeBounds } from "@/shared/types";
import {
  collectCanvasWorkerFontFaces,
  getCanvasWorkerFontRevision,
} from "./canvasWorkerFonts";
import type {
  CanvasRenderedTile,
  CanvasRenderTileSpec,
  CanvasRenderWorkerRequest,
  CanvasRenderWorkerResponse,
} from "./canvasRenderWorkerProtocol";

type SourceState = {
  id: number;
  revision: number;
  operationCount: number;
};

type PendingProjection = {
  kind: "project";
  sourceId: number;
  revision: number;
  resolve: (rows: readonly CellPlaneRow[]) => void;
  reject: (error: Error) => void;
};

type PendingRender = {
  kind: "render";
  sourceId: number;
  revision: number;
  paneId: string;
  viewportEpoch: number;
  resolve: (tiles: readonly CanvasRenderedTile[]) => void;
  reject: (error: Error) => void;
};

type PendingRequest = PendingProjection | PendingRender;

export class CanvasRenderWorkerError extends Error {
  readonly recoverable: boolean;
  readonly rasterOnly: boolean;

  constructor(message: string, recoverable: boolean, rasterOnly = false) {
    super(message);
    this.name = "CanvasRenderWorkerError";
    this.recoverable = recoverable;
    this.rasterOnly = rasterOnly;
  }
}

export type CanvasRenderWorkerStats = {
  available: boolean;
  rasterAvailable: boolean;
  sources: number;
  pending: number;
  requests: number;
  completed: number;
  rasterBatches: number;
  rasterTiles: number;
  stale: number;
  cancelledBatches: number;
  failures: number;
  workerDurationMs: number;
  rasterDurationMs: number;
  lastError: string | null;
};

export class CanvasRenderWorkerClient {
  readonly #sources = new WeakMap<CellPlaneIndex, SourceState>();
  readonly #retainers = new WeakMap<CellPlaneIndex, number>();
  readonly #sourceIds = new Set<number>();
  readonly #pending = new Map<number, PendingRequest>();
  #worker: Worker | null = null;
  #nextSourceId = 1;
  #nextRequestId = 1;
  #disposed = false;
  #failed = false;
  #rasterAvailable: boolean | null = null;
  #fontRevision = "unconfigured";
  #requests = 0;
  #completed = 0;
  #rasterBatches = 0;
  #rasterTiles = 0;
  #stale = 0;
  #cancelledBatches = 0;
  #failures = 0;
  #workerDurationMs = 0;
  #rasterDurationMs = 0;
  #lastError: string | null = null;

  project(
    reader: CellPlaneIndex,
    bounds: NodeBounds
  ): Promise<readonly CellPlaneRow[]> | null {
    const worker = this.#getWorker();
    if (!worker) return null;
    const source = this.#syncSource(worker, reader);
    const requestId = this.#nextRequestId++;
    this.#requests += 1;
    const result = new Promise<readonly CellPlaneRow[]>((resolve, reject) => {
      this.#pending.set(requestId, {
        kind: "project",
        sourceId: source.id,
        revision: source.revision,
        resolve,
        reject,
      });
    });
    worker.postMessage({
      type: "project",
      requestId,
      sourceId: source.id,
      revision: source.revision,
      bounds,
    } satisfies CanvasRenderWorkerRequest);
    return result;
  }

  renderTiles(
    reader: CellPlaneIndex,
    input: {
      paneId: string;
      viewportEpoch: number;
      tiles: readonly CanvasRenderTileSpec[];
    }
  ): Promise<readonly CanvasRenderedTile[]> | null {
    const worker = this.#getWorker();
    if (!worker || this.#rasterAvailable === false || input.tiles.length === 0) {
      return null;
    }
    const source = this.#syncSource(worker, reader);
    const requestId = this.#nextRequestId++;
    this.#requests += 1;
    const result = new Promise<readonly CanvasRenderedTile[]>((resolve, reject) => {
      this.#pending.set(requestId, {
        kind: "render",
        sourceId: source.id,
        revision: source.revision,
        paneId: input.paneId,
        viewportEpoch: input.viewportEpoch,
        resolve,
        reject,
      });
    });
    worker.postMessage({
      type: "renderBatch",
      requestId,
      sourceId: source.id,
      revision: source.revision,
      paneId: input.paneId,
      viewportEpoch: input.viewportEpoch,
      fontRevision: this.#fontRevision,
      tiles: input.tiles,
    } satisfies CanvasRenderWorkerRequest);
    return result;
  }

  retain(reader: CellPlaneIndex) {
    this.#retainers.set(reader, (this.#retainers.get(reader) ?? 0) + 1);
    let retained = true;
    return () => {
      if (!retained) return;
      retained = false;
      const count = this.#retainers.get(reader) ?? 0;
      if (count > 1) {
        this.#retainers.set(reader, count - 1);
        return;
      }
      this.#retainers.delete(reader);
      this.#release(reader);
    };
  }

  getStats(): CanvasRenderWorkerStats {
    return {
      available: !this.#disposed && !this.#failed && typeof Worker !== "undefined",
      rasterAvailable: this.#rasterAvailable === true,
      sources: this.#sourceIds.size,
      pending: this.#pending.size,
      requests: this.#requests,
      completed: this.#completed,
      rasterBatches: this.#rasterBatches,
      rasterTiles: this.#rasterTiles,
      stale: this.#stale,
      cancelledBatches: this.#cancelledBatches,
      failures: this.#failures,
      workerDurationMs: this.#workerDurationMs,
      rasterDurationMs: this.#rasterDurationMs,
      lastError: this.#lastError,
    };
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#worker?.postMessage({ type: "dispose" } satisfies CanvasRenderWorkerRequest);
    this.#worker?.terminate();
    this.#worker = null;
    this.#sourceIds.clear();
    this.#rejectPending(new CanvasRenderWorkerError("Canvas render worker disposed", true));
  }

  #release(reader: CellPlaneIndex) {
    const source = this.#sources.get(reader);
    if (!source) return;
    this.#sources.delete(reader);
    this.#sourceIds.delete(source.id);
    this.#worker?.postMessage({
      type: "release",
      sourceId: source.id,
    } satisfies CanvasRenderWorkerRequest);
    this.#rejectSource(
      source.id,
      new CanvasRenderWorkerError("Canvas render source released", true)
    );
  }

  #syncSource(worker: Worker, reader: CellPlaneIndex) {
    const revision = reader.getRevision();
    const operationCount = reader.getOperationCount();
    let source = this.#sources.get(reader);
    if (!source) {
      source = { id: this.#nextSourceId++, revision, operationCount };
      this.#sources.set(reader, source);
      this.#sourceIds.add(source.id);
      worker.postMessage({
        type: "sync",
        sourceId: source.id,
        revision,
        operations: reader.getOperationsSince(0),
      } satisfies CanvasRenderWorkerRequest);
      return source;
    }
    if (source.revision === revision) return source;
    if (operationCount >= source.operationCount && revision >= source.revision) {
      worker.postMessage({
        type: "append",
        sourceId: source.id,
        revision,
        operations: reader.getOperationsSince(source.operationCount),
      } satisfies CanvasRenderWorkerRequest);
    } else {
      worker.postMessage({
        type: "sync",
        sourceId: source.id,
        revision,
        operations: reader.getOperationsSince(0),
      } satisfies CanvasRenderWorkerRequest);
    }
    source.revision = revision;
    source.operationCount = operationCount;
    return source;
  }

  #getWorker() {
    if (this.#disposed || this.#failed || typeof Worker === "undefined") return null;
    if (this.#worker) return this.#worker;
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("./canvasRender.worker.ts", import.meta.url),
        { type: "module", name: "chardesk-canvas-render" }
      );
    } catch {
      this.#failed = true;
      this.#failures += 1;
      return null;
    }
    const faces = typeof document === "undefined"
      ? []
      : collectCanvasWorkerFontFaces();
    this.#fontRevision = getCanvasWorkerFontRevision(faces);
    worker.onmessage = (event: MessageEvent<CanvasRenderWorkerResponse>) => {
      const response = event.data;
      if (response.type === "configured") {
        this.#rasterAvailable = response.rasterAvailable;
        return;
      }
      const pending = this.#pending.get(response.requestId);
      if (!pending) {
        if (response.type === "renderedBatch") {
          response.tiles.forEach(({ bitmap }) => bitmap.close());
        }
        return;
      }
      this.#pending.delete(response.requestId);
      if (
        pending.sourceId !== response.sourceId ||
        pending.revision !== response.revision ||
        response.type === "stale"
      ) {
        if (response.type === "renderedBatch") {
          response.tiles.forEach(({ bitmap }) => bitmap.close());
        }
        this.#stale += 1;
        if (pending.kind === "render") this.#cancelledBatches += 1;
        pending.reject(new CanvasRenderWorkerError("Canvas render became stale", true));
        return;
      }
      if (response.type === "font-error" || response.type === "unsupported") {
        this.#rasterAvailable = false;
        this.#failures += 1;
        this.#lastError = response.error ?? "Canvas worker raster unavailable";
        pending.reject(new CanvasRenderWorkerError(
          response.error ?? "Canvas worker raster unavailable",
          false,
          true
        ));
        return;
      }
      if (response.type === "error") {
        this.#failures += 1;
        this.#lastError = response.error ?? "Canvas render failed";
        pending.reject(new CanvasRenderWorkerError(
          response.error ?? "Canvas render failed",
          false
        ));
        return;
      }
      if (response.type === "projected" && pending.kind === "project") {
        this.#completed += 1;
        this.#workerDurationMs += response.durationMs;
        pending.resolve(response.rows);
        return;
      }
      if (response.type === "renderedBatch" && pending.kind === "render") {
        if (
          response.paneId !== pending.paneId ||
          response.viewportEpoch !== pending.viewportEpoch ||
          response.fontRevision !== this.#fontRevision
        ) {
          response.tiles.forEach(({ bitmap }) => bitmap.close());
          this.#stale += 1;
          this.#cancelledBatches += 1;
          pending.reject(new CanvasRenderWorkerError("Canvas render became stale", true));
          return;
        }
        this.#completed += 1;
        this.#rasterBatches += 1;
        this.#rasterTiles += response.tiles.length;
        this.#rasterDurationMs += response.durationMs;
        pending.resolve(response.tiles);
        return;
      }
      pending.reject(new CanvasRenderWorkerError("Unexpected canvas worker response", true));
    };
    worker.onerror = () => this.#failWorker(worker);
    worker.onmessageerror = () => this.#failWorker(worker);
    worker.postMessage({
      type: "configure",
      fontRevision: this.#fontRevision,
      fontFaces: faces,
    } satisfies CanvasRenderWorkerRequest);
    this.#worker = worker;
    return worker;
  }

  #failWorker(worker: Worker) {
    if (this.#worker !== worker) return;
    this.#failed = true;
    this.#rasterAvailable = false;
    this.#failures += 1;
    this.#lastError = "Canvas render worker failed";
    worker.terminate();
    this.#worker = null;
    this.#sourceIds.clear();
    this.#rejectPending(new CanvasRenderWorkerError("Canvas render worker failed", false));
  }

  #rejectSource(sourceId: number, error: Error) {
    for (const [requestId, pending] of this.#pending) {
      if (pending.sourceId !== sourceId) continue;
      this.#pending.delete(requestId);
      pending.reject(error);
    }
  }

  #rejectPending(error: Error) {
    this.#pending.forEach(({ reject }) => reject(error));
    this.#pending.clear();
  }
}
