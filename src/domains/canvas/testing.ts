export * from "./public";
import type { CanvasSessionSourceParser } from "./state/sessionImportPort";
import type { SelectionCommandFactory } from "./state/selectionCommandPort";
import { CanvasDocumentRegistry } from "./state/CanvasDocumentRegistry";
import { createEditorStore, type CanvasStore } from "./state/editorStore";
import { createCanvasCommands, createCanvasQueries } from "./state/canvasCommands";
import { applyFreeformSnapshotToYMaps as applySnapshot } from "./state/helpers/gridHelpers";

export let defaultCanvasDocuments: CanvasDocumentRegistry;
export let useEditorStore: CanvasStore;
export let canvasCommands: ReturnType<typeof createCanvasCommands>;
export let testingCanvasRuntime: {
  store: CanvasStore;
  documents: CanvasDocumentRegistry;
  getState: CanvasStore["getState"];
  subscribe: CanvasStore["subscribe"];
  commands: ReturnType<typeof createCanvasCommands>;
  queries: ReturnType<typeof createCanvasQueries>;
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
    dispose: () => undefined,
  };
  return testingCanvasRuntime;
};

export const getCanvasState = () => useEditorStore.getState();
export const applyFreeformSnapshotToYMaps = (
  entries: Parameters<typeof applySnapshot>[1]
) => applySnapshot(defaultCanvasDocuments, entries);
export const undoCanvas = () => defaultCanvasDocuments.undo();
export const redoCanvas = () => defaultCanvasDocuments.redo();
export const replaceCanvasGrid = (
  entries: Parameters<CanvasDocumentRegistry["replaceFreeformGrid"]>[0]
) => defaultCanvasDocuments.replaceFreeformGrid(entries);
