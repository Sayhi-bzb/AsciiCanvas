import { canvasCommands } from "@/domains/canvas/public";

export const runUndo = () => {
  return canvasCommands.history.undo();
};

export const runRedo = () => {
  return canvasCommands.history.redo();
};
