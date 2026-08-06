import * as Y from "yjs";
import type { GridCell } from "@/shared/types";
import type {
  StructuredComponentInstance,
  StructuredNode,
} from "@/domains/structured-content/public";

const LOCAL_ORIGIN = Symbol("canvas-local-origin");
const HISTORY_IGNORED_ORIGIN = Symbol("canvas-history-ignored");

export type CanvasDocumentSeed = {
  grid: [string, GridCell][];
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
};

export type CanvasYDocument = {
  id: string;
  doc: Y.Doc;
  grid: Y.Map<GridCell>;
  scene: Y.Map<StructuredNode>;
  components: Y.Map<StructuredComponentInstance>;
  undoManager: Y.UndoManager;
};

const documents = new Map<string, CanvasYDocument>();
const activeDocumentListeners = new Set<
  (next: CanvasYDocument, previous: CanvasYDocument) => void
>();
export type CanvasHistoryAvailability = {
  canUndo: boolean;
  canRedo: boolean;
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
  const undoManager = new Y.UndoManager([grid, scene, components], {
    captureTimeout: 500,
    trackedOrigins: new Set([LOCAL_ORIGIN]),
  });
  const canvasDocument = { id, doc, grid, scene, components, undoManager };
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

export const getActiveCanvasDocument = () => activeDocument;
export const getYDoc = () => activeDocument.doc;
export const getYMainGrid = () => activeDocument.grid;
export const getYStructuredScene = () => activeDocument.scene;
export const getYStructuredComponents = () => activeDocument.components;

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

export const destroyCanvasDocument = (id: string) => {
  const canvasDocument = documents.get(id);
  if (!canvasDocument || canvasDocument === activeDocument) return false;
  canvasDocument.undoManager.destroy();
  canvasDocument.doc.destroy();
  documents.delete(id);
  return true;
};

export const subscribeActiveCanvasDocument = (
  listener: (next: CanvasYDocument, previous: CanvasYDocument) => void
) => {
  activeDocumentListeners.add(listener);
  return () => activeDocumentListeners.delete(listener);
};

export const observeActiveGrid = (listener: (event: Y.YMapEvent<GridCell>) => void) => {
  getYMainGrid().observe(listener);
  const unsubscribe = subscribeActiveCanvasDocument((next, previous) => {
    previous.grid.unobserve(listener);
    next.grid.observe(listener);
  });
  return () => {
    unsubscribe();
    getYMainGrid().unobserve(listener);
  };
};

export const observeActiveScene = (listener: (event: Y.YMapEvent<StructuredNode>) => void) => {
  getYStructuredScene().observe(listener);
  const unsubscribe = subscribeActiveCanvasDocument((next, previous) => {
    previous.scene.unobserve(listener);
    next.scene.observe(listener);
  });
  return () => {
    unsubscribe();
    getYStructuredScene().unobserve(listener);
  };
};

export const observeActiveComponents = (
  listener: (event: Y.YMapEvent<StructuredComponentInstance>) => void
) => {
  getYStructuredComponents().observe(listener);
  const unsubscribe = subscribeActiveCanvasDocument((next, previous) => {
    previous.components.unobserve(listener);
    next.components.observe(listener);
  });
  return () => {
    unsubscribe();
    getYStructuredComponents().unobserve(listener);
  };
};

export const undoManager = {
  undo: () => !!activeDocument.undoManager.undo(),
  redo: () => !!activeDocument.undoManager.redo(),
  clear: () => activeDocument.undoManager.clear(),
  stopCapturing: () => activeDocument.undoManager.stopCapturing(),
};

export const forceHistorySave = () => {
  activeDocument.undoManager.stopCapturing();
};

export type CanvasHistoryMode = "save" | "merge" | "none" | "reset";

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
