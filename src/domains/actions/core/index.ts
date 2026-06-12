// Types
export type {
  ActionId,
  EditorActionId,
  ToolbarActionId,
  SidebarActionId,
  ActionMeta,
  ActionResult,
  ActionContext,
  ActionHandler,
  ActionChecker,
  ActionSource,
  ContextMenuEntry,
} from "./types";

// Result helpers
export {
  actionSucceeded,
  actionFailed,
  actionUnhandled,
} from "./result";

// Catalog
export {
  ACTION_CATALOG,
  EDITOR_ACTION_META,
  TOOLBAR_ACTION_META,
  TOOLBAR_ACTION_ORDER,
  SIDEBAR_ACTION_META,
  CANVAS_CONTEXT_MENU,
} from "./catalog";

// Runtime
export {
  runAction,
  canRunAction,
  runEditorAction,
  runToolbarAction,
  runSidebarAction,
  editorHandlers,
  editorCheckers,
  toolbarHandlers,
  sidebarHandlers,
  isEditorAction,
  isToolbarAction,
  isSidebarAction,
} from "./runtime";

// Handlers (for advanced use cases)
export {
  resolveActiveToolbarAction,
} from "./handlers";
