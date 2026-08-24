import type { TextRenderingRuntime } from "./runtime";
import type { CompactTextRenderResult } from "./types";

const WORKER_RENDER_THRESHOLD = 50_000;

type PendingRender = {
  source: string;
  defaultColor: string;
  resolve: (result: CompactTextRenderResult) => void;
  reject: (error: Error) => void;
};

export class TextRenderingWorkerClient {
  readonly #runtime: TextRenderingRuntime;
  readonly #pending = new Map<number, PendingRender>();
  #worker: Worker | null = null;
  #nextId = 1;

  constructor(runtime: TextRenderingRuntime) {
    this.#runtime = runtime;
  }

  render = (source: string, defaultColor: string) => {
    if (source.length < WORKER_RENDER_THRESHOLD || typeof Worker === "undefined") {
      return this.#runtime.renderCompact(source, defaultColor);
    }
    const worker = this.#getWorker();
    const id = this.#nextId++;
    const result = new Promise<CompactTextRenderResult>((resolve, reject) => {
      this.#pending.set(id, { source, defaultColor, resolve, reject });
    });
    worker.postMessage({
      id,
      source,
      defaultColor,
      profile: this.#runtime.getProfile(),
    });
    return result;
  };

  dispose = () => {
    this.#worker?.terminate();
    this.#worker = null;
    const error = new Error("Text rendering worker was disposed.");
    this.#pending.forEach(({ reject }) => reject(error));
    this.#pending.clear();
  };

  #getWorker() {
    if (this.#worker) return this.#worker;
    const worker = new Worker(new URL("./render.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", (event: MessageEvent<{
      id: number;
      result?: CompactTextRenderResult;
      error?: string;
    }>) => {
      const pending = this.#pending.get(event.data.id);
      if (!pending) return;
      this.#pending.delete(event.data.id);
      if (event.data.result) pending.resolve(event.data.result);
      else pending.reject(new Error(event.data.error ?? "Text rendering failed."));
    });
    worker.addEventListener("error", () => {
      this.#pending.forEach(({ source, defaultColor, resolve, reject }) => {
        void this.#runtime.renderCompact(source, defaultColor).then(resolve, reject);
      });
      this.#pending.clear();
      worker.terminate();
      if (this.#worker === worker) this.#worker = null;
    });
    this.#worker = worker;
    return worker;
  }
}
