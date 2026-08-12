import type { CanvasRuntime, CanvasState } from "@/domains/canvas/public";
import {
  type EditorCommandDefinition,
  type EditorExtension,
} from "@/domains/editor/public";
import {
  actionUnhandled,
} from "./result";
import type {
  ActionChecker,
  ActionContext,
  ActionHandler,
  ActionSource,
  EditorActionId,
} from "./types";
import { EDITOR_COMMAND_META } from "./catalog";
import {
  editorHandlers,
  editorCheckers,
} from "./handlers";

// Combined checkers
const ACTION_CHECKERS: Partial<Record<EditorActionId, ActionChecker>> = {
  ...editorCheckers,
};

const CANVAS_FOCUS_COMMANDS = new Set<EditorActionId>([
  "copy",
  "cut",
  "paste",
  "delete-selection",
]);

export type EditorCommandOptions = {
  source?: ActionSource;
  managedTextarea?: HTMLTextAreaElement | null;
  clipboardEvent?: ClipboardEvent;
  fillChar?: string;
  onUndo?: () => boolean | void;
  onRedo?: () => boolean | void;
};

type EditorCommandDescriptor = EditorCommandDefinition<
  CanvasState,
  EditorCommandOptions | void
>;

const createCommand = (
  canvas: Pick<CanvasRuntime, "commands" | "queries" | "getState">,
  id: EditorActionId
): EditorCommandDescriptor => ({
  id,
  canExecute: (_input, { state }) => ACTION_CHECKERS[id]?.(state) ?? true,
  execute: (input, { editor, source, state }) => {
    const handler = editorHandlers[id] as ActionHandler<EditorCommandOptions> | undefined;
    if (!handler) return actionUnhandled("unknown-command");
    const options = input ?? {};
    const context: ActionContext = {
      state: state as CanvasState,
      canvas,
      setTool: (tool) => {
        editor.setCurrentTool(tool);
      },
      onUndo: editor.history.undo,
      onRedo: editor.history.redo,
    };
    return handler(
      { ...options, source: options.source ?? (source as ActionSource) },
      context
    );
  },
});

export const createEditorCommands = (
  canvas: Pick<CanvasRuntime, "commands" | "queries" | "getState">
) =>
  Object.fromEntries(
    (Object.keys(EDITOR_COMMAND_META) as EditorActionId[]).map((id) => [
      id,
      createCommand(canvas, id),
    ])
  ) as Record<EditorActionId, EditorCommandDescriptor>;

export const createEditorCommandsExtension = (
  canvas: Pick<CanvasRuntime, "commands" | "queries" | "getState">
): EditorExtension<CanvasState> => {
  const commands = createEditorCommands(canvas);
  return {
  id: "chardesk.editor-commands",
  commands: Object.values(commands),
  keybindings: Object.values(EDITOR_COMMAND_META).flatMap((command) =>
    command.shortcuts?.length
      ? [{
          id: `command:${command.id}`,
          shortcuts: command.shortcuts.map((shortcut) => shortcut.join("+")),
          target: { type: "command" as const, id: command.id },
          when: ({ targetKind, state }) =>
            targetKind !== "editable" &&
            targetKind !== "overlay" &&
            targetKind !== "canvas-ui" &&
            (!CANVAS_FOCUS_COMMANDS.has(command.id) ||
              targetKind === "managed-canvas" ||
              targetKind === "canvas-surface") &&
            (command.id !== "delete-selection" ||
              (!state.textCursor &&
                !state.editingStructuredTextNodeId &&
                !state.structuredTextSelection)),
        }]
      : []
  ),
  };
};
