import * as Y from "yjs";
import type { GridCell } from "@/shared/types";
import type {
  StructuredComponentInstance,
  StructuredNode,
} from "@/domains/structured-content/public";
import type { CollaborationIntegrityIssue } from "@/domains/collaboration/public";
import { areJsonValuesEqual } from "@/shared/utils/equality";

const LOCAL_ORIGIN = Symbol("canvas-local-origin");
const HISTORY_IGNORED_ORIGIN = Symbol("canvas-history-ignored");

type CanvasDocumentSeed = {
  grid: [string, GridCell][];
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
};

export const applyYMapValueDiff = <T extends { id: string }>(
  map: Y.Map<T>,
  values: T[]
) => {
  const nextIds = new Set(values.map((value) => value.id));
  Array.from(map.keys()).forEach((id) => {
    if (!nextIds.has(id)) map.delete(id);
  });
  values.forEach((value) => {
    const current = map.get(value.id);
    if (!areJsonValuesEqual(current, value)) {
      map.set(value.id, value);
    }
  });
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

const documents = new Map<string, CanvasYDocument>();
const activeDocumentListeners = new Set<
  (next: CanvasYDocument, previous: CanvasYDocument) => void
>();
type CanvasHistoryAvailability = {
  canUndo: boolean;
  canRedo: boolean;
};
type CanvasDocumentTransaction = {
  gridKeysChanged: Set<string>;
  sceneChanged: boolean;
  componentsChanged: boolean;
};
const historyAvailabilityListeners = new Set<(availability: CanvasHistoryAvailability) => void>();

export function getCanvasHistoryAvailability(): CanvasHistoryAvailability {
  return {
    canUndo: activeDocument.undoManager.undoStack.length > 0,
    canRedo: activeDocument.undoManager.redoStack.length > 0,
  };
}

function emitHistoryAvailability() {
  const availability = getCanvasHistoryAvailability();
  historyAvailabilityListeners.forEach((listener) => listener(availability));
}

export function subscribeCanvasHistoryAvailability(
  listener: (availability: CanvasHistoryAvailability) => void
) {
  historyAvailabilityListeners.add(listener);
  return () => historyAvailabilityListeners.delete(listener);
}

const createCanvasYDocument = (id: string, seed?: CanvasDocumentSeed): CanvasYDocument => {
  const doc = new Y.Doc({ guid: id });
  const grid = doc.getMap<GridCell>("main-grid");
  const scene = doc.getMap<StructuredNode>("structured-scene");
  const components = doc.getMap<StructuredComponentInstance>("structured-components");
  const meta = doc.getMap<unknown>("document-meta");
  const integrityIssues = new Map<string, CollaborationIntegrityIssue>();
  const undoManager = new Y.UndoManager([grid, scene, components], {
    captureTimeout: 500,
    trackedOrigins: new Set([LOCAL_ORIGIN]),
  });
  const canvasDocument = { id, doc, grid, scene, components, meta, integrityIssues, undoManager };
  const notifyIfActive = () => {
    if (canvasDocument === activeDocument) emitHistoryAvailability();
  };
  undoManager.on("stack-item-added", notifyIfActive);
  undoManager.on("stack-item-popped", notifyIfActive);
  undoManager.on("stack-cleared", notifyIfActive);
  undoManager.on("stack-item-updated", notifyIfActive);
  if (seed) replaceCanvasDocument(canvasDocument, seed);
  return canvasDocument;
};

const replaceCanvasDocument = (canvasDocument: CanvasYDocument, seed: CanvasDocumentSeed) => {
  canvasDocument.doc.transact(() => {
    canvasDocument.grid.clear();
    canvasDocument.scene.clear();
    canvasDocument.components.clear();
    seed.grid.forEach(([key, cell]) => canvasDocument.grid.set(key, cell));
    seed.scene.forEach((node) => canvasDocument.scene.set(node.id, node));
    seed.components?.forEach((component) => canvasDocument.components.set(component.id, component));
  }, HISTORY_IGNORED_ORIGIN);
  canvasDocument.undoManager.clear();
};

let activeDocument = createCanvasYDocument("canvas-initial");
documents.set(activeDocument.id, activeDocument);

export const getActiveCanvasDocumentId = () => activeDocument.id;
const getYMainGrid = () => activeDocument.grid;
const getYStructuredScene = () => activeDocument.scene;
const getYStructuredComponents = () => activeDocument.components;

const integrityIssueKey = (channel: CollaborationIntegrityIssue["channel"], key: string) =>
  `${channel}:${key}`;

export const setActiveCanvasIntegrityIssue = (
  channel: CollaborationIntegrityIssue["channel"],
  key: string,
  issue: CollaborationIntegrityIssue | null
) => {
  const issueKey = integrityIssueKey(channel, key);
  if (issue) activeDocument.integrityIssues.set(issueKey, issue);
  else activeDocument.integrityIssues.delete(issueKey);
};

export const getActiveCanvasIntegrityIssues = () =>
  Array.from(activeDocument.integrityIssues.values());

const createActiveTypeProxy = <T extends object>(resolve: () => T): T =>
  new Proxy({} as T, {
    get: (_target, property) => {
      const type = resolve();
      const value = Reflect.get(type, property, type);
      return typeof value === "function" ? value.bind(type) : value;
    },
  });

// Compatibility ports for editor commands. They always forward to the active
// Canvas document, so existing command code cannot retain a stale room map.
export const yMainGrid = createActiveTypeProxy(getYMainGrid);
export const yStructuredScene = createActiveTypeProxy(getYStructuredScene);
export const yStructuredComponents = createActiveTypeProxy(getYStructuredComponents);

export const getCanvasDocument = (id: string) => documents.get(id) ?? null;
export const getCanvasCollaborationDocument = (id: string) =>
  documents.get(id)?.doc ?? null;

export const getCanvasDocumentSeed = (
  id: string,
  mode: "freeform" | "structured"
): CanvasDocumentSeed | null => {
  const canvasDocument = documents.get(id);
  if (!canvasDocument) return null;
  return {
    grid: mode === "freeform" ? Array.from(canvasDocument.grid.entries()) : [],
    scene: mode === "structured" ? Array.from(canvasDocument.scene.values()) : [],
    components:
      mode === "structured" ? Array.from(canvasDocument.components.values()) : [],
  };
};

export const prepareCanvasDocumentForCollaboration = (
  id: string,
  mode: "freeform" | "structured"
) => {
  const canvasDocument = documents.get(id);
  if (!canvasDocument) return false;
  canvasDocument.doc.transact(() => {
    if (mode === "structured") {
      canvasDocument.grid.clear();
    } else {
      canvasDocument.scene.clear();
      canvasDocument.components.clear();
    }
  }, HISTORY_IGNORED_ORIGIN);
  canvasDocument.undoManager.clear();
  return true;
};

export const resetCanvasDocument = (id: string, seed: CanvasDocumentSeed) => {
  const canvasDocument = documents.get(id);
  if (!canvasDocument) return false;
  replaceCanvasDocument(canvasDocument, seed);
  return true;
};

export const activateCanvasDocument = (
  id: string,
  seed: CanvasDocumentSeed,
  options?: { replace?: boolean }
) => {
  const previous = activeDocument;
  let next = documents.get(id);
  if (!next) {
    next = createCanvasYDocument(id, seed);
    documents.set(id, next);
  } else if (options?.replace) {
    replaceCanvasDocument(next, seed);
  }
  activeDocument = next;
  if (next !== previous) {
    activeDocumentListeners.forEach((listener) => listener(next, previous));
  }
  emitHistoryAvailability();
  return next;
};

export const initializeCollaborativeCanvasDocument = (
  id: string,
  seed: CanvasDocumentSeed = { grid: [], scene: [], components: [] }
) => {
  const previous = activeDocument;
  const existing = documents.get(id);
  if (existing) {
    existing.undoManager.destroy();
    existing.doc.destroy();
  }
  const next = createCanvasYDocument(id, seed);
  documents.set(id, next);
  activeDocument = next;
  activeDocumentListeners.forEach((listener) => listener(next, previous));
  emitHistoryAvailability();
  return next;
};

export const destroyCanvasDocument = (id: string) => {
  const canvasDocument = documents.get(id);
  if (!canvasDocument || canvasDocument === activeDocument) return false;
  canvasDocument.undoManager.destroy();
  canvasDocument.doc.destroy();
  documents.delete(id);
  return true;
};

const subscribeActiveCanvasDocument = (
  listener: (next: CanvasYDocument, previous: CanvasYDocument) => void
) => {
  activeDocumentListeners.add(listener);
  return () => activeDocumentListeners.delete(listener);
};

const getCanvasDocumentTransaction = (
  canvasDocument: CanvasYDocument,
  transaction: Y.Transaction
): CanvasDocumentTransaction => {
  const gridKeysChanged = new Set<string>();
  let sceneChanged = false;
  let componentsChanged = false;
  for (const [type, keys] of transaction.changed) {
    if (Object.is(type, canvasDocument.grid)) {
      keys.forEach((key) => {
        if (key !== null) gridKeysChanged.add(key);
      });
    } else if (Object.is(type, canvasDocument.scene)) {
      sceneChanged = true;
    } else if (Object.is(type, canvasDocument.components)) {
      componentsChanged = true;
    }
  }
  return {
    gridKeysChanged,
    sceneChanged,
    componentsChanged,
  };
};

/** Observes one completed active-document transaction across all content maps. */
export const observeActiveCanvasTransactions = (
  listener: (transaction: CanvasDocumentTransaction) => void
) => {
  let observedDocument = activeDocument;
  const handleTransaction = (transaction: Y.Transaction) => {
    const change = getCanvasDocumentTransaction(observedDocument, transaction);
    if (
      change.gridKeysChanged.size > 0 ||
      change.sceneChanged ||
      change.componentsChanged
    ) {
      listener(change);
    }
  };
  observedDocument.doc.on("afterTransaction", handleTransaction);
  const unsubscribe = subscribeActiveCanvasDocument((next, previous) => {
    previous.doc.off("afterTransaction", handleTransaction);
    observedDocument = next;
    next.doc.on("afterTransaction", handleTransaction);
  });
  return () => {
    unsubscribe();
    observedDocument.doc.off("afterTransaction", handleTransaction);
  };
};

export const undoManager = {
  undo: () => !!activeDocument.undoManager.undo(),
  redo: () => !!activeDocument.undoManager.redo(),
  clear: () => activeDocument.undoManager.clear(),
  stopCapturing: () => activeDocument.undoManager.stopCapturing(),
};

const forceHistorySave = () => {
  activeDocument.undoManager.stopCapturing();
};

export const undoCanvas = () => undoManager.undo();
export const redoCanvas = () => undoManager.redo();
export const finishCanvasHistoryCapture = () => forceHistorySave();

export type CanvasHistoryCheckpoint = {
  commit: () => void;
  cancel: () => void;
};

/**
 * Creates a rollback boundary for an imperative canvas interaction.
 * Only local changes captured after the boundary are reverted on cancel.
 */
export const beginCanvasHistoryCheckpoint = (): CanvasHistoryCheckpoint => {
  const canvasDocument = activeDocument;
  const manager = canvasDocument.undoManager;
  manager.stopCapturing();
  const undoDepth = manager.undoStack.length;
  let settled = false;

  const finish = () => {
    manager.stopCapturing();
    if (canvasDocument === activeDocument) emitHistoryAvailability();
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
      // Undoing a canceled interaction creates redo items. They are an
      // implementation detail of rollback and must not become user history.
      if (rolledBack) manager.clear(false, true);
      finish();
    },
  };
};

export type CanvasHistoryMode = "save" | "merge" | "none" | "reset";

type CanvasGridWriter = {
  get: (key: string) => GridCell | undefined;
  set: (key: string, value: GridCell) => void;
  delete: (key: string) => void;
  clear: () => void;
};

const normalizeCanvasHistoryMode = (
  history: CanvasHistoryMode | boolean = "save"
): CanvasHistoryMode => {
  if (history === true) return "save";
  if (history === false) return "merge";
  return history;
};

export const runCanvasTransaction = (
  fn: () => void,
  history: CanvasHistoryMode | boolean = "save"
) => {
  const mode = normalizeCanvasHistoryMode(history);
  const origin = mode === "none" || mode === "reset" ? HISTORY_IGNORED_ORIGIN : LOCAL_ORIGIN;

  if (mode === "save" || mode === "reset") {
    forceHistorySave();
  }

  activeDocument.doc.transact(fn, origin);

  if (mode === "save") {
    forceHistorySave();
  } else if (mode === "reset") {
    activeDocument.undoManager.clear();
  }
};

export const mutateCanvasGrid = (
  mutation: (grid: CanvasGridWriter) => void,
  history: CanvasHistoryMode | boolean = "save"
) => runCanvasTransaction(() => mutation(activeDocument.grid), history);

export const replaceStructuredCanvasContent = (
  scene: StructuredNode[],
  components: StructuredComponentInstance[],
  history: CanvasHistoryMode | boolean = "save"
) =>
  runCanvasTransaction(() => {
    applyYMapValueDiff(activeDocument.scene, scene);
    applyYMapValueDiff(activeDocument.components, components);
  }, history);

export const replaceActiveFreeformGrid = (entries: [string, GridCell][]) =>
  runCanvasTransaction(() => {
    activeDocument.scene.clear();
    activeDocument.grid.clear();
    entries.forEach(([key, cell]) => activeDocument.grid.set(key, cell));
  }, "reset");
