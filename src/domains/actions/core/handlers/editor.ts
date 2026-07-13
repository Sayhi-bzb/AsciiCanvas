import { useEditorStore } from "@/domains/canvas/public";
import { exportStructuredHierarchyText } from "@/domains/export/public";
import { runEditorCommand } from "@/domains/actions/adapters/editorCommands";
import { getFirstGrapheme } from "@/shared/utils/characters";
import { getTextColumnWidth } from "@/domains/structured-content/public";
import {
  canSplitStructuredSplitBoxLeaf,
  getStructuredBoxNameEndPoint,
  getStructuredSplitBoxLeafAtPoint,
  isStructuredSplitBoxLineHandle,
} from "@/domains/structured-content/public";
import { clipboard, feedback } from "@/shared/services/effects";
import { getStructuredTextSelectionRange } from "@/domains/structured-content/public";
import type { StructuredBoxNode, StructuredTextNode } from "@/domains/structured-content/public";
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
type UndoRedoOptions = {
  onUndo?: () => void;
  onRedo?: () => void;
  managedTextarea?: HTMLTextAreaElement | null;
  source?: ActionSource;
};
type ClipboardOptions = {
  clipboardEvent?: ClipboardEvent;
  managedTextarea?: HTMLTextAreaElement | null;
  source?: ActionSource;
};
type FillOptions = { fillChar?: string };

const hasStructuredSelection = (
  state: ReturnType<typeof useEditorStore.getState>
) => state.canvasMode === "structured" && state.selectedStructuredNodeIds.length > 0;

const getContextSplitBox = (
  state: ReturnType<typeof useEditorStore.getState>
) => {
  if (
    state.canvasMode !== "structured" ||
    state.selectedStructuredNodeIds.length !== 1 ||
    !state.structuredContextPoint
  ) {
    return null;
  }
  const selectedId = state.selectedStructuredNodeIds[0];
  return (
    state.structuredScene.find(
      (node) => node.id === selectedId && node.type === "splitBox"
    ) ?? null
  );
};

const canSplitContextSplitBox = (
  state: ReturnType<typeof useEditorStore.getState>,
  axis: "horizontal" | "vertical"
) => {
  const splitBox = getContextSplitBox(state);
  if (!splitBox || splitBox.type !== "splitBox" || !state.structuredContextPoint) {
    return false;
  }
  if (state.selectedStructuredSplitHandle) return false;
  const leaf = getStructuredSplitBoxLeafAtPoint(
    splitBox,
    state.structuredContextPoint
  );
  return !!leaf && canSplitStructuredSplitBoxLeaf(leaf, axis);
};

const hasSelectedStructuredDivider = (
  state: ReturnType<typeof useEditorStore.getState>
) =>
  state.canvasMode === "structured" &&
  !!state.selectedStructuredSplitHandle &&
  isStructuredSplitBoxLineHandle(state.selectedStructuredSplitHandle.handle);

const hasStructuredTextSelection = (
  state: ReturnType<typeof useEditorStore.getState>
) =>
  state.canvasMode === "structured" &&
  !!getStructuredTextSelectionRange(state.structuredTextSelection);

const isStructuredBoxNode = (node: { type: string }): node is StructuredBoxNode =>
  node.type === "box";

const isStructuredTextNode = (node: { type: string }): node is StructuredTextNode =>
  node.type === "text";

const getSelectedStructuredBox = (
  state: ReturnType<typeof useEditorStore.getState>
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
  state: ReturnType<typeof useEditorStore.getState>
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
const canCopyOrCut = (state: ReturnType<typeof useEditorStore.getState>): boolean => {
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
      source: opts.source,
      managedTextarea: opts.managedTextarea,
      onUndo: opts.onUndo ?? context.onUndo,
    });
    return succeeded ? actionSucceeded() : actionFailed("precondition-failed");
  },

  redo: (options, context): ActionResult => {
    const opts = options as UndoRedoOptions;
    const succeeded = runEditorCommand("redo", {
      source: opts.source,
      managedTextarea: opts.managedTextarea,
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

  "structured-copy-hierarchy": (_options, context): ActionResult => {
    if (context.state.canvasMode !== "structured") {
      return actionFailed("not-supported-in-freeform");
    }
    if (context.state.structuredScene.length === 0) {
      return actionFailed("empty-scene");
    }
    const text = exportStructuredHierarchyText(
      context.state.structuredScene,
      context.state.selectedStructuredNodeIds,
      context.state.structuredComponents
    );
    void clipboard.writeText(text).then((copied) => {
      if (!copied) {
        feedback.error("Copy failed", {
          description: "Could not write structure hierarchy to clipboard.",
        });
      }
    });
    return actionSucceeded();
  },

  "structured-split-horizontal": (_options, context): ActionResult => {
    const point = context.state.structuredContextPoint;
    const splitBox = getContextSplitBox(context.state);
    if (!point || !splitBox || splitBox.type !== "splitBox") {
      return actionFailed("empty-selection");
    }
    return context.state.splitStructuredSplitBoxLeaf(splitBox.id, point, "horizontal")
      ? actionSucceeded()
      : actionFailed("precondition-failed");
  },

  "structured-split-vertical": (_options, context): ActionResult => {
    const point = context.state.structuredContextPoint;
    const splitBox = getContextSplitBox(context.state);
    if (!point || !splitBox || splitBox.type !== "splitBox") {
      return actionFailed("empty-selection");
    }
    return context.state.splitStructuredSplitBoxLeaf(splitBox.id, point, "vertical")
      ? actionSucceeded()
      : actionFailed("precondition-failed");
  },

  "structured-delete-divider": (_options, context): ActionResult => {
    if (!hasSelectedStructuredDivider(context.state)) {
      return actionFailed("empty-selection");
    }
    context.state.deleteSelection();
    return actionSucceeded();
  },
};

// Editor action checkers
export const editorCheckers: Partial<Record<EditorActionId, (state: ReturnType<typeof useEditorStore.getState>) => boolean>> = {
  copy: (state) =>
    state.canvasMode === "structured"
      ? state.structuredScene.length > 0
      : state.canCopyOrCut(),
  "copy-rich": (state) =>
    state.canvasMode !== "structured" && state.canCopyOrCut(),
  "copy-ansi": (state) =>
    state.canvasMode !== "structured" && state.canCopyOrCut(),
  cut: (state) =>
    state.canvasMode === "structured"
      ? hasStructuredTextSelection(state)
      : state.canCopyOrCut(),
  "snapshot-png": (state) => state.selections.length > 0,
  "delete-selection": (state) =>
    state.selections.length > 0 || hasStructuredSelection(state),
  "structured-rename": (state) => getSelectedStructuredEditCursor(state) !== null,
  "structured-bring-forward": hasStructuredSelection,
  "structured-send-backward": hasStructuredSelection,
  "structured-bring-to-front": hasStructuredSelection,
  "structured-send-to-back": hasStructuredSelection,
  "structured-duplicate": hasStructuredSelection,
  "structured-copy-hierarchy": (state) =>
    state.canvasMode === "structured" && state.structuredScene.length > 0,
  "structured-split-horizontal": (state) =>
    canSplitContextSplitBox(state, "horizontal"),
  "structured-split-vertical": (state) =>
    canSplitContextSplitBox(state, "vertical"),
  "structured-delete-divider": hasSelectedStructuredDivider,
  "fill-selection-char": (state) =>
    state.canvasMode !== "structured" &&
    state.selections.length > 0 &&
    state.textCursor === null,
};

