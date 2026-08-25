export { CanvasRuntime, createCanvasRuntime } from "./runtime";
export {
  CanvasRuntimeProvider,
  useCanvasPersistence,
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
export type { CanvasPersistenceStatus } from "./state/browserPersistence";
export {
  CellPlaneIndex,
  cellPlanePatchToOperation,
  gridEntriesToCellPlaneOperation,
  isSurfaceGridProjection,
} from "./cell-plane/model";
export type {
  CanvasSurfaceReader,
  CellPlaneOperation,
  CellPlanePatch,
  CellPlaneRow,
  CellRowMutation,
  GridInterval,
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
