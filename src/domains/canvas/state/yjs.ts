import * as Y from "yjs";
import type { GridCell } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";

const yDoc = new Y.Doc();
const HISTORY_IGNORED_ORIGIN = Symbol("canvas-history-ignored");

export const yMainGrid = yDoc.getMap<GridCell>("main-grid");
export const yStructuredScene = yDoc.getMap<StructuredNode>("structured-scene");

export const undoManager = new Y.UndoManager([yMainGrid, yStructuredScene], {
  captureTimeout: 500,
  trackedOrigins: new Set([null]),
});

export const forceHistorySave = () => {
  undoManager.stopCapturing();
};

export type CanvasHistoryMode = "save" | "merge" | "none" | "reset";

export const normalizeCanvasHistoryMode = (
  history: CanvasHistoryMode | boolean = "save"
): CanvasHistoryMode => {
  if (history === true) return "save";
  if (history === false) return "merge";
  return history;
};

export const runCanvasTransaction = (
  fn: () => void,
  history: CanvasHistoryMode | boolean = "save"
) => {
  const mode = normalizeCanvasHistoryMode(history);
  const origin =
    mode === "none" || mode === "reset" ? HISTORY_IGNORED_ORIGIN : null;

  if (mode === "save" || mode === "reset") {
    forceHistorySave();
  }

  yDoc.transact(() => {
    fn();
  }, origin);

  if (mode === "save") {
    forceHistorySave();
  } else if (mode === "reset") {
    undoManager.clear();
  }
};

export const transactWithHistory = (
  fn: () => void,
  shouldSaveHistory = true
) => {
  runCanvasTransaction(fn, shouldSaveHistory);
};
