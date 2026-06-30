import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { runEditorCommand } from "@/domains/actions/adapters/editorCommands";
import { getFirstGrapheme } from "@/shared/utils/characters";
import { getTextColumnWidth } from "@/shared/utils/structured";
import { getStructuredBoxNameEndPoint } from "@/domains/canvas/state/helpers/structuredBoxEditing";
import type { StructuredBoxNode, StructuredTextNode } from "@/shared/types";
import {
  actionFailed,
  actionSucceeded,
} from "../result";
import type {
  ActionHandler,
  ActionResult,
  ActionSource,
  EditorActionId,
} from "../types";

// Options types for each action
type UndoRedoOptions = { onUndo?: () => void; onRedo?: () => void };
type ClipboardOptions = {
  clipboardEvent?: ClipboardEvent;
  managedTextarea?: HTMLTextAreaElement | null;
  source?: ActionSource;
};
type FillOptions = { fillChar?: string };

const hasStructuredSelection = (
  state: ReturnType<typeof useCanvasStore.getState>
) => state.canvasMode === "structured" && state.selectedStructuredNodeIds.length > 0;

const isStructuredBoxNode = (node: { type: string }): node is StructuredBoxNode =>
  node.type === "box";

const isStructuredTextNode = (node: { type: string }): node is StructuredTextNode =>
  node.type === "text";

const getSelectedStructuredBox = (
  state: ReturnType<typeof useCanvasStore.getState>
) => {
  if (state.canvasMode !== "structured" || !state.selectedStructuredBoxId) return null;
  return (
    state.structuredScene.find(
      (node): node is StructuredBoxNode =>
        node.id === state.selectedStructuredBoxId && isStructuredBoxNode(node)
    ) ?? null
  );
};

const getSelectedStructuredEditCursor = (
  state: ReturnType<typeof useCanvasStore.getState>
) => {
  const box = getSelectedStructuredBox(state);
  if (box) return getStructuredBoxNameEndPoint(box);
  if (state.canvasMode !== "structured" || state.selectedStructuredNodeIds.length !== 1) return null;
  const selectedId = state.selectedStructuredNodeIds[0];
  const text = state.structuredScene.find(
    (node): node is StructuredTextNode =>
      node.id === selectedId && isStructuredTextNode(node)
  );
  if (!text) return null;
  return {
    x: text.position.x + getTextColumnWidth(text.text),
    y: text.position.y,
  };
};

// Check if action can run
const canCopyOrCut = (state: ReturnType<typeof useCanvasStore.getState>): boolean => {
  return state.canCopyOrCut();
};

// Editor action handlers
export const editorHandlers: Record<
  EditorActionId,
  ActionHandler<unknown>
> = {
  undo: (options, context): ActionResult => {
    const opts = options as UndoRedoOptions;
    const succeeded = runEditorCommand("undo", {
      source: "keyboard",
      onUndo: opts.onUndo ?? context.onUndo,
    });
    return succeeded ? actionSucceeded() : actionFailed("precondition-failed");
  },

  redo: (options, context): ActionResult => {
    const opts = options as UndoRedoOptions;
    const succeeded = runEditorCommand("redo", {
      source: "keyboard",
      onRedo: opts.onRedo ?? context.onRedo,
    });
    return succeeded ? actionSucceeded() : actionFailed("precondition-failed");
  },

  copy: (options, context): ActionResult => {
    const opts = options as ClipboardOptions;
    if (context.state.canvasMode === "structured") {
      if (context.state.structuredScene.length === 0) {
        return actionFailed("empty-scene");
      }
    } else if (!canCopyOrCut(context.state)) {
      return actionFailed("empty-selection");
    }
    const succeeded = runEditorCommand("copy", {
      source: opts.source ?? "keyboard",
      clipboardEvent: opts.clipboardEvent,
      managedTextarea: opts.managedTextarea,
    });
    return succeeded ? actionSucceeded() : actionFailed("command-failed");
  },

  "copy-rich": (options, context): ActionResult => {
    const opts = options as ClipboardOptions;
    if (context.state.canvasMode === "structured") {
      return actionFailed("not-supported-in-structured");
    }
    if (!canCopyOrCut(context.state)) {
      return actionFailed("empty-selection");
    }
    const succeeded = runEditorCommand("copy-rich", {
      source: opts.source ?? "keyboard",
      clipboardEvent: opts.clipboardEvent,
      managedTextarea: opts.managedTextarea,
    });
    return succeeded ? actionSucceeded() : actionFailed("command-failed");
  },

  "copy-ansi": (options, context): ActionResult => {
    const opts = options as ClipboardOptions;
    if (context.state.canvasMode === "structured") {
      return actionFailed("not-supported-in-structured");
    }
    if (!canCopyOrCut(context.state)) {
      return actionFailed("empty-selection");
    }
    const succeeded = runEditorCommand("copy-ansi", {
      source: opts.source ?? "keyboard",
      clipboardEvent: opts.clipboardEvent,
      managedTextarea: opts.managedTextarea,
    });
    return succeeded ? actionSucceeded() : actionFailed("command-failed");
  },

  cut: (options, context): ActionResult => {
    const opts = options as ClipboardOptions;
    if (context.state.canvasMode === "structured") {
      return actionFailed("not-supported-in-structured");
    }
    if (!canCopyOrCut(context.state)) {
      return actionFailed("empty-selection");
    }
    const succeeded = runEditorCommand("cut", {
      source: opts.source ?? "keyboard",
      clipboardEvent: opts.clipboardEvent,
      managedTextarea: opts.managedTextarea,
    });
    return succeeded ? actionSucceeded() : actionFailed("command-failed");
  },

  paste: (options): ActionResult => {
    const opts = options as ClipboardOptions;
    const succeeded = runEditorCommand("paste", {
      source: opts.source ?? "keyboard",
      clipboardEvent: opts.clipboardEvent,
      managedTextarea: opts.managedTextarea,
    });
    return succeeded ? actionSucceeded() : actionFailed("command-failed");
  },

  "fill-selection-char": (options, context): ActionResult => {
    const opts = options as FillOptions;
    if (context.state.canvasMode === "structured") {
      return actionFailed("not-supported-in-structured");
    }
    const fillChar = opts.fillChar ? getFirstGrapheme(opts.fillChar) : "";
    if (!fillChar) {
      return actionFailed("no-fill-char");
    }
    const hasTextCursor = context.state.textCursor !== null;
    if (context.state.selections.length === 0 || hasTextCursor) {
      return actionFailed("no-selection");
    }
    const succeeded = runEditorCommand("fill-selection-char", {
      source: "keyboard",
      fillChar,
    });
    return succeeded ? actionSucceeded() : actionFailed("command-failed");
  },

  "snapshot-png": (_options, context): ActionResult => {
    if (context.state.selections.length === 0) {
      return actionFailed("empty-selection");
    }
    void context.state.copySelectionAsPng(context.state.showGrid);
    return actionSucceeded();
  },

  "delete-selection": (_options, context): ActionResult => {
    if (context.state.selections.length === 0 && !hasStructuredSelection(context.state)) {
      return actionFailed("empty-selection");
    }
    context.state.deleteSelection();
    return actionSucceeded();
  },

  "structured-rename": (_options, context): ActionResult => {
    const cursor = getSelectedStructuredEditCursor(context.state);
    if (!cursor) return actionFailed("empty-selection");
    context.state.setTextCursor(cursor);
    return actionSucceeded();
  },

  "structured-bring-forward": (_options, context): ActionResult => {
    if (!hasStructuredSelection(context.state)) return actionFailed("empty-selection");
    context.state.reorderStructuredSelection("forward");
    return actionSucceeded();
  },

  "structured-send-backward": (_options, context): ActionResult => {
    if (!hasStructuredSelection(context.state)) return actionFailed("empty-selection");
    context.state.reorderStructuredSelection("backward");
    return actionSucceeded();
  },

  "structured-bring-to-front": (_options, context): ActionResult => {
    if (!hasStructuredSelection(context.state)) return actionFailed("empty-selection");
    context.state.reorderStructuredSelection("front");
    return actionSucceeded();
  },

  "structured-send-to-back": (_options, context): ActionResult => {
    if (!hasStructuredSelection(context.state)) return actionFailed("empty-selection");
    context.state.reorderStructuredSelection("back");
    return actionSucceeded();
  },

  "structured-duplicate": (_options, context): ActionResult => {
    if (!hasStructuredSelection(context.state)) return actionFailed("empty-selection");
    const duplicatedIds = context.state.duplicateStructuredSelection();
    return duplicatedIds.length > 0 ? actionSucceeded() : actionFailed("empty-selection");
  },
};

// Editor action checkers
export const editorCheckers: Partial<Record<EditorActionId, (state: ReturnType<typeof useCanvasStore.getState>) => boolean>> = {
  copy: (state) =>
    state.canvasMode === "structured"
      ? state.structuredScene.length > 0
      : state.canCopyOrCut(),
  "copy-rich": (state) =>
    state.canvasMode !== "structured" && state.canCopyOrCut(),
  "copy-ansi": (state) =>
    state.canvasMode !== "structured" && state.canCopyOrCut(),
  cut: (state) =>
    state.canvasMode !== "structured" && state.canCopyOrCut(),
  "snapshot-png": (state) => state.selections.length > 0,
  "delete-selection": (state) =>
    state.selections.length > 0 || hasStructuredSelection(state),
  "structured-rename": (state) => getSelectedStructuredEditCursor(state) !== null,
  "structured-bring-forward": hasStructuredSelection,
  "structured-send-backward": hasStructuredSelection,
  "structured-bring-to-front": hasStructuredSelection,
  "structured-send-to-back": hasStructuredSelection,
  "structured-duplicate": hasStructuredSelection,
  "fill-selection-char": (state) =>
    state.canvasMode !== "structured" &&
    state.selections.length > 0 &&
    state.textCursor === null,
};

