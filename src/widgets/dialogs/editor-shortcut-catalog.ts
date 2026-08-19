import type { I18nKey } from "@/shared/i18n";

/** Localized labels for legacy commands; the keymap snapshot owns catalog membership. */
export const EDITOR_SHORTCUT_LABEL_KEYS: Readonly<Partial<Record<string, I18nKey>>> = {
  "command:undo": "manual.shortcut.undo",
  "command:redo": "manual.shortcut.redo",
  "command:copy": "manual.shortcut.copy",
  "command:cut": "manual.shortcut.cut",
  "command:paste": "manual.shortcut.paste",
  "command:delete-selection": "manual.shortcut.delete",
};
