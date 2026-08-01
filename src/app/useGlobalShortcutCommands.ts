import {
  matchesActionShortcut,
  resolveFillHotkeyChar,
  runAction,
} from "@/domains/actions/public";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";

export const useGlobalShortcutCommands = ({
  onUndo,
  onRedo,
}: {
  onUndo: () => void;
  onRedo: () => void;
}) => {
  useShortcutLayer({
    id: "global-editor-commands",
    priority: SHORTCUT_PRIORITY.globalAction,
    onKeyDown: (event, context) => {
      if (
        context.targetKind === "editable" ||
        context.targetKind === "managed-canvas" ||
        context.targetKind === "overlay"
      ) {
        return;
      }

      const historyCommand = matchesActionShortcut("undo", event)
        ? "undo"
        : matchesActionShortcut("redo", event)
          ? "redo"
          : null;
      if (historyCommand) {
        const result = runAction(historyCommand, {
          source: "global-hotkey",
          onUndo,
          onRedo,
        });
        return result.succeeded
          ? { claimed: true, preventDefault: true }
          : undefined;
      }

      const fillChar = resolveFillHotkeyChar(event);
      if (!fillChar) return;
      const result = runAction("fill-selection-char", {
        source: "global-hotkey",
        fillChar,
      });
      return result.succeeded
        ? { claimed: true, preventDefault: true }
        : undefined;
    },
  });
};
