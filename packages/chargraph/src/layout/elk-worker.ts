/// <reference lib="webworker" />

import ElkBundled from "elkjs/lib/elk.bundled.js";
import type { ELK } from "elkjs/lib/elk-api.js";
import { layoutWithElk } from "./elk-adapter.js";
import type { LayoutGraph } from "./model.js";

const ElkConstructor = ElkBundled as unknown as new () => ELK;
const elk = new ElkConstructor();
const worker = globalThis as unknown as DedicatedWorkerGlobalScope;

worker.addEventListener("message", async (event: MessageEvent<{
  id: number;
  graph: LayoutGraph;
}>) => {
  try {
    const layout = await layoutWithElk(event.data.graph, elk);
    worker.postMessage({ id: event.data.id, layout });
  } catch (error) {
    worker.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : "ELK layout failed",
    });
  }
});
