export * from "./public";
import type { CanvasSessionSourceParser } from "./state/sessionImportPort";
import type { SelectionCommandFactory } from "./state/selectionCommandPort";
import { CanvasDocumentRegistry } from "./state/CanvasDocumentRegistry";
import { createEditorStore, type CanvasStore } from "./state/editorStore";
import { createCanvasCommands, createCanvasQueries } from "./state/canvasCommands";

export let defaultCanvasDocuments: CanvasDocumentRegistry;
export let useEditorStore: CanvasStore;
export let canvasCommands: ReturnType<typeof createCanvasCommands>;
const TEST_PERSISTENCE_SNAPSHOT = {
  phase: "ready",
  save: "saved",
  ownership: "writer",
  error: null,
} as const;
export let testingCanvasRuntime: {
  store: CanvasStore;
  documents: CanvasDocumentRegistry;
  getState: CanvasStore["getState"];
  subscribe: CanvasStore["subscribe"];
  commands: ReturnType<typeof createCanvasCommands>;
  queries: ReturnType<typeof createCanvasQueries>;
  ready: Promise<void>;
  getPersistenceSnapshot: () => {
    phase: "ready";
    save: "saved";
    ownership: "writer";
    error: null;
  };
  subscribePersistence: (listener: () => void) => () => void;
  retryPersistence: () => Promise<void>;
  setRetainedCanvasIds: (ids: readonly string[]) => void;
  getProjectionCacheStats: CanvasDocumentRegistry["getProjectionCacheStats"];
  setProjectionCacheBudget: CanvasDocumentRegistry["setProjectionCacheBudget"];
  subscribeProjectionCache: CanvasDocumentRegistry["subscribeProjectionCache"];
  dispose: () => void;
};

export const initializeCanvasTesting = ({
  selectionCommands,
  parseSessionSource,
}: {
  selectionCommands: (documents: CanvasDocumentRegistry) => SelectionCommandFactory;
  parseSessionSource: CanvasSessionSourceParser;
}) => {
  if (testingCanvasRuntime) return testingCanvasRuntime;
  defaultCanvasDocuments = new CanvasDocumentRegistry();
  useEditorStore = createEditorStore({
    documents: defaultCanvasDocuments,
    selectionCommands: selectionCommands(defaultCanvasDocuments),
    parseSessionSource,
    reportIntegrityIssues: () => undefined,
    persistence: false,
  }).store;
  canvasCommands = createCanvasCommands(useEditorStore, defaultCanvasDocuments);
  const queries = createCanvasQueries(useEditorStore, defaultCanvasDocuments);
  testingCanvasRuntime = {
    store: useEditorStore,
    documents: defaultCanvasDocuments,
    getState: useEditorStore.getState,
    subscribe: useEditorStore.subscribe,
    commands: canvasCommands,
    queries,
    ready: Promise.resolve(),
    getPersistenceSnapshot: () => TEST_PERSISTENCE_SNAPSHOT,
    subscribePersistence: () => () => undefined,
    retryPersistence: () => Promise.resolve(),
    setRetainedCanvasIds: () => undefined,
    getProjectionCacheStats: defaultCanvasDocuments.getProjectionCacheStats,
    setProjectionCacheBudget: defaultCanvasDocuments.setProjectionCacheBudget,
    subscribeProjectionCache: defaultCanvasDocuments.subscribeProjectionCache,
    dispose: () => undefined,
  };
  return testingCanvasRuntime;
};

export const getCanvasState = () => useEditorStore.getState();
export const applyFreeformSnapshotToYMaps = (
  entries: Parameters<CanvasDocumentRegistry["replaceCellPage"]>[1]
) => canvasCommands.grid.replace(entries);
export const undoCanvas = () => canvasCommands.history.undo();
export const redoCanvas = () => canvasCommands.history.redo();
export const replaceCanvasGrid = (
  entries: Parameters<CanvasDocumentRegistry["replaceCellPage"]>[1]
) => canvasCommands.grid.replace(entries);
