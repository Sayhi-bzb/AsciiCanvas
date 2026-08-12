import type { CollaborationIntegrityIssue } from "@/domains/collaboration/public";
import type { CanvasSessionSourceParser } from "./state/sessionImportPort";
import type { SelectionCommandFactory } from "./state/selectionCommandPort";
import { CanvasDocumentRegistry } from "./state/CanvasDocumentRegistry";
import {
  createEditorStore,
  type CanvasStorePersistence,
} from "./state/editorStore";
import {
  createCanvasCommands,
  createCanvasQueries,
} from "./state/canvasCommands";

type CanvasRuntimeOptions = {
  documents?: CanvasDocumentRegistry;
  persistence: CanvasStorePersistence;
  selectionCommands: SelectionCommandFactory;
  parseSessionSource: CanvasSessionSourceParser;
  reportIntegrityIssues?: (issues: CollaborationIntegrityIssue[]) => void;
};

export class CanvasRuntime {
  readonly documents: CanvasDocumentRegistry;
  readonly store;
  readonly commands;
  readonly queries;
  readonly #disposeStore: () => void;
  #disposed = false;

  constructor(options: CanvasRuntimeOptions) {
    this.documents = options.documents ?? new CanvasDocumentRegistry();
    const storeInstance = createEditorStore({
      documents: this.documents,
      selectionCommands: options.selectionCommands,
      parseSessionSource: options.parseSessionSource,
      reportIntegrityIssues: options.reportIntegrityIssues ?? (() => undefined),
      persistence: options.persistence,
    });
    this.store = storeInstance.store;
    this.#disposeStore = storeInstance.dispose;
    this.commands = createCanvasCommands(this.store, this.documents);
    this.queries = createCanvasQueries(this.store, this.documents);
  }

  getState = () => this.store.getState();
  subscribe = (listener: Parameters<typeof this.store.subscribe>[0]) =>
    this.store.subscribe(listener);

  dispose = () => {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#disposeStore();
    this.documents.dispose();
  };
}

export const createCanvasRuntime = (options: CanvasRuntimeOptions) =>
  new CanvasRuntime(options);
