import * as Y from "yjs";
import type { CollaborationIntegrityIssue } from "@/domains/collaboration/public";
import type {
  StructuredComponentInstance,
  StructuredNode,
} from "@/domains/structured-content/public";
import type { GridCell } from "@/shared/types";
import {
  CellPlaneIndex,
  cellPlanePatchToOperation,
  gridChangesToCellPlaneOperation,
  gridEntriesToCellPlaneOperation,
  isCellPlaneOperation,
  type CellPlaneOperation,
  type CellPlanePatch,
  type CanvasSurfaceReader,
} from "../cell-plane/model";
import { areJsonValuesEqual } from "@/shared/utils/equality";
import { GridManager } from "@/shared/utils/grid";
import type { CanvasMode } from "@/domains/sessions/public";
import {
  createCanvasYPage,
  getCanvasDocumentRoot,
  getDefaultCanvasPageId,
  readCanvasPageOrder,
  readCanvasYPage,
  writeCanvasDocumentMetadata,
  type CanvasDocumentAddress,
  type CanvasDocumentDraft,
  type CanvasPageDescriptor,
  type CanvasPageDraft,
  type CanvasYDocumentRoot,
  type CanvasYPage,
} from "./canvasDocumentModel";
export type CanvasHistoryMode = "save" | "merge" | "none" | "reset";
export type CanvasHistoryCheckpoint = {
  commit: () => void;
  cancel: () => void;
};

const LOCAL_ORIGIN = Symbol("canvas-local-origin");
const HISTORY_IGNORED_ORIGIN = Symbol("canvas-history-ignored");

export type CanvasDocumentSeed = {
  grid: [string, GridCell][];
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
  mode?: CanvasMode;
  activePageId?: string;
  pages?: CanvasPageDraft[];
};

type CanvasDocumentLifecycle = {
  onCreate: (id: string, doc: Y.Doc) => void;
  onDelete: (id: string) => void;
};

type CanvasPageRuntime = CanvasYPage & {
  cellPlaneIndex: CellPlaneIndex;
  undoManager: Y.UndoManager;
};

type CanvasYDocument = {
  id: string;
  doc: Y.Doc;
  root: CanvasYDocumentRoot;
  pages: Map<string, CanvasPageRuntime>;
  activePageId: string;
  operations: Y.Array<CellPlaneOperation>;
  cellPlaneIndex: CellPlaneIndex;
  scene: Y.Map<StructuredNode>;
  components: Y.Map<StructuredComponentInstance>;
  meta: Y.Map<unknown>;
  integrityIssues: Map<string, CollaborationIntegrityIssue>;
  undoManager: Y.UndoManager;
};

type CanvasDocumentTransaction = {
  address: CanvasDocumentAddress;
  sceneChanged: boolean;
  componentsChanged: boolean;
  contentChanged: boolean;
  pagesChanged: boolean;
};

type CanvasGridWriter = {
  get: (key: string) => GridCell | undefined;
  set: (key: string, value: GridCell) => void;
  delete: (key: string) => void;
  clear: () => void;
};

const applyYMapValueDiff = <T extends { id: string }>(
  map: Y.Map<T>,
  values: T[]
) => {
  const nextIds = new Set(values.map((value) => value.id));
  Array.from(map.keys()).forEach((id) => {
    if (!nextIds.has(id)) map.delete(id);
  });
  values.forEach((value) => {
    const current = map.get(value.id);
    if (!areJsonValuesEqual(current, value)) map.set(value.id, value);
  });
};

const createProxy = <T extends object>(resolve: () => T): T =>
  new Proxy({} as T, {
    get: (_target, property) => {
      const value = resolve();
      const member = Reflect.get(value, property, value);
      return typeof member === "function" ? member.bind(value) : member;
    },
  });

const normalizeHistoryMode = (
  history: CanvasHistoryMode | boolean = "save"
): CanvasHistoryMode => {
  if (history === true) return "save";
  if (history === false) return "merge";
  return history;
};

export class CanvasDocumentRegistry {
  readonly #documents = new Map<string, CanvasYDocument>();
  readonly #activeListeners = new Set<(
    next: CanvasYDocument,
    previous: CanvasYDocument
  ) => void>();
  readonly #historyListeners = new Set<(
    availability: { canUndo: boolean; canRedo: boolean }
  ) => void>();
  #active: CanvasYDocument;
  #lifecycle: CanvasDocumentLifecycle | null = null;
  #operationSequence = 0;
  #disposed = false;

  readonly yCellPlaneOperations: Y.Array<CellPlaneOperation>;
  readonly yStructuredScene: Y.Map<StructuredNode>;
  readonly yStructuredComponents: Y.Map<StructuredComponentInstance>;

  constructor(initialId = "canvas-initial") {
    this.#active = this.#createDocument(initialId);
    this.#documents.set(initialId, this.#active);
    this.yCellPlaneOperations = createProxy(() => this.#active.operations);
    this.yStructuredScene = createProxy(() => this.#active.scene);
    this.yStructuredComponents = createProxy(() => this.#active.components);
  }

  getHistoryAvailability = () => ({
    canUndo: this.#active.undoManager.undoStack.length > 0,
    canRedo: this.#active.undoManager.redoStack.length > 0,
  });

  subscribeHistoryAvailability = (
    listener: (availability: { canUndo: boolean; canRedo: boolean }) => void
  ) => {
    this.#historyListeners.add(listener);
    return () => this.#historyListeners.delete(listener);
  };

  getActiveDocumentId = () => this.#active.id;
  getActiveAddress = (): CanvasDocumentAddress => ({
    documentId: this.#active.id,
    pageId: this.#active.activePageId,
  });
  getActivePageId = () => this.#active.activePageId;
  getDocumentAddress = (
    documentId: string,
    pageId?: string
  ): CanvasDocumentAddress | null => {
    const document = this.#documents.get(documentId);
    const resolvedPageId = pageId ?? document?.activePageId;
    return document && resolvedPageId && document.pages.has(resolvedPageId)
      ? { documentId, pageId: resolvedPageId }
      : null;
  };
  getDocument = (id: string) => this.#documents.get(id) ?? null;
  getCollaborationDocument = (id: string) => this.#documents.get(id)?.doc ?? null;
  getContentReader(): CanvasSurfaceReader;
  getContentReader(id: string, pageId?: string): CanvasSurfaceReader | null;
  getContentReader(id?: string, pageId?: string): CanvasSurfaceReader | null {
    if (!id) return this.#active.cellPlaneIndex;
    const document = this.#documents.get(id);
    if (!document) return null;
    return pageId
      ? document.pages.get(pageId)?.cellPlaneIndex ?? null
      : document.cellPlaneIndex;
  }

  getPageDescriptors = (documentId = this.#active.id): CanvasPageDescriptor[] => {
    const document = this.#documents.get(documentId);
    if (!document) return [];
    return readCanvasPageOrder(document.root).flatMap((pageId) => {
      const page = document.pages.get(pageId);
      return page ? [page.descriptor] : [];
    });
  };
  getPageDescriptor = (documentId: string, pageId: string) =>
    this.#documents.get(documentId)?.pages.get(pageId)?.descriptor ?? null;

  getDocumentDraft = (documentId = this.#active.id): CanvasDocumentDraft | null => {
    const document = this.#documents.get(documentId);
    if (!document) return null;
    const mode = document.root.meta.get("mode");
    if (mode !== "freeform" && mode !== "structured" && mode !== "slide") {
      return null;
    }
    return {
      id: document.id,
      mode,
      activePageId: document.activePageId,
      pages: readCanvasPageOrder(document.root).flatMap((pageId) => {
        const page = document.pages.get(pageId);
        if (!page) return [];
        return [{
          ...page.descriptor,
          ...(page.operations
            ? { grid: Array.from(page.cellPlaneIndex.materialize()) }
            : {
                scene: Array.from(page.scene?.values() ?? []),
                components: Array.from(page.components?.values() ?? []),
              }),
        }];
      }),
    };
  };

  activatePage = (documentId: string, pageId: string) => {
    const document = this.#documents.get(documentId);
    const page = document?.pages.get(pageId);
    if (!document || !page) return false;
    const previous = this.#active;
    this.#active = document;
    this.#setActivePage(document, pageId);
    if (document !== previous) {
      this.#activeListeners.forEach((listener) => listener(document, previous));
    }
    this.#emitHistory();
    return true;
  };

  configureDocumentLifecycle = (lifecycle: CanvasDocumentLifecycle | null) => {
    this.#lifecycle = lifecycle;
  };

  /** Installs a document that has already completed external persistence restore. */
  adoptDocument = (id: string, doc: Y.Doc) => {
    this.#assertActive();
    const previous = this.#documents.get(id);
    const wasActive = previous === this.#active;
    const next = this.#createDocument(id, undefined, doc, false);
    this.#documents.set(id, next);
    if (wasActive) {
      this.#active = next;
      this.#activeListeners.forEach((listener) => listener(next, previous));
    }
    if (previous) {
      previous.pages.forEach((page) => page.undoManager.destroy());
      previous.doc.destroy();
    }
    this.#emitHistory();
    return next;
  };

  getDocumentSeed = (
    id: string,
    mode: "freeform" | "structured",
    pageId?: string
  ): CanvasDocumentSeed | null => {
    const document = this.#documents.get(id);
    if (!document) return null;
    const page = document.pages.get(pageId ?? document.activePageId);
    if (!page) return null;
    return {
      grid:
        mode === "freeform" && page.operations
          ? Array.from(page.cellPlaneIndex.materialize().entries())
          : [],
      scene:
        mode === "structured" && page.scene
          ? Array.from(page.scene.values())
          : [],
      components:
        mode === "structured" && page.components
          ? Array.from(page.components.values())
          : [],
      mode,
      activePageId: page.descriptor.id,
    };
  };

  setIntegrityIssue = (
    channel: CollaborationIntegrityIssue["channel"],
    key: string,
    issue: CollaborationIntegrityIssue | null
  ) => {
    const pageId = issue?.pageId ?? this.#active.activePageId;
    const issueKey = `${pageId}:${channel}:${key}`;
    if (issue) {
      this.#active.integrityIssues.set(issueKey, {
        ...issue,
        pageId,
      });
    }
    else this.#active.integrityIssues.delete(issueKey);
  };

  getIntegrityIssues = () => Array.from(this.#active.integrityIssues.values());

  activateDocument = (
    id: string,
    seed: CanvasDocumentSeed,
    options?: { replace?: boolean }
  ) => {
    this.#assertActive();
    const previous = this.#active;
    let next = this.#documents.get(id);
    if (!next) {
      next = this.#createDocument(id, seed);
      this.#documents.set(id, next);
    } else if (options?.replace) {
      this.#replaceDocument(next, seed);
    }
    this.#active = next;
    const requestedPageId = seed.activePageId;
    if (requestedPageId && next.pages.has(requestedPageId)) {
      this.#setActivePage(next, requestedPageId);
    }
    if (next !== previous) {
      this.#activeListeners.forEach((listener) => listener(next!, previous));
    }
    this.#emitHistory();
    return next;
  };

  ensurePage = (
    documentId: string,
    draft: CanvasPageDraft,
    options?: { activate?: boolean }
  ) => {
    const document = this.#documents.get(documentId);
    if (!document) return false;
    if (!document.pages.has(draft.id)) {
      document.doc.transact(() => {
        createCanvasYPage(
          document.root,
          draft,
          `bootstrap:${documentId}:${draft.id}:${this.#operationSequence++}`
        );
      }, HISTORY_IGNORED_ORIGIN);
      this.#syncDocumentPages(document);
    }
    return options?.activate ? this.activatePage(documentId, draft.id) : true;
  };

  removePage = (documentId: string, pageId: string) => {
    const document = this.#documents.get(documentId);
    if (!document || document.pages.size <= 1 || !document.pages.has(pageId)) {
      return false;
    }
    const previousOrder = readCanvasPageOrder(document.root);
    document.doc.transact(() => {
      document.root.pages.delete(pageId);
      const index = document.root.pageOrder.toArray().indexOf(pageId);
      if (index >= 0) document.root.pageOrder.delete(index, 1);
    }, HISTORY_IGNORED_ORIGIN);
    this.#syncDocumentPages(document);
    if (document.activePageId === pageId) {
      const previousIndex = previousOrder.indexOf(pageId);
      const nextOrder = readCanvasPageOrder(document.root);
      const nextId = nextOrder[Math.min(previousIndex, nextOrder.length - 1)];
      if (nextId) this.#setActivePage(document, nextId);
    }
    return true;
  };

  updatePage = (
    documentId: string,
    pageId: string,
    patch: Pick<Partial<CanvasPageDescriptor>, "name" | "size">
  ) => {
    const document = this.#documents.get(documentId);
    const page = document?.pages.get(pageId);
    if (!document || !page) return false;
    document.doc.transact(() => {
      document.root.pages.set(pageId, {
        ...page.descriptor,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.size ? { size: patch.size } : {}),
      });
    }, HISTORY_IGNORED_ORIGIN);
    this.#syncDocumentPages(document);
    return true;
  };

  reorderPages = (documentId: string, pageIds: string[]) => {
    const document = this.#documents.get(documentId);
    if (!document) return false;
    const current = readCanvasPageOrder(document.root);
    if (
      current.length !== pageIds.length ||
      current.some((id) => !pageIds.includes(id))
    ) return false;
    document.doc.transact(() => {
      document.root.pageOrder.delete(0, document.root.pageOrder.length);
      document.root.pageOrder.push(pageIds);
    }, HISTORY_IGNORED_ORIGIN);
    return true;
  };

  initializeCollaborativeDocument = (
    id: string,
    seed: CanvasDocumentSeed = { grid: [], scene: [], components: [] }
  ) => {
    const previous = this.#active;
    const existing = this.#documents.get(id);
    existing?.pages.forEach((page) => page.undoManager.destroy());
    existing?.doc.destroy();
    const next = this.#createDocument(id, seed);
    this.#documents.set(id, next);
    this.#active = next;
    this.#activeListeners.forEach((listener) => listener(next, previous));
    this.#emitHistory();
    return next;
  };

  prepareDocumentForCollaboration = (
    id: string,
    mode: "freeform" | "structured"
  ) => {
    const document = this.#documents.get(id);
    if (!document) return false;
    document.doc.transact(() => {
      if (mode === "structured") {
        document.operations.delete(0, document.operations.length);
      }
      else {
        document.scene.clear();
        document.components.clear();
      }
    }, HISTORY_IGNORED_ORIGIN);
    document.undoManager.clear();
    return true;
  };

  resetDocument = (id: string, seed: CanvasDocumentSeed) => {
    const document = this.#documents.get(id);
    if (!document) return false;
    this.#replaceDocument(document, seed);
    return true;
  };

  destroyDocument = (id: string) => {
    const document = this.#documents.get(id);
    if (!document || document === this.#active) return false;
    document.pages.forEach((page) => page.undoManager.destroy());
    document.doc.destroy();
    this.#documents.delete(id);
    this.#lifecycle?.onDelete(id);
    return true;
  };

  observeActiveTransactions = (
    listener: (transaction: CanvasDocumentTransaction) => void
  ) => {
    let observed = this.#active;
    const handle = (transaction: Y.Transaction) => {
      this.#syncDocumentPages(observed);
      const change = this.#readTransaction(observed, transaction);
      if (
        change.contentChanged ||
        change.sceneChanged ||
        change.componentsChanged ||
        change.pagesChanged
      ) listener(change);
    };
    observed.doc.on("afterTransaction", handle);
    const switchListener = (next: CanvasYDocument, previous: CanvasYDocument) => {
      previous.doc.off("afterTransaction", handle);
      observed = next;
      next.doc.on("afterTransaction", handle);
    };
    this.#activeListeners.add(switchListener);
    return () => {
      this.#activeListeners.delete(switchListener);
      observed.doc.off("afterTransaction", handle);
    };
  };

  undo = () => !!this.#active.undoManager.undo();
  redo = () => !!this.#active.undoManager.redo();
  clearHistory = () => this.#active.undoManager.clear();
  finishHistoryCapture = () => this.#active.undoManager.stopCapturing();

  beginHistoryCheckpoint = (): CanvasHistoryCheckpoint => {
    const document = this.#active;
    const manager = document.undoManager;
    manager.stopCapturing();
    const undoDepth = manager.undoStack.length;
    let settled = false;
    const finish = () => {
      manager.stopCapturing();
      if (document === this.#active) this.#emitHistory();
    };
    return {
      commit: () => {
        if (settled) return;
        settled = true;
        finish();
      },
      cancel: () => {
        if (settled) return;
        settled = true;
        manager.stopCapturing();
        let rolledBack = false;
        while (manager.undoStack.length > undoDepth) {
          if (!manager.undo()) break;
          rolledBack = true;
        }
        if (rolledBack) manager.clear(false, true);
        finish();
      },
    };
  };

  runTransaction = <Result,>(
    fn: () => Result,
    history: CanvasHistoryMode | boolean = "save"
  ): Result => this.runTransactionAt(this.getActiveAddress(), fn, history);

  runTransactionAt = <Result,>(
    address: CanvasDocumentAddress,
    fn: () => Result,
    history: CanvasHistoryMode | boolean = "save"
  ): Result => {
    const document = this.#documents.get(address.documentId);
    const page = document?.pages.get(address.pageId);
    if (!document || !page) {
      throw new Error(
        `Canvas page not found: ${address.documentId}/${address.pageId}`
      );
    }
    const mode = normalizeHistoryMode(history);
    const origin =
      mode === "none" || mode === "reset" ? HISTORY_IGNORED_ORIGIN : LOCAL_ORIGIN;
    if (mode === "save" || mode === "reset") page.undoManager.stopCapturing();
    let result!: Result;
    document.doc.transact(() => {
      result = fn();
    }, origin);
    if (mode === "save") page.undoManager.stopCapturing();
    else if (mode === "reset") page.undoManager.clear();
    return result;
  };

  mutateGrid = (
    mutation: (grid: CanvasGridWriter) => void,
    history: CanvasHistoryMode | boolean = "save"
  ) => this.mutateGridAt(this.getActiveAddress(), mutation, history);

  mutateGridAt = (
    address: CanvasDocumentAddress,
    mutation: (grid: CanvasGridWriter) => void,
    history: CanvasHistoryMode | boolean = "save"
  ) => {
    const document = this.#documents.get(address.documentId);
    const page = document?.pages.get(address.pageId);
    if (!document || !page || page.descriptor.kind !== "cell-plane") {
      throw new Error(
        `Cell Plane page not found: ${address.documentId}/${address.pageId}`
      );
    }
    return this.runTransactionAt(address, () => {
      const reader = page.cellPlaneIndex;
      const changes = new Map<
        string,
        { before?: GridCell; after?: GridCell }
      >();
      const remember = (key: string) => {
        if (changes.has(key)) return;
        const before = reader.getCell(GridManager.fromKey(key));
        changes.set(key, before ? { before } : {});
      };
      const read = (key: string) => {
        const changed = changes.get(key);
        return changed ? changed.after : reader.getCell(GridManager.fromKey(key));
      };
      const writer: CanvasGridWriter = {
        get: read,
        set: (key, value) => {
          remember(key);
          changes.get(key)!.after = value;
        },
        delete: (key) => {
          remember(key);
          delete changes.get(key)!.after;
        },
        clear: () => {
          reader.materialize().forEach((_cell, key) => {
            remember(key);
            delete changes.get(key)!.after;
          });
        },
      };
      mutation(writer);
      changes.forEach((change, key) => {
        if (areJsonValuesEqual(change.before, change.after)) changes.delete(key);
      });
      const operation = gridChangesToCellPlaneOperation(
        `${document.doc.clientID}:${this.#operationSequence++}`,
        changes
      );
      if (operation) page.operations.push([operation]);
    }, history);
  };

  applyCellPlanePatch = (
    patch: CellPlanePatch,
    history: CanvasHistoryMode | boolean = "save"
  ) => this.applyCellPlanePatchAt(this.getActiveAddress(), patch, history);

  applyCellPlanePatchAt = (
    address: CanvasDocumentAddress,
    patch: CellPlanePatch,
    history: CanvasHistoryMode | boolean = "save"
  ) => {
    const document = this.#documents.get(address.documentId);
    const page = document?.pages.get(address.pageId);
    if (!document || !page || page.descriptor.kind !== "cell-plane") {
      throw new Error(
        `Cell Plane page not found: ${address.documentId}/${address.pageId}`
      );
    }
    const operation = cellPlanePatchToOperation(
      `${document.doc.clientID}:${this.#operationSequence++}`,
      patch
    );
    if (!operation) return null;
    this.runTransactionAt(address, () => {
      page.operations.push([operation]);
    }, history);
    return operation;
  };

  replaceStructuredContent = (
    scene: StructuredNode[],
    components: StructuredComponentInstance[],
    history: CanvasHistoryMode | boolean = "save"
  ) => this.replaceStructuredContentAt(
    this.getActiveAddress(),
    scene,
    components,
    history
  );

  replaceStructuredContentAt = (
    address: CanvasDocumentAddress,
    scene: StructuredNode[],
    components: StructuredComponentInstance[],
    history: CanvasHistoryMode | boolean = "save"
  ) => {
    const document = this.#documents.get(address.documentId);
    const page = document?.pages.get(address.pageId);
    if (!document || !page) {
      throw new Error(
        `Structured page not found: ${address.documentId}/${address.pageId}`
      );
    }
    if (page.descriptor.kind !== "structured") {
      return this.replacePage(address.documentId, {
        ...page.descriptor,
        kind: "structured",
        scene,
        components,
      });
    }
    return this.runTransactionAt(address, () => {
      applyYMapValueDiff(page.scene, scene);
      applyYMapValueDiff(page.components, components);
    }, history);
  };

  replaceCellPage = (
    address: CanvasDocumentAddress,
    entries: [string, GridCell][]
  ) => {
    const document = this.#documents.get(address.documentId);
    const page = document?.pages.get(address.pageId);
    if (!page || page.descriptor.kind !== "cell-plane") return false;
    this.runTransactionAt(address, () => {
      page.operations.delete(0, page.operations.length);
      const bootstrap = gridEntriesToCellPlaneOperation(
        `bootstrap:${address.documentId}:${address.pageId}:${this.#operationSequence++}`,
        entries
      );
      if (bootstrap) page.operations.push([bootstrap]);
    }, "reset");
    return true;
  };

  replacePage = (documentId: string, draft: CanvasPageDraft) => {
    const document = this.#documents.get(documentId);
    const page = document?.pages.get(draft.id);
    if (!document || !page) return false;
    if (page.descriptor.kind !== draft.kind) {
      document.doc.transact(() => {
        page.operations.delete(0, page.operations.length);
        page.scene.clear();
        page.components.clear();
        document.root.pages.set(draft.id, {
          id: draft.id,
          kind: draft.kind,
          ...(draft.name ? { name: draft.name } : {}),
          ...(draft.size ? { size: draft.size } : {}),
        });
        if (draft.kind === "cell-plane") {
          const bootstrap = gridEntriesToCellPlaneOperation(
            `replace:${documentId}:${draft.id}:${this.#operationSequence++}`,
            draft.grid ?? []
          );
          if (bootstrap) page.operations.push([bootstrap]);
        } else {
          draft.scene?.forEach((node) => page.scene.set(node.id, node));
          draft.components?.forEach((component) =>
            page.components.set(component.id, component)
          );
        }
      }, HISTORY_IGNORED_ORIGIN);
      page.undoManager.destroy();
      document.pages.delete(draft.id);
      this.#syncDocumentPages(document);
      return true;
    }
    this.updatePage(documentId, draft.id, {
      ...(draft.name !== undefined ? { name: draft.name } : {}),
      ...(draft.size ? { size: draft.size } : {}),
    });
    if (draft.kind === "cell-plane") {
      return this.replaceCellPage(
        { documentId, pageId: draft.id },
        draft.grid ?? []
      );
    }
    this.replaceStructuredContentAt(
      { documentId, pageId: draft.id },
      draft.scene ?? [],
      draft.components ?? [],
      "reset"
    );
    return true;
  };

  dispose = () => {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#activeListeners.clear();
    this.#historyListeners.clear();
    this.#documents.forEach((document) => {
      document.pages.forEach((page) => page.undoManager.destroy());
      document.doc.destroy();
    });
    this.#documents.clear();
  };

  #createDocument(
    id: string,
    seed?: CanvasDocumentSeed,
    source?: Y.Doc,
    notifyLifecycle = true
  ): CanvasYDocument {
    const doc = source ?? new Y.Doc({ guid: id });
    const root = getCanvasDocumentRoot(doc);
    const legacyOperations = doc.share.get("cell-plane-operations");
    const legacyScene = doc.share.get("structured-scene");
    const legacyComponents = doc.share.get("structured-components");
    const storedMode = root.meta.get("mode");
    const inferredMode: CanvasMode =
      seed?.mode ??
      (storedMode === "freeform" || storedMode === "structured" || storedMode === "slide"
        ? storedMode
        : legacyScene instanceof Y.Map && legacyScene.size > 0
          ? "structured"
          : seed?.scene.length
            ? "structured"
            : "freeform");
    if (root.pages.size === 0) {
      doc.transact(() => {
        const pages = seed?.pages?.length
          ? seed.pages
          : [{
              id: seed?.activePageId ?? getDefaultCanvasPageId(id),
              kind: inferredMode === "structured" ? "structured" as const : "cell-plane" as const,
              grid:
                seed?.grid ??
                (legacyOperations instanceof Y.Array
                  ? Array.from(new CellPlaneIndex(
                      legacyOperations.toArray().filter(isCellPlaneOperation)
                    ).materialize())
                  : []),
              scene:
                seed?.scene ??
                (legacyScene instanceof Y.Map
                  ? Array.from(legacyScene.values()) as StructuredNode[]
                  : []),
              components:
                seed?.components ??
                (legacyComponents instanceof Y.Map
                  ? Array.from(legacyComponents.values()) as StructuredComponentInstance[]
                  : []),
            }];
        pages.forEach((page) =>
          createCanvasYPage(
            root,
            page,
            `bootstrap:${id}:${page.id}:${this.#operationSequence++}`
          )
        );
        const activePageId =
          seed?.activePageId && pages.some((page) => page.id === seed.activePageId)
            ? seed.activePageId
            : pages[0]!.id;
        writeCanvasDocumentMetadata(root, id, inferredMode, activePageId);
        if (legacyOperations instanceof Y.Array) {
          legacyOperations.delete(0, legacyOperations.length);
        }
        if (legacyScene instanceof Y.Map) legacyScene.clear();
        if (legacyComponents instanceof Y.Map) legacyComponents.clear();
      }, HISTORY_IGNORED_ORIGIN);
    }
    const integrityIssues = new Map<string, CollaborationIntegrityIssue>();
    const document: CanvasYDocument = {
      id,
      doc,
      root,
      pages: new Map(),
      activePageId: "",
      operations: null!,
      cellPlaneIndex: null!,
      scene: null!,
      components: null!,
      meta: root.meta,
      integrityIssues,
      undoManager: null!,
    };
    this.#syncDocumentPages(document);
    if (seed?.activePageId && document.pages.has(seed.activePageId)) {
      this.#setActivePage(document, seed.activePageId);
    }
    if (notifyLifecycle) this.#lifecycle?.onCreate(id, doc);
    return document;
  }

  #createPageRuntime(
    document: CanvasYDocument,
    page: CanvasYPage
  ): CanvasPageRuntime {
    const { operations, scene, components } = page;
    const rebuildContentIndex = () => {
      const valid: CellPlaneOperation[] = [];
      operations.toArray().forEach((operation, index) => {
        const key = String(index);
        const issueKey = `${page.descriptor.id}:cell-plane-operations:${key}`;
        if (isCellPlaneOperation(operation)) {
          document.integrityIssues.delete(issueKey);
          valid.push(operation);
        } else {
          document.integrityIssues.set(issueKey, {
            channel: "cell-plane-operations",
            key,
            pageId: page.descriptor.id,
            reason: "Invalid CellPlane operation",
          });
        }
      });
      return new CellPlaneIndex(valid);
    };
    const runtime: CanvasPageRuntime = {
      ...page,
      cellPlaneIndex: rebuildContentIndex(),
      undoManager: new Y.UndoManager(
        page.descriptor.kind === "cell-plane"
          ? [operations]
          : [scene, components],
        {
          captureTimeout: 500,
          trackedOrigins: new Set([LOCAL_ORIGIN]),
        }
      ),
    };
    operations.observe((event) => {
      const delta = event.changes.delta;
      const insertedCount = delta.reduce(
        (count, item) => count + (item.insert?.length ?? 0),
        0
      );
      const deletedCount = delta.reduce(
        (count, item) => count + (item.delete ?? 0),
        0
      );
      const previousLength = operations.length - insertedCount + deletedCount;
      let position = 0;
      let appendOnly = deletedCount === 0;
      const appended: CellPlaneOperation[] = [];
      for (const item of delta) {
        position += item.retain ?? 0;
        if (item.insert) {
          if (position !== previousLength + appended.length) appendOnly = false;
          appended.push(...item.insert);
          position += item.insert.length;
        }
      }
      if (appendOnly && appended.every(isCellPlaneOperation)) {
        appended.forEach((operation) => runtime.cellPlaneIndex.append(operation));
      } else {
        runtime.cellPlaneIndex = rebuildContentIndex();
        if (
          document === this.#active &&
          runtime.descriptor.id === document.activePageId
        ) {
          document.cellPlaneIndex = runtime.cellPlaneIndex;
        }
      }
    });
    const notify = () => {
      if (
        document === this.#active &&
        runtime.descriptor.id === document.activePageId
      ) this.#emitHistory();
    };
    runtime.undoManager.on("stack-item-added", notify);
    runtime.undoManager.on("stack-item-popped", notify);
    runtime.undoManager.on("stack-cleared", notify);
    runtime.undoManager.on("stack-item-updated", notify);
    return runtime;
  }

  #syncDocumentPages(document: CanvasYDocument) {
    const nextPages = new Map<string, CanvasPageRuntime>();
    for (const pageId of readCanvasPageOrder(document.root)) {
      const page = readCanvasYPage(document.root, pageId);
      if (!page) continue;
      const existing = document.pages.get(pageId);
      if (
        existing?.operations === page.operations &&
        existing.descriptor.kind === page.descriptor.kind
      ) {
        existing.descriptor = page.descriptor;
        nextPages.set(pageId, existing);
      } else {
        nextPages.set(pageId, this.#createPageRuntime(document, page));
      }
    }
    document.pages.forEach((page, pageId) => {
      if (!nextPages.has(pageId)) page.undoManager.destroy();
    });
    document.pages = nextPages;
    const storedActivePageId = document.root.meta.get("activePageId");
    const nextActivePageId =
      document.activePageId && nextPages.has(document.activePageId)
        ? document.activePageId
        : typeof storedActivePageId === "string" && nextPages.has(storedActivePageId)
        ? storedActivePageId
        : nextPages.keys().next().value;
    if (!nextActivePageId) {
      throw new Error(`Canvas document has no valid pages: ${document.id}`);
    }
    this.#setActivePage(document, nextActivePageId);
  }

  #setActivePage(document: CanvasYDocument, pageId: string) {
    const page = document.pages.get(pageId);
    if (!page) throw new Error(`Canvas page not found: ${document.id}/${pageId}`);
    document.activePageId = pageId;
    document.operations = page.operations;
    document.cellPlaneIndex = page.cellPlaneIndex;
    document.scene = page.scene;
    document.components = page.components;
    document.undoManager = page.undoManager;
  }

  #replaceDocument(document: CanvasYDocument, seed: CanvasDocumentSeed) {
    const mode =
      seed.mode ?? (seed.scene.length > 0 ? "structured" : "freeform");
    const pages = seed.pages?.length
      ? seed.pages
      : [{
          id: seed.activePageId ?? getDefaultCanvasPageId(document.id),
          kind: mode === "structured" ? "structured" as const : "cell-plane" as const,
          grid: seed.grid,
          scene: seed.scene,
          components: seed.components,
        }];
    document.pages.forEach((page) => page.undoManager.destroy());
    document.doc.transact(() => {
      document.root.pages.clear();
      document.root.pageOrder.delete(0, document.root.pageOrder.length);
      pages.forEach((page) =>
        createCanvasYPage(
          document.root,
          page,
          `bootstrap:${document.id}:${page.id}:${this.#operationSequence++}`
        )
      );
      const activePageId =
        seed.activePageId && pages.some((page) => page.id === seed.activePageId)
          ? seed.activePageId
          : pages[0]!.id;
      writeCanvasDocumentMetadata(document.root, document.id, mode, activePageId);
    }, HISTORY_IGNORED_ORIGIN);
    document.pages = new Map();
    this.#syncDocumentPages(document);
  }

  #readTransaction(document: CanvasYDocument, transaction: Y.Transaction) {
    const change: CanvasDocumentTransaction = {
      address: {
        documentId: document.id,
        pageId: document.activePageId,
      },
      sceneChanged: false,
      componentsChanged: false,
      contentChanged: false,
      pagesChanged: false,
    };
    const activePage = document.pages.get(document.activePageId);
    for (const [type] of transaction.changed) {
      if (Object.is(type, activePage?.operations)) change.contentChanged = true;
      else if (Object.is(type, activePage?.scene)) change.sceneChanged = true;
      else if (Object.is(type, activePage?.components)) change.componentsChanged = true;
      else if (
        Object.is(type, document.root.pages) ||
        Object.is(type, document.root.pageOrder)
      ) change.pagesChanged = true;
    }
    return change;
  }

  #emitHistory() {
    const availability = this.getHistoryAvailability();
    this.#historyListeners.forEach((listener) => listener(availability));
  }

  #assertActive() {
    if (this.#disposed) throw new Error("CanvasDocumentRegistry is disposed");
  }
}
