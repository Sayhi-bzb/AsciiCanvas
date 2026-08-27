import type {
  CellPlaneOperation,
  CellPlaneRow,
} from "@/domains/canvas/public";
import type { NodeBounds } from "@/shared/types";

export type CanvasProjectionWorkerRequest =
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
  | { type: "release"; sourceId: number }
  | { type: "dispose" };

export type CanvasProjectionWorkerResponse =
  | {
      type: "projected";
      requestId: number;
      sourceId: number;
      revision: number;
      rows: readonly CellPlaneRow[];
      durationMs: number;
    }
  | {
      type: "stale" | "error";
      requestId: number;
      sourceId: number;
      revision: number;
      error?: string;
    };
