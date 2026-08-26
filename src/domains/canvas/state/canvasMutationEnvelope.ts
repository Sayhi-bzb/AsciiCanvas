import type {
  StructuredComponentInstance,
  StructuredNode,
} from "@/domains/structured-content/public";
import type { CanvasMode } from "@/domains/sessions/public";
import type { CellPlaneOperation } from "../cell-plane/model";
import type {
  CanvasPageDescriptor,
  CanvasPageDraft,
} from "./canvasDocumentModel";

type CanvasValuePatch<T extends { id: string }> = {
  upsert?: readonly T[];
  deleteIds?: readonly string[];
};

/** Semantic mutation data; it deliberately contains no Yjs item identifiers. */
export type CanvasMutationEnvelope =
  | {
      kind: "cell-plane";
      documentId: string;
      pageId: string;
      operation: CellPlaneOperation;
    }
  | {
      kind: "structured";
      documentId: string;
      pageId: string;
      nodes?: CanvasValuePatch<StructuredNode>;
      components?: CanvasValuePatch<StructuredComponentInstance>;
    }
  | {
      kind: "page-metadata";
      documentId: string;
      page: CanvasPageDescriptor;
    }
  | {
      kind: "page-order";
      documentId: string;
      pageIds: readonly string[];
      activePageId: string;
      mode: CanvasMode;
    }
  | {
      kind: "page-upsert";
      documentId: string;
      page: CanvasPageDraft;
    }
  | {
      kind: "page-delete";
      documentId: string;
      pageId: string;
    };
