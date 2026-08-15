import * as Y from "yjs";
import type { CollaborationIntegrityIssue } from "@/domains/collaboration/public";
import type {
  StructuredComponentInstance,
  StructuredNode,
} from "@/domains/structured-content/public";
import type { GridCell } from "@/shared/types";
import { areJsonValuesEqual } from "@/shared/utils/equality";
import { normalizeGridCellEntries } from "@/shared/utils/grid-codec";
export type CanvasHistoryMode = "save" | "merge" | "none" | "reset";
export type CanvasHistoryCheckpoint = {
  commit: () => void;
  cancel: () => void;
};

const LOCAL_ORIGIN = Symbol("canvas-local-origin");
const HISTORY_IGNORED_ORIGIN = Symbol("canvas-history-ignored");

type CanvasDocumentSeed = {
  grid: [string, GridCell][];
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
};

type CanvasYDocument = {
  id: string;
  doc: Y.Doc;
  grid: Y.Map<GridCell>;
  scene: Y.Map<StructuredNode>;
  components: Y.Map<StructuredComponentInstance>;
  meta: Y.Map<unknown>;
  integrityIssues: Map<string, CollaborationIntegrityIssue>;
  undoManager: Y.UndoManager;
};

type CanvasDocumentTransaction = {
  gridKeysChanged: Set<string>;
  sceneChanged: boolean;
  componentsChanged: boolean;
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
  #disposed = false;

  readonly yMainGrid: Y.Map<GridCell>;
  readonly yStructuredScene: Y.Map<StructuredNode>;
  readonly yStructuredComponents: Y.Map<StructuredComponentInstance>;

  constructor(initialId = "canvas-initial") {
    this.#active = this.#createDocument(initialId);
    this.#documents.set(initialId, this.#active);
    this.yMainGrid = createProxy(() => this.#active.grid);
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
  getDocument = (id: string) => this.#documents.get(id) ?? null;
  getCollaborationDocument = (id: string) => this.#documents.get(id)?.doc ?? null;

  getDocumentSeed = (
    id: string,
    mode: "freeform" | "structured"
  ): CanvasDocumentSeed | null => {
    const document = this.#documents.get(id);
    if (!document) return null;
    return {
      grid: mode === "freeform" ? Array.from(document.grid.entries()) : [],
      scene: mode === "structured" ? Array.from(document.scene.values()) : [],
      components:
        mode === "structured" ? Array.from(document.components.values()) : [],
    };
  };

  setIntegrityIssue = (
    channel: CollaborationIntegrityIssue["channel"],
    key: string,
    issue: CollaborationIntegrityIssue | null
  ) => {
    const issueKey = `${channel}:${key}`;
    if (issue) this.#active.integrityIssues.set(issueKey, issue);
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
    if (next !== previous) {
      this.#activeListeners.forEach((listener) => listener(next!, previous));
    }
    this.#emitHistory();
    return next;
  };

  initializeCollaborativeDocument = (
    id: string,
    seed: CanvasDocumentSeed = { grid: [], scene: [], components: [] }
  ) => {
    const previous = this.#active;
    const existing = this.#documents.get(id);
    existing?.undoManager.destroy();
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
      if (mode === "structured") document.grid.clear();
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
    document.undoManager.destroy();
    document.doc.destroy();
    this.#documents.delete(id);
    return true;
  };

  observeActiveTransactions = (
    listener: (transaction: CanvasDocumentTransaction) => void
  ) => {
    let observed = this.#active;
    const handle = (transaction: Y.Transaction) => {
      const change = this.#readTransaction(observed, transaction);
      if (
        change.gridKeysChanged.size > 0 ||
        change.sceneChanged ||
        change.componentsChanged
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
  ): Result => {
    const mode = normalizeHistoryMode(history);
    const origin =
      mode === "none" || mode === "reset" ? HISTORY_IGNORED_ORIGIN : LOCAL_ORIGIN;
    if (mode === "save" || mode === "reset") this.finishHistoryCapture();
    let result!: Result;
    this.#active.doc.transact(() => {
      result = fn();
    }, origin);
    if (mode === "save") this.finishHistoryCapture();
    else if (mode === "reset") this.#active.undoManager.clear();
    return result;
  };

  mutateGrid = (
    mutation: (grid: CanvasGridWriter) => void,
    history: CanvasHistoryMode | boolean = "save"
  ) => this.runTransaction(() => mutation(this.#active.grid), history);

  replaceStructuredContent = (
    scene: StructuredNode[],
    components: StructuredComponentInstance[],
    history: CanvasHistoryMode | boolean = "save"
  ) => this.runTransaction(() => {
    applyYMapValueDiff(this.#active.scene, scene);
    applyYMapValueDiff(this.#active.components, components);
  }, history);

  replaceFreeformGrid = (entries: [string, GridCell][]) =>
    this.runTransaction(() => {
      this.#active.scene.clear();
      this.#active.grid.clear();
      entries.forEach(([key, cell]) => this.#active.grid.set(key, cell));
    }, "reset");

  dispose = () => {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#activeListeners.clear();
    this.#historyListeners.clear();
    this.#documents.forEach((document) => {
      document.undoManager.destroy();
      document.doc.destroy();
    });
    this.#documents.clear();
  };

  #createDocument(id: string, seed?: CanvasDocumentSeed): CanvasYDocument {
    const doc = new Y.Doc({ guid: id });
    const grid = doc.getMap<GridCell>("main-grid");
    const scene = doc.getMap<StructuredNode>("structured-scene");
    const components = doc.getMap<StructuredComponentInstance>("structured-components");
    const document: CanvasYDocument = {
      id,
      doc,
      grid,
      scene,
      components,
      meta: doc.getMap("document-meta"),
      integrityIssues: new Map(),
      undoManager: new Y.UndoManager([grid, scene, components], {
        captureTimeout: 500,
        trackedOrigins: new Set([LOCAL_ORIGIN]),
      }),
    };
    const repairOverlappingGridCells = (transaction: Y.Transaction) => {
      let gridChanged = false;
      for (const type of transaction.changed.keys()) {
        if (Object.is(type, grid)) gridChanged = true;
      }
      if (!gridChanged) return;
      const normalized = new Map(
        normalizeGridCellEntries(Array.from(grid.entries()))
      );
      const isNormalized =
        normalized.size === grid.size &&
        Array.from(normalized.entries()).every(([key, cell]) =>
          areJsonValuesEqual(grid.get(key), cell)
        );
      if (isNormalized) return;
      doc.transact(() => {
        Array.from(grid.keys()).forEach((key) => {
          if (!normalized.has(key)) grid.delete(key);
        });
        normalized.forEach((cell, key) => {
          if (!areJsonValuesEqual(grid.get(key), cell)) grid.set(key, cell);
        });
      }, HISTORY_IGNORED_ORIGIN);
    };
    doc.on("afterTransaction", repairOverlappingGridCells);
    const notify = () => {
      if (document === this.#active) this.#emitHistory();
    };
    document.undoManager.on("stack-item-added", notify);
    document.undoManager.on("stack-item-popped", notify);
    document.undoManager.on("stack-cleared", notify);
    document.undoManager.on("stack-item-updated", notify);
    if (seed) this.#replaceDocument(document, seed);
    return document;
  }

  #replaceDocument(document: CanvasYDocument, seed: CanvasDocumentSeed) {
    document.doc.transact(() => {
      document.grid.clear();
      document.scene.clear();
      document.components.clear();
      seed.grid.forEach(([key, cell]) => document.grid.set(key, cell));
      seed.scene.forEach((node) => document.scene.set(node.id, node));
      seed.components?.forEach((component) =>
        document.components.set(component.id, component)
      );
    }, HISTORY_IGNORED_ORIGIN);
    document.undoManager.clear();
  }

  #readTransaction(document: CanvasYDocument, transaction: Y.Transaction) {
    const change: CanvasDocumentTransaction = {
      gridKeysChanged: new Set(),
      sceneChanged: false,
      componentsChanged: false,
    };
    for (const [type, keys] of transaction.changed) {
      if (Object.is(type, document.grid)) {
        keys.forEach((key) => {
          if (key !== null) change.gridKeysChanged.add(key);
        });
      } else if (Object.is(type, document.scene)) change.sceneChanged = true;
      else if (Object.is(type, document.components)) change.componentsChanged = true;
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
