import { useEditor } from "./react";
import { shortcutFromKeyboardEvent } from "./core/shortcut";
import type { EditorRuntime } from "./core/runtime";
import type { CanvasState } from "@/domains/canvas/public";
import type { ShortcutTargetKind } from "@/shared/utils/dom-focus";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";

export const resolveEditorKeymapEvent = (
  editor: EditorRuntime<CanvasState>,
  event: KeyboardEvent,
  targetKind: ShortcutTargetKind,
  phase: "keydown" | "keyup" = "keydown"
) => {
  const shortcut = shortcutFromKeyboardEvent(event);
  if (!shortcut) return { type: "none" as const };
  return editor.keymap.resolveBest(shortcut, {
    state: editor.getState(),
    targetKind,
    phase,
  });
};

export const executeEditorKeymapEvent = (
  editor: EditorRuntime<CanvasState>,
  event: KeyboardEvent,
  targetKind: ShortcutTargetKind
) => {
  const resolution = resolveEditorKeymapEvent(editor, event, targetKind);
  if (resolution.type !== "match") return resolution;
  const { target } = resolution.entry;
  if (target.type === "tool") {
    return editor.setCurrentTool(target.id)
      ? { type: "executed" as const }
      : { type: "none" as const };
  }
  const result = editor.commands.execute(target.id, undefined, "keyboard");
  return result.status === "succeeded" || result.status === "pending"
    ? { type: "executed" as const, result }
    : { type: "none" as const };
};

export const useEditorShortcutLayer = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const editor = useEditor();
  useShortcutLayer({
    id: "editor-keymap",
    priority: SHORTCUT_PRIORITY.globalAction,
    enabled,
    onKeyDown: (event, context) => {
      if (event.repeat) return;
      const result = executeEditorKeymapEvent(editor, event, context.targetKind);
      return result.type === "executed"
        ? { claimed: true, preventDefault: true }
        : undefined;
    },
  });
};
