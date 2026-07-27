import { useEditorStore } from "@/domains/canvas/public";
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
  onUndo?: () => void;
  onRedo?: () => void;
};

export const resolveHistoryShortcutCommand = (
  event: ActionShortcutEvent
): "undo" | "redo" | null =>
  resolveActionShortcut(event, ["undo", "redo"] as const);

export const runEditorCommand = (
  command: EditorCommand,
  options: RunEditorCommandOptions = {}
) => {
  const source = options.source ?? "global-hotkey";
  if (shouldIgnoreEditorCommandByFocus(source, options.managedTextarea)) return false;

  const state = useEditorStore.getState();

  switch (command) {
    case "undo":
      if (options.onUndo) options.onUndo();
      else runUndo();
      return true;
    case "redo":
      if (options.onRedo) options.onRedo();
      else runRedo();
      return true;
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
      void state.copySelection({
        event: options.clipboardEvent,
        rich: command === "copy" || command === "copy-rich",
        ansi: command === "copy-ansi",
      });
      return true;
    case "cut":
      if (state.canvasMode === "structured") {
        const hasStructuredTextSelection = !!getStructuredTextSelectionRange(
          state.structuredTextSelection
        );
        void state.cutSelection({ event: options.clipboardEvent });
        return hasStructuredTextSelection;
      }
      if (!state.canCopyOrCut()) return false;
      void state.cutSelection({ event: options.clipboardEvent });
      return true;
    case "paste":
      if (state.canvasMode === "structured") {
        void state.pasteFromClipboard({
          eventDataTransfer: options.clipboardEvent?.clipboardData || undefined,
        });
        return true;
      }
      void state.pasteFromClipboard({
        eventDataTransfer: options.clipboardEvent?.clipboardData || undefined,
      });
      return true;
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
