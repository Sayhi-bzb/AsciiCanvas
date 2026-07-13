import type { ActionSource } from "@/domains/actions/core/types";
import { shouldIgnoreClipboardShortcut } from "@/shared/utils/dom-focus";
import { getFirstGrapheme } from "@/shared/utils/characters";

const isCommandBypassingFocusGuard = (source: ActionSource) => {
  return source === "context-menu" || source === "canvas-keydown";
};

const isNamedKey = (key: string) =>
  key.length > 1 && /^[A-Za-z][A-Za-z0-9]*$/.test(key);

export const shouldIgnoreEditorCommandByFocus = (
  source: ActionSource,
  managedTextarea?: HTMLTextAreaElement | null
) => {
  if (isCommandBypassingFocusGuard(source)) return false;
  return shouldIgnoreClipboardShortcut(document.activeElement, managedTextarea);
};

export const resolveFillHotkeyChar = (
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "key">
) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (!event.key) return null;
  if (
    event.key === "Dead" ||
    event.key === "Process" ||
    event.key === "Unidentified"
  ) {
    return null;
  }
  if (isNamedKey(event.key)) return null;

  const char = getFirstGrapheme(event.key);
  return char || null;
};
