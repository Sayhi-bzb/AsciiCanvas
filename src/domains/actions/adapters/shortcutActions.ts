import { undoManager } from "@/domains/canvas/public";

export const runUndo = () => {
  undoManager.undo();
};

export const runRedo = () => {
  undoManager.redo();
};
