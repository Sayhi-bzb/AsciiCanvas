import type { EditorActionId } from "@/domains/actions/public";
import type { I18nKey } from "@/shared/i18n";

export const EDITABLE_EDITOR_SHORTCUTS = [
  { commandId: "undo", labelKey: "manual.shortcut.undo" },
  { commandId: "redo", labelKey: "manual.shortcut.redo" },
  { commandId: "copy", labelKey: "manual.shortcut.copy" },
  { commandId: "cut", labelKey: "manual.shortcut.cut" },
  { commandId: "paste", labelKey: "manual.shortcut.paste" },
  { commandId: "delete-selection", labelKey: "manual.shortcut.delete" },
] as const satisfies readonly {
  commandId: EditorActionId;
  labelKey: I18nKey;
}[];

export const getEditorShortcutEntryId = (commandId: EditorActionId) =>
  `command:${commandId}`;
