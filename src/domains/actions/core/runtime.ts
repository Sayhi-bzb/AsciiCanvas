import { getCanvasState } from "@/domains/canvas/public";
import {
  editorRuntime,
  type AnyEditorCommandDefinition,
  type EditorExtension,
} from "@/domains/editor/public";
import {
  actionUnhandled,
} from "./result";
import type { ActionResult } from "./types";
import type {
  ActionChecker,
  ActionContext,
  ActionHandler,
  ActionId,
  SidebarActionId,
  ToolbarActionId,
} from "./types";
import type { ToolType } from "@/domains/canvas/public";
import { ACTION_CATALOG } from "./catalog";
import {
  editorHandlers,
  editorCheckers,
  sidebarHandlers,
  toolbarHandlers,
} from "./handlers";

// Combined handlers
const ACTION_HANDLERS: Record<string, ActionHandler<unknown>> = {
  ...(toolbarHandlers as Record<string, ActionHandler<unknown>>),
  ...(editorHandlers as Record<string, ActionHandler<unknown>>),
  ...(sidebarHandlers as Record<string, ActionHandler<unknown>>),
};

// Combined checkers
const ACTION_CHECKERS: Partial<Record<ActionId, ActionChecker>> = {
  ...editorCheckers,
};

const executeActionHandler = <T = unknown>(
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
    state: getCanvasState(),
    setTool: (options as Partial<ActionContext>).setTool ?? (() => {}),
    onUndo: (options as Partial<ActionContext>).onUndo ?? (() => {}),
    onRedo: (options as Partial<ActionContext>).onRedo ?? (() => {}),
  };

  return handler(options as T, fullContext);
};

export const createActionsExtension = (): EditorExtension<
  ReturnType<typeof getCanvasState>
> => ({
  id: "chardesk.actions",
  commands: Object.keys(ACTION_HANDLERS).map((actionId) => ({
    id: actionId as ActionId,
    canExecute: (_input, { state }) => {
      const checker = ACTION_CHECKERS[actionId as ActionId];
      return checker?.(state) ?? true;
    },
    execute: (input, { editor, source }) => {
      const options =
        input && typeof input === "object"
          ? (input as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      const setTool =
        typeof options.setTool === "function"
          ? (options.setTool as (tool: ToolType) => void)
          : (tool: ToolType) => {
              editor.setCurrentTool(tool);
            };
      const onUndo =
        typeof options.onUndo === "function"
          ? (options.onUndo as () => void)
          : editor.history.undo;
      const onRedo =
        typeof options.onRedo === "function"
          ? (options.onRedo as () => void)
          : editor.history.redo;
      return executeActionHandler(actionId as ActionId, {
        ...options,
        source: options.source ?? source,
        setTool,
        onUndo,
        onRedo,
      });
    },
  })) as AnyEditorCommandDefinition<ReturnType<typeof getCanvasState>>[],
  setup: () => {
    const disposers = Object.values(ACTION_CATALOG).flatMap((action) => {
      if (!action.shortcuts?.length) return [];
      return [
        editorRuntime.keymap.register({
          id: `action:${action.id}`,
          shortcuts: action.shortcuts.map((shortcut) => shortcut.join("+")),
          target: { type: "command", id: action.id },
        }),
      ];
    });
    return () => disposers.reverse().forEach((dispose) => dispose());
  },
});

// Compatibility entry while UI call sites migrate to editorRuntime.commands.
export const runAction = <T = unknown>(
  actionId: ActionId,
  options: T & Partial<ActionContext>,
  context?: ActionContext
): ActionResult => {
  if (!context && editorRuntime.commands.has(actionId)) {
    const source =
      options && typeof options === "object" && "source" in options
        ? String((options as { source?: unknown }).source ?? "api")
        : "api";
    return editorRuntime.commands.execute(actionId, options, source);
  }
  return executeActionHandler(actionId, options, context);
};

// Check if action can run
export const canRunAction = (
  actionId: ActionId,
  state?: ReturnType<typeof getCanvasState>
): boolean => {
  if (!state && editorRuntime.commands.has(actionId)) {
    return editorRuntime.commands.canExecute(actionId, undefined, "availability");
  }
  const resolvedState = state ?? getCanvasState();
  const checker = ACTION_CHECKERS[actionId];
  if (checker) {
    return checker(resolvedState);
  }
  // Default: allow if handler exists
  return actionId in ACTION_HANDLERS;
};

// Convenience function for toolbar actions
export const runToolbarAction = <T = unknown>(
  actionId: ToolbarActionId,
  options: T & Partial<Omit<ActionContext, "onUndo" | "onRedo">>
): ActionResult => {
  const fullContext: ActionContext = {
    state: getCanvasState(),
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
  const state = getCanvasState();
  const context: ActionContext = {
    state,
    setTool: () => {},
    onUndo: () => {},
    onRedo: () => {},
  };
  return runAction(actionId, options as T & Partial<ActionContext>, context);
};
