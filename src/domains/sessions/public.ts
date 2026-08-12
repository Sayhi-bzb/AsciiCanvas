export type {
  CanvasImportSnapshot,
  CanvasSession,
  SlideCanvasSession,
  StaticCanvasSession,
} from "./model";
export {
  createSessionId,
  normalizeSessionMode,
  resolveNextSessionName,
  withActiveCanvasSnapshot,
} from "./session-state";
export {
  EDITOR_PERSISTENCE_KEY,
  EDITOR_PERSISTENCE_V3_BACKUP_KEY,
  EDITOR_PERSISTENCE_V4_BACKUP_KEY,
  EDITOR_PERSISTENCE_VERSION,
  flattenPersistedEditorState,
  isPersistedEditorStateV5,
  migratePersistedStateToV5,
} from "./persistence";
export type { CreateCanvasSessionOptions, SessionCommands } from "./commands";
export type { CanvasMode, StaticGridCanvasMode } from "./mode";
export { isStaticGridMode } from "./mode";
