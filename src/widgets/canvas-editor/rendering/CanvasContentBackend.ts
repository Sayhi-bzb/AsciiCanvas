import type { CanvasSurfaceReader } from "@/domains/canvas/public";
import type { CanvasMemoryGovernor } from "./CanvasMemoryGovernor";
import {
  CanvasRasterTileCache,
  type CanvasRasterTileStats,
} from "./CanvasRasterTileCache";
import type { CanvasRenderWorkerClient } from "./CanvasRenderWorkerClient";

export interface CanvasContentBackend {
  render(...args: Parameters<CanvasRasterTileCache["draw"]>): ReturnType<CanvasRasterTileCache["draw"]>;
  retain(reader: CanvasSurfaceReader, paneId: string): () => void;
  invalidateFonts(): void;
  syncMemoryPolicy(): void;
  getStats(): CanvasContentBackendStats;
  clear(): void;
}

type CanvasContentBackendStats = CanvasRasterTileStats & {
  backend: "retained-2d";
};

/** Retained Canvas2D backend. A future GPU backend implements the same frame contract. */
export class RetainedCanvas2DContentBackend implements CanvasContentBackend {
  readonly #tiles: CanvasRasterTileCache;

  constructor(
    byteBudget?: number,
    renderWorker?: CanvasRenderWorkerClient | null,
    memoryGovernor?: CanvasMemoryGovernor
  ) {
    this.#tiles = new CanvasRasterTileCache(
      byteBudget,
      renderWorker,
      memoryGovernor
    );
  }

  render(...args: Parameters<CanvasRasterTileCache["draw"]>) {
    return this.#tiles.draw(...args);
  }

  retain(reader: CanvasSurfaceReader, paneId: string) {
    return this.#tiles.retain(reader, paneId);
  }

  invalidateFonts() {
    this.#tiles.invalidateFonts();
  }

  syncMemoryPolicy() {
    this.#tiles.syncMemoryPolicy();
  }

  getStats() {
    return { backend: "retained-2d" as const, ...this.#tiles.getStats() };
  }

  clear() {
    this.#tiles.clear();
  }
}
