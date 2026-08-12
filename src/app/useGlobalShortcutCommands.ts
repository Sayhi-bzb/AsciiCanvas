import { resolveFillHotkeyChar } from "@/domains/actions/public";
import { useEditor, useEditorShortcutLayer } from "@/domains/editor/public";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";

export const useGlobalShortcutCommands = ({
  enabled = true,
}: {
  enabled?: boolean;
}) => {
  const editor = useEditor();
  useEditorShortcutLayer({ enabled });
  useShortcutLayer({
    id: "global-printable-selection-fill",
    priority: SHORTCUT_PRIORITY.globalAction,
    enabled,
    onKeyDown: (event, context) => {
      if (
        context.targetKind === "editable" ||
        context.targetKind === "managed-canvas" ||
        context.targetKind === "overlay"
      ) {
        return;
      }

      const fillChar = resolveFillHotkeyChar(event);
      if (!fillChar) return;
      const result = editor.commands.execute("fill-selection-char", {
        source: "global-hotkey",
        fillChar,
      }, "global-hotkey");
      return result.status === "succeeded"
        ? { claimed: true, preventDefault: true }
        : undefined;
    },
  });
};
