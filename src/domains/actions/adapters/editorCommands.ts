import { useEditorStore } from "@/domains/canvas/public";
import type { ClipboardCommandResult } from "@/domains/canvas/public";
import { runRedo, runUndo } from "./shortcutActions";
import {
  resolveActionShortcut,
  type ActionShortcutEvent,
} from "@/domains/actions/core/shortcuts";
import type { ActionId, ActionSource } from "@/domains/actions/core/types";
import {
  shouldIgnoreEditorCommandByFocus,
} from "@/domains/actions/input-arbiter";
import { getFirstGrapheme } from "@/shared/utils/characters";
import { getStructuredTextSelectionRange } from "@/domains/structured-content/public";

type EditorCommand = Extract<
  ActionId,
  "undo" | "redo" | "copy" | "copy-rich" | "copy-ansi" | "cut" | "paste" | "fill-selection-char"
>;
type CommandSource = ActionSource;

type RunEditorCommandOptions = {
  source?: CommandSource;
  managedTextarea?: HTMLTextAreaElement | null;
  clipboardEvent?: ClipboardEvent;
  fillChar?: string;
  onUndo?: () => boolean | void;
  onRedo?: () => boolean | void;
};

export const resolveHistoryShortcutCommand = (
  event: ActionShortcutEvent
): "undo" | "redo" | null =>
  resolveActionShortcut(event, ["undo", "redo"] as const);

export const runEditorCommand = (
  command: EditorCommand,
  options: RunEditorCommandOptions = {}
): boolean | Promise<ClipboardCommandResult> => {
  const source = options.source ?? "global-hotkey";
  if (shouldIgnoreEditorCommandByFocus(source, options.managedTextarea)) return false;

  const state = useEditorStore.getState();

  switch (command) {
    case "undo":
      return options.onUndo ? options.onUndo() !== false : runUndo();
    case "redo":
      return options.onRedo ? options.onRedo() !== false : runRedo();
    case "copy":
    case "copy-rich":
    case "copy-ansi":
      if (
        state.canvasMode === "structured" &&
        (command === "copy-rich" || command === "copy-ansi")
      ) {
        return false;
      }
      if (!state.canCopyOrCut()) return false;
      return state.copySelection({
        event: options.clipboardEvent,
        rich: command === "copy" || command === "copy-rich",
        ansi: command === "copy-ansi",
      });
    case "cut":
      if (state.canvasMode === "structured") {
        const hasStructuredTextSelection = !!getStructuredTextSelectionRange(
          state.structuredTextSelection
        );
        if (!hasStructuredTextSelection && state.selectedStructuredNodeIds.length === 0) {
          return false;
        }
        return state.cutSelection({ event: options.clipboardEvent });
      }
      if (!state.canCopyOrCut()) return false;
      return state.cutSelection({ event: options.clipboardEvent });
    case "paste":
      return state.pasteFromClipboard({
        eventDataTransfer: options.clipboardEvent?.clipboardData || undefined,
      });
    case "fill-selection-char": {
      if (state.canvasMode === "structured") return false;
      const fillChar = options.fillChar ? getFirstGrapheme(options.fillChar) : "";
      if (!fillChar) return false;
      const { selections, textCursor } = state;
      if (selections.length === 0 || textCursor) return false;
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return false;
      state.fillSelectionsWithChar(fillChar);
      return true;
    }
    default:
      return false;
  }
};
