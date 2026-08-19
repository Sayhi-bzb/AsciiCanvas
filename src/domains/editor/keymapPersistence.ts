import type { EditorKeymap } from "./core/keymap";
import { normalizeShortcut } from "./core/shortcut";

export const EDITOR_KEYMAP_STORAGE_KEY = "chardesk-editor-keymap-v2";
export const LEGACY_EDITOR_KEYMAP_STORAGE_KEY = "chardesk-editor-keymap-v1";

type PersistedKeymap = {
  version: 1 | 2;
  bindings: Record<string, string[]>;
};

const decode = (raw: string | null, expectedVersion: 1 | 2): PersistedKeymap | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PersistedKeymap>;
    if (value.version !== expectedVersion ||
      !value.bindings || typeof value.bindings !== "object") {
      return null;
    }
    return { version: value.version, bindings: value.bindings as Record<string, string[]> };
  } catch {
    return null;
  }
};

export const hydrateEditorKeymap = <Context>(
  keymap: EditorKeymap<Context>,
  storage: Pick<Storage, "getItem">
) => {
  let persisted: PersistedKeymap | null = null;
  let source: "v1" | "v2" | null = null;
  try {
    persisted = decode(storage.getItem(EDITOR_KEYMAP_STORAGE_KEY), 2);
    source = persisted ? "v2" : null;
    if (!persisted) {
      persisted = decode(storage.getItem(LEGACY_EDITOR_KEYMAP_STORAGE_KEY), 1);
      source = persisted ? "v1" : null;
    }
  } catch {
    return null;
  }
  const bindings: Record<string, string[]> = {};
  for (const [entryId, shortcuts] of Object.entries(persisted?.bindings ?? {})) {
    if (!Array.isArray(shortcuts)) continue;
    const normalized = shortcuts
      .map((shortcut) => (typeof shortcut === "string" ? normalizeShortcut(shortcut) : null))
      .filter((shortcut): shortcut is string => shortcut !== null);
    if (shortcuts.length > 0 && normalized.length === 0) continue;
    bindings[entryId] = normalized;
  }
  keymap.hydrateUserBindings(bindings);
  return source;
};

export const persistEditorKeymap = <Context>(
  keymap: EditorKeymap<Context>,
  storage: Pick<Storage, "setItem">
) => {
  const value: PersistedKeymap = {
    version: 2,
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
  const source = hydrateEditorKeymap(keymap, storage);
  if (source === "v1") persistEditorKeymap(keymap, storage);
  return keymap.subscribe(() => persistEditorKeymap(keymap, storage));
};
