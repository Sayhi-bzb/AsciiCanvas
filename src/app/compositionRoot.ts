import {
  createEditorCommandsExtension,
  createSelectionCommandFactory,
} from "@/domains/actions/public";
import {
  CanvasRuntime,
  createCanvasRuntime,
} from "@/domains/canvas/public";
import {
  CollaborationRuntime,
  createCollaborationRuntime,
} from "@/domains/collaboration/public";
import { parseDocumentSessionSource } from "@/domains/document/public";
import {
  createCanvasEditorExtension,
  createCanvasEditorRuntime,
  connectEditorKeymapPersistence,
  type CanvasEditorRuntime,
  type EditorExtension,
} from "@/domains/editor/public";
import { EDITOR_PERSISTENCE_KEY } from "@/domains/sessions/public";
import type { CanvasState } from "@/domains/canvas/public";

type KeymapStorage = Pick<Storage, "getItem" | "setItem">;

type ApplicationEditorHostOptions = {
  canvasPersistence?: false | { storage: Storage; key: string; migrateLegacy?: boolean };
  keymapStorage?: KeymapStorage | false;
};

export class ApplicationEditorHost {
  readonly canvas: CanvasRuntime;
  readonly collaboration: CollaborationRuntime;
  readonly editor: CanvasEditorRuntime;
  #disposed = false;

  constructor({
    canvasPersistence = false,
    keymapStorage = false,
  }: ApplicationEditorHostOptions = {}) {
    this.collaboration = createCollaborationRuntime();
    this.canvas = createCanvasRuntime({
      persistence: canvasPersistence,
      selectionCommands: createSelectionCommandFactory({
        getActiveDocumentId: () => this.canvas.documents.getActiveDocumentId(),
      }),
      parseSessionSource: parseDocumentSessionSource,
      reportIntegrityIssues: (issues) =>
        this.collaboration.reportIntegrityIssues(issues),
    });
    this.editor = createCanvasEditorRuntime({
      state: { get: this.canvas.getState, subscribe: this.canvas.subscribe },
      history: this.canvas.commands.history,
      transactions: { run: this.canvas.commands.history.transact },
      onToolChange: this.canvas.commands.tools.set,
    });
    this.editor
      .registerExtension(createCanvasEditorExtension(this.editor.interactionPort))
      .registerExtension(createEditorCommandsExtension(this.canvas));
    if (keymapStorage) {
      const persistenceExtension: EditorExtension<CanvasState> = {
        id: "chardesk.editor-keymap-persistence",
        setup: () => connectEditorKeymapPersistence(this.editor.keymap, keymapStorage),
      };
      this.editor.registerExtension(persistenceExtension);
    }
    this.editor.start(this.editor.getState().tool);
  }

  dispose = async () => {
    if (this.#disposed) return;
    this.#disposed = true;
    this.editor.dispose();
    await this.collaboration.disconnect();
    this.canvas.dispose();
  };
}

export const createApplicationEditorHost = (options?: ApplicationEditorHostOptions) =>
  new ApplicationEditorHost(options);

let applicationHost: ApplicationEditorHost | null = null;

export const getApplicationEditorHost = (): ApplicationEditorHost => {
  if (!applicationHost) {
    const storage = typeof localStorage === "undefined" ? false : localStorage;
    applicationHost = createApplicationEditorHost({
      canvasPersistence: storage
        ? { storage, key: EDITOR_PERSISTENCE_KEY, migrateLegacy: true }
        : false,
      keymapStorage: storage,
    });
  }
  return applicationHost;
};
