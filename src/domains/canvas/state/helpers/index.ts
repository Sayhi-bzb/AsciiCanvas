export {
  resolveNextSessionName,
  createSessionId,
  withActiveCanvasSnapshot,
  normalizeSessionMode,
} from "./sessionHelpers";

export {
  rebuildGridFromYMap,
  rebuildSceneFromYMap,
  patchGridByChangedKeys,
  applyFreeformSnapshotToYMaps,
  applyStructuredSnapshotToYMaps,
} from "./gridHelpers";

export {
  cloneStructuredNode,
  cloneScene,
  normalizeAndCloneScene,
  serializeGrid,
  createMapFromEntries,
  isSameCell,
  isPoint,
  toStructuredNode,
} from "./snapshotHelpers";
