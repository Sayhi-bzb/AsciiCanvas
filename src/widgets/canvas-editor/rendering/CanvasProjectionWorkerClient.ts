import {
  CellPlaneIndex,
  type CellPlaneRow,
} from "@/domains/canvas/public";
import type { NodeBounds } from "@/shared/types";
import type {
  CanvasProjectionWorkerRequest,
  CanvasProjectionWorkerResponse,
} from "./canvasProjectionWorkerProtocol";

type PendingProjection = {
  resolve: (rows: readonly CellPlaneRow[]) => void;
  reject: (error: Error) => void;
  sourceId: number;
  revision: number;
};

type SourceState = {
  id: number;
  revision: number;
  operationCount: number;
};

export class CanvasProjectionWorkerError extends Error {
  readonly recoverable: boolean;

  constructor(message: string, recoverable: boolean) {
    super(message);
    this.name = "CanvasProjectionWorkerError";
    this.recoverable = recoverable;
  }
}

export type CanvasProjectionWorkerStats = {
  available: boolean;
  sources: number;
  pending: number;
  requests: number;
  completed: number;
  stale: number;
  failures: number;
  workerDurationMs: number;
};

export class CanvasProjectionWorkerClient {
  readonly #sources = new WeakMap<CellPlaneIndex, SourceState>();
  readonly #retainers = new WeakMap<CellPlaneIndex, number>();
  readonly #sourceIds = new Set<number>();
  readonly #pending = new Map<number, PendingProjection>();
  #worker: Worker | null = null;
  #nextSourceId = 1;
  #nextRequestId = 1;
  #disposed = false;
  #failed = false;
  #requests = 0;
  #completed = 0;
  #stale = 0;
  #failures = 0;
  #workerDurationMs = 0;

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
        resolve,
        reject,
        sourceId: source.id,
        revision: source.revision,
      });
    });
    worker.postMessage({
      type: "project",
      requestId,
      sourceId: source.id,
      revision: source.revision,
      bounds,
    } satisfies CanvasProjectionWorkerRequest);
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
      this.release(reader);
    };
  }

  release(reader: CellPlaneIndex) {
    const source = this.#sources.get(reader);
    if (!source) return;
    this.#sources.delete(reader);
    this.#sourceIds.delete(source.id);
    this.#worker?.postMessage({
      type: "release",
      sourceId: source.id,
    } satisfies CanvasProjectionWorkerRequest);
    this.#rejectSource(
      source.id,
      new CanvasProjectionWorkerError("Canvas projection source released", true)
    );
  }

  getStats(): CanvasProjectionWorkerStats {
    return {
      available: !this.#disposed && !this.#failed && typeof Worker !== "undefined",
      sources: this.#sourceIds.size,
      pending: this.#pending.size,
      requests: this.#requests,
      completed: this.#completed,
      stale: this.#stale,
      failures: this.#failures,
      workerDurationMs: this.#workerDurationMs,
    };
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#worker?.postMessage({ type: "dispose" } satisfies CanvasProjectionWorkerRequest);
    this.#worker?.terminate();
    this.#worker = null;
    this.#sourceIds.clear();
    this.#rejectPending(new Error("Canvas projection worker disposed"));
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
      } satisfies CanvasProjectionWorkerRequest);
      return source;
    }
    if (source.revision === revision) return source;
    if (operationCount >= source.operationCount && revision >= source.revision) {
      worker.postMessage({
        type: "append",
        sourceId: source.id,
        revision,
        operations: reader.getOperationsSince(source.operationCount),
      } satisfies CanvasProjectionWorkerRequest);
    } else {
      worker.postMessage({
        type: "sync",
        sourceId: source.id,
        revision,
        operations: reader.getOperationsSince(0),
      } satisfies CanvasProjectionWorkerRequest);
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
        new URL("./canvasProjection.worker.ts", import.meta.url),
        { type: "module", name: "chardesk-canvas-projection" }
      );
    } catch {
      this.#failed = true;
      this.#failures += 1;
      return null;
    }
    worker.onmessage = (event: MessageEvent<CanvasProjectionWorkerResponse>) => {
      const response = event.data;
      const pending = this.#pending.get(response.requestId);
      if (!pending) return;
      this.#pending.delete(response.requestId);
      if (
        pending.sourceId !== response.sourceId ||
        pending.revision !== response.revision ||
        response.type === "stale"
      ) {
        this.#stale += 1;
        pending.reject(
          new CanvasProjectionWorkerError("Canvas projection became stale", true)
        );
        return;
      }
      if (response.type === "error") {
        this.#failures += 1;
        pending.reject(
          new CanvasProjectionWorkerError(
            response.error ?? "Canvas projection failed",
            false
          )
        );
        return;
      }
      if (response.type !== "projected") {
        this.#stale += 1;
        pending.reject(
          new CanvasProjectionWorkerError("Canvas projection became stale", true)
        );
        return;
      }
      this.#completed += 1;
      this.#workerDurationMs += response.durationMs;
      pending.resolve(response.rows);
    };
    worker.onerror = () => this.#failWorker(worker);
    worker.onmessageerror = () => this.#failWorker(worker);
    this.#worker = worker;
    return worker;
  }

  #failWorker(worker: Worker) {
    if (this.#worker !== worker) return;
    this.#failed = true;
    this.#failures += 1;
    worker.terminate();
    this.#worker = null;
    this.#sourceIds.clear();
    this.#rejectPending(
      new CanvasProjectionWorkerError("Canvas projection worker failed", false)
    );
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
