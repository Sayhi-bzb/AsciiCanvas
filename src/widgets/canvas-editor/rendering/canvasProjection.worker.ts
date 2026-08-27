/// <reference lib="webworker" />

import { CellPlaneIndex } from "@/domains/canvas/public";
import type {
  CanvasProjectionWorkerRequest,
  CanvasProjectionWorkerResponse,
} from "./canvasProjectionWorkerProtocol";

const sources = new Map<number, { revision: number; index: CellPlaneIndex }>();

const respond = (response: CanvasProjectionWorkerResponse) => {
  self.postMessage(response);
};

self.onmessage = (event: MessageEvent<CanvasProjectionWorkerRequest>) => {
  const request = event.data;
  if (request.type === "sync") {
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
    request.operations.forEach((operation) => source.index.append(operation));
    source.revision = request.revision;
    return;
  }
  if (request.type === "release") {
    sources.get(request.sourceId)?.index.dispose();
    sources.delete(request.sourceId);
    return;
  }
  if (request.type === "dispose") {
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
};
