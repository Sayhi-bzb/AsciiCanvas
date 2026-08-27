export type {
  CanvasImportSnapshot,
  CanvasSession,
} from "./model";
export {
  createSessionId,
  normalizeSessionMode,
  resolveNextSessionName,
  withActiveCanvasSnapshot,
} from "./session-state";
export {
  EDITOR_PERSISTENCE_KEY,
  EDITOR_PERSISTENCE_VERSION,
  PREVIOUS_EDITOR_PERSISTENCE_VERSION,
  LEGACY_EDITOR_PERSISTENCE_KEY,
  decodePersistedEditorState,
  flattenPersistedEditorState,
  isPersistedEditorStateV5,
  migrateLegacyEditorPersistence,
  migratePersistedStateToV5,
  UnsupportedEditorPersistenceVersionError,
} from "./persistence";
export type { SessionCommands } from "./commands";
export type { CanvasMode } from "./mode";
export { isStaticGridMode } from "./mode";
export {
  CANVAS_CATALOG_DATABASE,
  CANVAS_CATALOG_MARKER_KEY,
  CANVAS_CATALOG_VERSION,
  createIndexedDbCanvasCatalog,
} from "./indexedDbCatalog";
export type {
  CanvasCatalog,
  CanvasCatalogPreferences,
  CanvasCatalogSession,
  CanvasCatalogSlide,
  CanvasCatalogSnapshot,
} from "./indexedDbCatalog";
