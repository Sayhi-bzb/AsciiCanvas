import type { ELK } from "elkjs/lib/elk-api.js";
import { layoutWithElk } from "./elk-adapter.js";
import type { GraphLayoutEngine, GridLayout, LayoutGraph } from "./model.js";

interface WorkerLike {
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "error", listener: (event: { message?: string }) => void): void;
  postMessage(value: unknown): void;
  terminate(): void;
}

declare const Worker: {
  new (url: URL, options: { type: "module" }): WorkerLike;
};

const createBrowserWorker = (): WorkerLike | undefined => {
  if (typeof Worker === "undefined") return undefined;
  try {
    return new Worker(new URL("./elk-worker.js", import.meta.url), { type: "module" });
  } catch {
    return undefined;
  }
};

class ElkWorkerEngine implements GraphLayoutEngine {
  private readonly worker: WorkerLike;
  private readonly pending = new Map<number, {
    resolve(layout: GridLayout): void;
    reject(error: Error): void;
  }>();
  private nextId = 1;

  constructor(worker: WorkerLike) {
    this.worker = worker;
    this.worker.addEventListener("message", (event) => {
      const data = event.data as {
        id: number;
        layout?: GridLayout;
        error?: string;
      };
      const request = this.pending.get(data.id);
      if (!request) return;
      this.pending.delete(data.id);
      if (data.layout) request.resolve(data.layout);
      else request.reject(new Error(data.error ?? "ELK layout failed"));
    });
    this.worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "ELK layout worker failed");
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    });
  }

  layout(graph: LayoutGraph): Promise<GridLayout> {
    const id = this.nextId++;
    const result = new Promise<GridLayout>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.worker.postMessage({ id, graph });
    return result;
  }
}

class ElkInlineEngine implements GraphLayoutEngine {
  private elk: Promise<ELK> | undefined;

  private getElk(): Promise<ELK> {
    this.elk ??= import("elkjs/lib/elk.bundled.js").then((module) => {
      const ElkConstructor = module.default as unknown as new () => ELK;
      return new ElkConstructor();
    });
    return this.elk;
  }

  async layout(graph: LayoutGraph): Promise<GridLayout> {
    return layoutWithElk(graph, await this.getElk());
  }
}

let defaultEngine: GraphLayoutEngine | undefined;

export const getDefaultGraphLayoutEngine = (): GraphLayoutEngine => {
  if (defaultEngine) return defaultEngine;
  const worker = createBrowserWorker();
  defaultEngine = worker ? new ElkWorkerEngine(worker) : new ElkInlineEngine();
  return defaultEngine;
};
