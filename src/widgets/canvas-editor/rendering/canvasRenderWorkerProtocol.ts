import type { CellPlaneOperation, CellPlaneRow } from "@/domains/canvas/public";
import type { NodeBounds } from "@/shared/types";
import type { CanvasContentLod } from "./canvasLod";
import type { CanvasWorkerFontFace } from "./canvasWorkerFonts";

export type CanvasRenderTileSpec = {
  key: string;
  bounds: NodeBounds;
  renderBounds: NodeBounds;
  rasterZoom: number;
  rasterDpr: number;
  lod: CanvasContentLod;
  priority?: "visible" | "prefetch";
};

export type CanvasRenderedTile = {
  key: string;
  bounds: NodeBounds;
  bitmap: ImageBitmap;
  bytes: number;
};

export type CanvasRenderWorkerResourceStats = {
  sourcePayloadBytes: number;
  sourceResidentBytes: number;
  sources: number;
  queuedBatches: number;
  queuedTiles: number;
  loadedFontFaces: number;
};

export type CanvasRenderWorkerRequest =
  | {
      type: "configure";
      fontRevision: string;
      fontFaces: readonly CanvasWorkerFontFace[];
    }
  | {
      type: "sync";
      sourceId: number;
      revision: number;
      operations: readonly CellPlaneOperation[];
    }
  | {
      type: "append";
      sourceId: number;
      revision: number;
      operations: readonly CellPlaneOperation[];
    }
  | {
      type: "project";
      requestId: number;
      sourceId: number;
      revision: number;
      bounds: NodeBounds;
    }
  | {
      type: "renderBatch";
      requestId: number;
      sourceId: number;
      revision: number;
      paneId: string;
      viewportEpoch: number;
      fontRevision: string;
      tiles: readonly CanvasRenderTileSpec[];
    }
  | { type: "cancelPane"; paneId: string }
  | { type: "release"; sourceId: number }
  | { type: "dispose" };

export type CanvasRenderWorkerResponse =
  | {
      type: "configured";
      rasterAvailable: boolean;
      fontRevision: string;
      reason?: string;
    }
  | {
      type: "resources";
      stats: CanvasRenderWorkerResourceStats;
    }
  | {
      type: "projected";
      requestId: number;
      sourceId: number;
      revision: number;
      rows: readonly CellPlaneRow[];
      durationMs: number;
    }
  | {
      type: "renderedTile";
      requestId: number;
      sourceId: number;
      revision: number;
      paneId: string;
      viewportEpoch: number;
      fontRevision: string;
      tile: CanvasRenderedTile;
      durationMs: number;
      queueLatencyMs: number;
    }
  | {
      type: "renderedBatchComplete";
      requestId: number;
      sourceId: number;
      revision: number;
      paneId: string;
      viewportEpoch: number;
      fontRevision: string;
      tileCount: number;
      durationMs: number;
    }
  | {
      type: "stale" | "font-error" | "unsupported" | "error";
      requestId: number;
      sourceId: number;
      revision: number;
      error?: string;
      cancelledTiles?: number;
    };
