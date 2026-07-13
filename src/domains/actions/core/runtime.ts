import { useCanvasStore } from "@/domains/canvas/public";
import {
  actionUnhandled,
} from "./result";
import type { ActionResult } from "./types";
import type {
  ActionChecker,
  ActionContext,
  ActionHandler,
  ActionId,
  EditorActionId,
  SidebarActionId,
  ToolbarActionId,
} from "./types";
import type { ToolType } from "@/shared/types";
import {
  editorHandlers,
  editorCheckers,
  sidebarHandlers,
  toolbarHandlers,
} from "./handlers";

// Combined handlers
const ACTION_HANDLERS: Record<string, ActionHandler<unknown>> = {
  ...(editorHandlers as Record<string, ActionHandler<unknown>>),
  ...(toolbarHandlers as Record<string, ActionHandler<unknown>>),
  ...(sidebarHandlers as Record<string, ActionHandler<unknown>>),
};

// Combined checkers
const ACTION_CHECKERS: Partial<Record<ActionId, ActionChecker>> = {
  ...editorCheckers,
};

// Type guards
const isEditorAction = (id: ActionId): id is EditorActionId =>
  id in editorHandlers;

const isToolbarAction = (id: ActionId): id is ToolbarActionId =>
  id in toolbarHandlers;

const isSidebarAction = (id: ActionId): id is SidebarActionId =>
  id in sidebarHandlers;

// Run action
export const runAction = <T = unknown>(
  actionId: ActionId,
  options: T & Partial<ActionContext>,
  context?: ActionContext
): ActionResult => {
  const handler = ACTION_HANDLERS[actionId];
  if (!handler) {
    return actionUnhandled("unknown-action");
  }

  // Build full context from options if partial context is provided
  const fullContext: ActionContext = context ?? {
    state: useCanvasStore.getState(),
    setTool: (options as Partial<ActionContext>).setTool ?? (() => {}),
    onUndo: (options as Partial<ActionContext>).onUndo ?? (() => {}),
    onRedo: (options as Partial<ActionContext>).onRedo ?? (() => {}),
  };

  return handler(options as T, fullContext);
};

// Check if action can run
export const canRunAction = (
  actionId: ActionId,
  state = useCanvasStore.getState()
): boolean => {
  const checker = ACTION_CHECKERS[actionId];
  if (checker) {
    return checker(state);
  }
  // Default: allow if handler exists
  return actionId in ACTION_HANDLERS;
};

// Convenience function for editor actions
export const runEditorAction = <T = unknown>(
  actionId: EditorActionId,
  options: T & Partial<Omit<ActionContext, "setTool">>
): ActionResult => {
  const fullContext: ActionContext = {
    state: useCanvasStore.getState(),
    setTool: () => {}, // No-op for editor actions
    onUndo: options.onUndo ?? (() => {}),
    onRedo: options.onRedo ?? (() => {}),
  };
  return runAction(actionId, options, fullContext);
};

// Convenience function for toolbar actions
export const runToolbarAction = <T = unknown>(
  actionId: ToolbarActionId,
  options: T & Partial<Omit<ActionContext, "onUndo" | "onRedo">>
): ActionResult => {
  const fullContext: ActionContext = {
    state: useCanvasStore.getState(),
    setTool: ((options as { setTool?: (tool: ToolType) => void }).setTool ?? (() => {})),
    onUndo: () => {},
    onRedo: () => {},
  };
  return runAction(actionId, options, fullContext);
};

// Convenience function for sidebar actions
export const runSidebarAction = <T = unknown>(
  actionId: SidebarActionId,
  options: T
): ActionResult => {
  // Sidebar actions don't need full context
  const state = useCanvasStore.getState();
  const context: ActionContext = {
    state,
    setTool: () => {},
    onUndo: () => {},
    onRedo: () => {},
  };
  return runAction(actionId, options as T & Partial<ActionContext>, context);
};

// Re-export handlers for advanced use cases
export {
  editorHandlers,
  editorCheckers,
  toolbarHandlers,
  sidebarHandlers,
  isEditorAction,
  isToolbarAction,
  isSidebarAction,
};
