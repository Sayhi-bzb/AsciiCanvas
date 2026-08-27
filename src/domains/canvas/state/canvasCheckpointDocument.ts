import * as Y from "yjs";
import type { CanvasMode } from "@/domains/sessions/public";
import type {
  StructuredComponentInstance,
  StructuredNode,
} from "@/domains/structured-content/public";
import type { GridCell } from "@/shared/types";
import {
  CellPlaneIndex,
  type CellPlaneOperation,
} from "../cell-plane/model";
import type { CanvasDocumentSeed } from "./CanvasDocumentRegistry";
import {
  createCanvasYPage,
  getCanvasDocumentRoot,
  getDefaultCanvasPageId,
  readCanvasPageOrder,
  readCanvasYPage,
  writeCanvasDocumentMetadata,
  type CanvasPageDescriptor,
  type CanvasPageDraft,
} from "./canvasDocumentModel";

type CanvasCheckpointSourcePage =
  | {
      descriptor: CanvasPageDescriptor & { kind: "cell-plane" };
      operations: readonly CellPlaneOperation[];
    }
  | {
      descriptor: CanvasPageDescriptor & { kind: "structured" };
      scene: readonly StructuredNode[];
      components: readonly StructuredComponentInstance[];
    };

export type CanvasCheckpointSource = {
  mode: CanvasMode;
  activePageId: string;
  pages: readonly CanvasCheckpointSourcePage[];
};

export const resolveSeedPages = (
  id: string,
  seed: CanvasDocumentSeed
): CanvasPageDraft[] => {
  if (seed.pages?.length) return seed.pages;
  const kind = seed.mode === "structured" ? "structured" : "cell-plane";
  return [{
    id: seed.activePageId ?? getDefaultCanvasPageId(id),
    kind,
    ...(kind === "structured"
      ? { scene: seed.scene, components: seed.components ?? [] }
      : { grid: seed.grid }),
  }];
};

export const applyCanvasDocumentSeed = (
  doc: Y.Doc,
  id: string,
  seed: CanvasDocumentSeed
) => {
  doc.transact(() => {
    const root = getCanvasDocumentRoot(doc);
    const pages = resolveSeedPages(id, seed);
    pages.forEach((page) =>
      createCanvasYPage(root, page, `bootstrap:${id}:${page.id}`)
    );
    const activePageId =
      seed.activePageId && pages.some((page) => page.id === seed.activePageId)
        ? seed.activePageId
        : pages[0]!.id;
    writeCanvasDocumentMetadata(
      root,
      id,
      seed.mode ?? (pages[0]!.kind === "structured" ? "structured" : "freeform"),
      activePageId
    );
  }, "local-persistence-bootstrap");
};

const captureCanvasCheckpointSource = (
  doc: Y.Doc,
  id: string
): CanvasCheckpointSource => {
  const root = getCanvasDocumentRoot(doc);
  const pages = readCanvasPageOrder(root).flatMap((pageId): CanvasCheckpointSourcePage[] => {
    const page = readCanvasYPage(root, pageId);
    if (!page) return [];
    return page.descriptor.kind === "cell-plane"
      ? [{
          descriptor: { ...page.descriptor, kind: "cell-plane" },
          operations: page.operations.toArray(),
        }]
      : [{
          descriptor: { ...page.descriptor, kind: "structured" },
          scene: Array.from(page.scene.values()),
          components: Array.from(page.components.values()),
        }];
  });
  if (pages.length === 0) {
    throw new Error(`Canvas document compaction found no pages: ${id}`);
  }
  const storedMode = root.meta.get("mode");
  const mode: CanvasMode =
    storedMode === "freeform" || storedMode === "structured" || storedMode === "slide"
      ? storedMode
      : pages[0]!.descriptor.kind === "structured" ? "structured" : "freeform";
  const storedActivePageId = root.meta.get("activePageId");
  return {
    mode,
    activePageId:
      typeof storedActivePageId === "string" &&
      pages.some(({ descriptor }) => descriptor.id === storedActivePageId)
        ? storedActivePageId
        : pages[0]!.descriptor.id,
    pages,
  };
};

export const materializeCanvasCheckpointSource = (
  source: CanvasCheckpointSource
): CanvasDocumentSeed => ({
  mode: source.mode,
  activePageId: source.activePageId,
  pages: source.pages.map((page): CanvasPageDraft => {
    if ("operations" in page) {
      const index = new CellPlaneIndex(page.operations);
      const grid = Array.from(index.materialize()) as [string, GridCell][];
      index.dispose();
      return { ...page.descriptor, grid };
    }
    return {
      ...page.descriptor,
      scene: [...page.scene],
      components: [...page.components],
    };
  }),
  grid: [],
  scene: [],
  components: [],
});

export const readDocumentSeed = (doc: Y.Doc, id: string) =>
  materializeCanvasCheckpointSource(captureCanvasCheckpointSource(doc, id));

export const createCompactedDocument = (doc: Y.Doc, id: string) => {
  const compacted = new Y.Doc({ guid: id });
  applyCanvasDocumentSeed(compacted, id, readDocumentSeed(doc, id));
  return compacted;
};
