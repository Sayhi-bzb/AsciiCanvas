import { redoCanvas, undoCanvas } from "@/domains/canvas/public";

export const runUndo = () => {
  return undoCanvas();
};

export const runRedo = () => {
  return redoCanvas();
};
