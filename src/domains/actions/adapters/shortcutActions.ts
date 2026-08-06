import { undoManager } from "@/domains/canvas/public";

export const runUndo = () => {
  return undoManager.undo();
};

export const runRedo = () => {
  return undoManager.redo();
};
