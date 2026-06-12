import * as Y from "yjs";
import type { GridCell } from "@/shared/types";
import type { StructuredNode } from "@/shared/types";

const yDoc = new Y.Doc();

export const yMainGrid = yDoc.getMap<GridCell>("main-grid");
export const yStructuredScene = yDoc.getMap<StructuredNode>("structured-scene");

export const undoManager = new Y.UndoManager([yMainGrid, yStructuredScene], {
  captureTimeout: 500,
  trackedOrigins: new Set([null]),
});

export const forceHistorySave = () => {
  undoManager.stopCapturing();
};

export const transactWithHistory = (
  fn: () => void,
  shouldSaveHistory = true
) => {
  yDoc.transact(() => {
    fn();
  });
  if (shouldSaveHistory) {
    forceHistorySave();
  }
};
