import type { EditorKeymap } from "./core/keymap";
import { normalizeShortcut } from "./core/shortcut";

export const EDITOR_KEYMAP_STORAGE_KEY = "chardesk-editor-keymap-v1";

type PersistedKeymap = {
  version: 1;
  bindings: Record<string, string[]>;
};

const decode = (raw: string | null): PersistedKeymap | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PersistedKeymap>;
    if (value.version !== 1 || !value.bindings || typeof value.bindings !== "object") {
      return null;
    }
    return { version: 1, bindings: value.bindings as Record<string, string[]> };
  } catch {
    return null;
  }
};

export const hydrateEditorKeymap = <Context>(
  keymap: EditorKeymap<Context>,
  storage: Pick<Storage, "getItem">
) => {
  let persisted: PersistedKeymap | null = null;
  try {
    persisted = decode(storage.getItem(EDITOR_KEYMAP_STORAGE_KEY));
  } catch {
    return;
  }
  for (const [entryId, shortcuts] of Object.entries(persisted?.bindings ?? {})) {
    if (!keymap.has(entryId) || !Array.isArray(shortcuts)) continue;
    const normalized = shortcuts
      .map((shortcut) => (typeof shortcut === "string" ? normalizeShortcut(shortcut) : null))
      .filter((shortcut): shortcut is string => shortcut !== null);
    if (shortcuts.length > 0 && normalized.length === 0) continue;
    keymap.setUserBindings(entryId, normalized);
  }
};

export const persistEditorKeymap = <Context>(
  keymap: EditorKeymap<Context>,
  storage: Pick<Storage, "setItem">
) => {
  const value: PersistedKeymap = {
    version: 1,
    bindings: Object.fromEntries(
      Object.entries(keymap.getUserBindings()).map(([id, shortcuts]) => [id, [...shortcuts]])
    ),
  };
  try {
    storage.setItem(EDITOR_KEYMAP_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage is an optional device-local adapter.
  }
};

export const connectEditorKeymapPersistence = <Context>(
  keymap: EditorKeymap<Context>,
  storage: Pick<Storage, "getItem" | "setItem">
) => {
  hydrateEditorKeymap(keymap, storage);
  return keymap.subscribe(() => persistEditorKeymap(keymap, storage));
};
