import {
  createActionsExtension,
  registerSelectionCommands,
} from "@/domains/actions/public";
import { registerDocumentSessionSource } from "@/domains/document/public";
import {
  createCanvasEditorExtension,
  editorRuntime,
} from "@/domains/editor/public";

let initialized = false;

export const initializeApplication = () => {
  if (initialized) return;
  initialized = true;
  registerSelectionCommands();
  registerDocumentSessionSource();
  editorRuntime
    .registerExtension(createCanvasEditorExtension())
    .registerExtension(createActionsExtension())
    .start(editorRuntime.getState().tool);
};
