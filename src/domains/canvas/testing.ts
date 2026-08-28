export * from "./public";
import type { CanvasSessionSourceParser } from "./state/sessionImportPort";
import type { SelectionCommandFactory } from "./state/selectionCommandPort";
import { CanvasDocumentRegistry } from "./state/CanvasDocumentRegistry";
import type { CanvasStore } from "./state/editorStore";
import type { createCanvasCommands } from "./state/canvasCommands";
import { CanvasRuntime } from "./runtime";

export let defaultCanvasDocuments: CanvasDocumentRegistry;
export let useEditorStore: CanvasStore;
export let canvasCommands: ReturnType<typeof createCanvasCommands>;
export let testingCanvasRuntime: CanvasRuntime;

export const initializeCanvasTesting = ({
  selectionCommands,
  parseSessionSource,
}: {
  selectionCommands: (documents: CanvasDocumentRegistry) => SelectionCommandFactory;
  parseSessionSource: CanvasSessionSourceParser;
}) => {
  if (testingCanvasRuntime) return testingCanvasRuntime;
  defaultCanvasDocuments = new CanvasDocumentRegistry();
  testingCanvasRuntime = new CanvasRuntime({
    documents: defaultCanvasDocuments,
    selectionCommands: selectionCommands(defaultCanvasDocuments),
    parseSessionSource,
    persistence: false,
  });
  useEditorStore = testingCanvasRuntime.store;
  canvasCommands = testingCanvasRuntime.commands;
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
