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
  workerStates: Map<Worker, { revision: number; operationCount: number }>;
};

type PendingProjection = {
  kind: "project";
  sourceId: number;
  revision: number;
  worker: Worker;
  resolve: (rows: readonly CellPlaneRow[]) => void;
  reject: (error: Error) => void;
};

type PendingRender = {
  kind: "render";
  sourceId: number;
  revision: number;
  worker: Worker;
  paneId: string;
  viewportEpoch: number;
  onTile: (tile: CanvasRenderedTile) => void;
  receivedTiles: number;
  startedAt: number;
  resolve: (summary: CanvasRenderBatchSummary) => void;
  reject: (error: Error) => void;
};

type PendingRequest = PendingProjection | PendingRender;

type CanvasRenderBatchSummary = {
  tileCount: number;
  durationMs: number;
};

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
  lastTimeToFirstTileMs: number;
  maxQueueLatencyMs: number;
  cancelledTiles: number;
  lastError: string | null;
  workers: number;
  poolExpansions: number;
};

export class CanvasRenderWorkerClient {
  readonly #sources = new WeakMap<CellPlaneIndex, SourceState>();
  readonly #retainers = new WeakMap<CellPlaneIndex, number>();
  readonly #sourceIds = new Set<number>();
  readonly #sourceStates = new Set<SourceState>();
  readonly #pending = new Map<number, PendingRequest>();
  #worker: Worker | null = null;
  #secondaryWorker: Worker | null = null;
  #secondaryIdleTimer: ReturnType<typeof setTimeout> | null = null;
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
  #lastTimeToFirstTileMs = 0;
  #maxQueueLatencyMs = 0;
  #cancelledTiles = 0;
  #lastError: string | null = null;
  #poolExpansions = 0;

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
        worker,
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
      onTile?: (tile: CanvasRenderedTile) => void;
    }
  ): Promise<CanvasRenderBatchSummary> | null {
    const worker = this.#getRenderWorker();
    if (!worker || this.#rasterAvailable === false || input.tiles.length === 0) {
      return null;
    }
    const source = this.#syncSource(worker, reader);
    const requestId = this.#nextRequestId++;
    this.#requests += 1;
    const result = new Promise<CanvasRenderBatchSummary>((resolve, reject) => {
      this.#pending.set(requestId, {
        kind: "render",
        sourceId: source.id,
        revision: source.revision,
        worker,
        paneId: input.paneId,
        viewportEpoch: input.viewportEpoch,
        onTile: input.onTile ?? (() => undefined),
        receivedTiles: 0,
        startedAt: performance.now(),
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

  cancelPane(paneId: string): void {
    this.#workers().forEach((worker) => worker.postMessage(
      { type: "cancelPane", paneId } satisfies CanvasRenderWorkerRequest
    ));
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
      lastTimeToFirstTileMs: this.#lastTimeToFirstTileMs,
      maxQueueLatencyMs: this.#maxQueueLatencyMs,
      cancelledTiles: this.#cancelledTiles,
      lastError: this.#lastError,
      workers: this.#workers().length,
      poolExpansions: this.#poolExpansions,
    };
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#secondaryIdleTimer !== null) clearTimeout(this.#secondaryIdleTimer);
    this.#workers().forEach((worker) => {
      worker.postMessage({ type: "dispose" } satisfies CanvasRenderWorkerRequest);
      worker.terminate();
    });
    this.#worker = null;
    this.#secondaryWorker = null;
    this.#sourceIds.clear();
    this.#sourceStates.clear();
    this.#rejectPending(new CanvasRenderWorkerError("Canvas render worker disposed", true));
  }

  #release(reader: CellPlaneIndex) {
    const source = this.#sources.get(reader);
    if (!source) return;
    this.#sources.delete(reader);
    this.#sourceIds.delete(source.id);
    this.#workers().forEach((worker) => worker.postMessage({
        type: "release",
        sourceId: source.id,
      } satisfies CanvasRenderWorkerRequest));
    this.#sourceStates.delete(source);
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
      source = {
        id: this.#nextSourceId++,
        revision,
        operationCount,
        workerStates: new Map(),
      };
      this.#sources.set(reader, source);
      this.#sourceIds.add(source.id);
      this.#sourceStates.add(source);
    }
    const workerState = source.workerStates.get(worker);
    if (!workerState) {
      worker.postMessage({
        type: "sync",
        sourceId: source.id,
        revision,
        operations: reader.getOperationsSince(0),
      } satisfies CanvasRenderWorkerRequest);
      source.workerStates.set(worker, { revision, operationCount });
      source.revision = revision;
      source.operationCount = operationCount;
      return source;
    }
    if (workerState.revision === revision) return source;
    if (operationCount >= workerState.operationCount && revision >= workerState.revision) {
      worker.postMessage({
        type: "append",
        sourceId: source.id,
        revision,
        operations: reader.getOperationsSince(workerState.operationCount),
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
    source.workerStates.set(worker, { revision, operationCount });
    return source;
  }

  #workers(): Worker[] {
    return [this.#worker, this.#secondaryWorker].filter(
      (worker): worker is Worker => worker !== null
    );
  }

  #getRenderWorker() {
    const primary = this.#getWorker();
    if (!primary) return null;
    const pendingRenders = [...this.#pending.values()].filter(
      ({ kind }) => kind === "render"
    ).length;
    const hardwareConcurrency = typeof navigator === "undefined"
      ? 4
      : navigator.hardwareConcurrency || 4;
    if (!this.#secondaryWorker && pendingRenders >= 2 && hardwareConcurrency >= 6) {
      this.#secondaryWorker = this.#createSecondaryWorker(primary);
      if (this.#secondaryWorker) this.#poolExpansions += 1;
    }
    const workers = this.#workers();
    return workers.reduce((best, candidate) => {
      const load = [...this.#pending.values()].filter(
        (pending) => pending.kind === "render" && pending.worker === candidate
      ).length;
      const bestLoad = [...this.#pending.values()].filter(
        (pending) => pending.kind === "render" && pending.worker === best
      ).length;
      return load < bestLoad ? candidate : best;
    }, workers[0]!);
  }

  #createSecondaryWorker(primary: Worker): Worker | null {
    try {
      const worker = new Worker(
        new URL("./canvasRender.worker.ts", import.meta.url),
        { type: "module", name: "chardesk-canvas-render-secondary" }
      );
      worker.onmessage = primary.onmessage;
      worker.onerror = () => this.#failWorker(worker);
      worker.onmessageerror = () => this.#failWorker(worker);
      const faces = typeof document === "undefined" ? [] : collectCanvasWorkerFontFaces();
      worker.postMessage({
        type: "configure",
        fontRevision: this.#fontRevision,
        fontFaces: faces,
      } satisfies CanvasRenderWorkerRequest);
      return worker;
    } catch {
      this.#failures += 1;
      return null;
    }
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
        if (response.type === "renderedTile") response.tile.bitmap.close();
        return;
      }
      if (response.type === "renderedTile") {
        if (
          pending.kind !== "render" ||
          pending.sourceId !== response.sourceId ||
          pending.revision !== response.revision ||
          response.paneId !== pending.paneId ||
          response.viewportEpoch !== pending.viewportEpoch ||
          response.fontRevision !== this.#fontRevision
        ) {
          response.tile.bitmap.close();
          this.#stale += 1;
          return;
        }
        pending.receivedTiles += 1;
        if (pending.receivedTiles === 1) {
          this.#lastTimeToFirstTileMs = performance.now() - pending.startedAt;
        }
        this.#maxQueueLatencyMs = Math.max(
          this.#maxQueueLatencyMs,
          response.queueLatencyMs
        );
        this.#rasterTiles += 1;
        this.#rasterDurationMs += response.durationMs;
        pending.onTile(response.tile);
        return;
      }
      this.#pending.delete(response.requestId);
      this.#scheduleSecondaryRetirement();
      if (
        pending.sourceId !== response.sourceId ||
        pending.revision !== response.revision ||
        response.type === "stale"
      ) {
        this.#stale += 1;
        if (pending.kind === "render") {
          this.#cancelledBatches += 1;
          if (response.type === "stale") {
            this.#cancelledTiles += response.cancelledTiles ?? 0;
          }
        }
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
      if (response.type === "renderedBatchComplete" && pending.kind === "render") {
        if (
          response.paneId !== pending.paneId ||
          response.viewportEpoch !== pending.viewportEpoch ||
          response.fontRevision !== this.#fontRevision
        ) {
          this.#stale += 1;
          this.#cancelledBatches += 1;
          pending.reject(new CanvasRenderWorkerError("Canvas render became stale", true));
          return;
        }
        this.#completed += 1;
        this.#rasterBatches += 1;
        pending.resolve({
          tileCount: pending.receivedTiles,
          durationMs: response.durationMs,
        });
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
    if (this.#worker !== worker && this.#secondaryWorker !== worker) return;
    this.#failures += 1;
    this.#lastError = "Canvas render worker failed";
    worker.terminate();
    if (this.#secondaryWorker === worker) {
      this.#secondaryWorker = null;
    } else if (this.#secondaryWorker) {
      this.#worker = this.#secondaryWorker;
      this.#secondaryWorker = null;
    } else {
      this.#worker = null;
      this.#failed = true;
      this.#rasterAvailable = false;
    }
    this.#sourceStates.forEach((source) => source.workerStates.delete(worker));
    for (const [requestId, pending] of this.#pending) {
      if (pending.worker !== worker) continue;
      this.#pending.delete(requestId);
      pending.reject(new CanvasRenderWorkerError("Canvas render worker failed", false));
    }
  }

  #scheduleSecondaryRetirement() {
    if (!this.#secondaryWorker || this.#secondaryIdleTimer !== null) return;
    this.#secondaryIdleTimer = setTimeout(() => {
      this.#secondaryIdleTimer = null;
      const worker = this.#secondaryWorker;
      if (!worker) return;
      const busy = [...this.#pending.values()].some(
        (pending) => pending.worker === worker
      );
      if (busy) {
        this.#scheduleSecondaryRetirement();
        return;
      }
      worker.postMessage({ type: "dispose" } satisfies CanvasRenderWorkerRequest);
      worker.terminate();
      this.#secondaryWorker = null;
      this.#sourceStates.forEach((source) => source.workerStates.delete(worker));
    }, 5_000);
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
