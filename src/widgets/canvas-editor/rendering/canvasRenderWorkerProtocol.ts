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
};

export type CanvasRenderedTile = {
  key: string;
  bounds: NodeBounds;
  bitmap: ImageBitmap;
  bytes: number;
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
      type: "projected";
      requestId: number;
      sourceId: number;
      revision: number;
      rows: readonly CellPlaneRow[];
      durationMs: number;
    }
  | {
      type: "renderedBatch";
      requestId: number;
      sourceId: number;
      revision: number;
      paneId: string;
      viewportEpoch: number;
      fontRevision: string;
      tiles: readonly CanvasRenderedTile[];
      durationMs: number;
    }
  | {
      type: "stale" | "font-error" | "unsupported" | "error";
      requestId: number;
      sourceId: number;
      revision: number;
      error?: string;
    };
