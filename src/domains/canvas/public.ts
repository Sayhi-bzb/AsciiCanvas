export { CanvasRuntime, createCanvasRuntime } from "./runtime";
export type { CanvasSessionMaterialization } from "./runtime";
export {
  CanvasRuntimeProvider,
  useCanvasPersistence,
  useCanvasPersistenceSelector,
  useCanvasRuntime,
  useCanvasState,
} from "./react";
export type { CanvasState } from "./state/interfaces";
export type {
  CanvasColorPickerTarget,
  CanvasViewportState,
  ClipboardCommandResult,
  RichTextCell,
  RichTextRow,
  RichTextSpan,
} from "./state/interfaces";
export type { SelectionCommandFactory } from "./state/selectionCommandPort";
export { isToolAllowedForMode } from "./model/tool";
export type { ToolType } from "./model/tool";
export { DEFAULT_DEMO_GRID } from "./state/helpers/defaultDemo";
export type { CanvasHistoryCheckpoint } from "./state/CanvasDocumentRegistry";
export type {
  CanvasPersistenceStatus,
  CanvasRestoreFailureReason,
} from "./state/browserPersistence";
export {
  CellPlaneIndex,
  cellPlanePatchToOperation,
  gridEntriesToCellPlaneOperation,
  getSurfaceGridReader,
  isIncrementalCanvasSurfaceReader,
  isSurfaceGridProjection,
  createSurfaceGridProjection,
} from "./cell-plane/model";
export type {
  CanvasSurfaceChanges,
  CanvasSurfaceReader,
  CellPlaneOperation,
  CellPlanePatch,
  CellPlaneRow,
  CellRowMutation,
  GridInterval,
  IncrementalCanvasSurfaceReader,
  StyledCellSpan,
} from "./cell-plane/model";
export { createGridSurfaceReader } from "./cell-plane/model";
export {
  materializeSlideDeckContent,
} from "./state/slideDocumentPages";
export type {
  CanvasDocumentAddress,
  CanvasDocumentDraft,
  CanvasPageDescriptor,
  CanvasPageDraft,
} from "./state/canvasDocumentModel";
