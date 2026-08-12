import { normalizeShortcut } from "./shortcut";

export type KeymapTarget =
  | { type: "command"; id: string }
  | { type: "tool"; id: string };

export type KeymapEntry<Context = unknown> = {
  id: string;
  shortcuts: readonly string[];
  target: KeymapTarget;
  priority?: number;
  when?: (context: Context) => boolean;
};

export type RegisteredKeymapEntry<Context = unknown> = KeymapEntry<Context> & {
  owner: string;
};

export type KeymapResolution<Context = unknown> =
  | { type: "none" }
  | { type: "match"; entry: RegisteredKeymapEntry<Context> }
  | { type: "conflict"; shortcut: string; entries: RegisteredKeymapEntry<Context>[] };

export class EditorKeymap<Context = unknown> {
  readonly #entries = new Map<string, RegisteredKeymapEntry<Context>>();
  readonly #overrides = new Map<string, readonly string[]>();
  readonly #listeners = new Set<() => void>();

  register(owner: string, entry: KeymapEntry<Context>) {
    if (this.#entries.has(entry.id)) throw new Error(`Keymap entry ${entry.id} already exists`);
    const shortcuts = entry.shortcuts.map((shortcut) => {
      const value = normalizeShortcut(shortcut);
      if (!value) throw new Error(`Invalid shortcut ${shortcut}`);
      return value;
    });
    this.#entries.set(entry.id, { ...entry, shortcuts: [...new Set(shortcuts)], owner });
    this.#emit();
    return () => {
      if (!this.#entries.delete(entry.id)) return;
      this.#overrides.delete(entry.id);
      this.#emit();
    };
  }

  setUserBindings(entryId: string, shortcuts: readonly string[] | null) {
    if (!this.#entries.has(entryId)) throw new Error(`Unknown keymap entry ${entryId}`);
    if (shortcuts === null) this.#overrides.delete(entryId);
    else {
      const normalized = shortcuts.map((shortcut) => {
        const value = normalizeShortcut(shortcut);
        if (!value) throw new Error(`Invalid shortcut ${shortcut}`);
        return value;
      });
      this.#overrides.set(entryId, [...new Set(normalized)]);
    }
    this.#emit();
  }

  resetUserBindings() {
    if (this.#overrides.size === 0) return;
    this.#overrides.clear();
    this.#emit();
  }

  getUserBindings() {
    return Object.fromEntries(this.#overrides);
  }

  subscribe(listener: () => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  has(entryId: string) {
    return this.#entries.has(entryId);
  }

  getBindings(entryId: string) {
    const entry = this.#entries.get(entryId);
    if (!entry) return undefined;
    return this.#overrides.get(entryId) ?? entry.shortcuts;
  }

  resolve(shortcut: string, context: Context) {
    return [...this.#entries.values()]
      .filter((entry) => (this.#overrides.get(entry.id) ?? entry.shortcuts).includes(shortcut))
      .filter((entry) => entry.when?.(context) ?? true)
      .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
  }

  resolveBest(shortcut: string, context: Context): KeymapResolution<Context> {
    const matches = this.resolve(shortcut, context);
    const first = matches[0];
    if (!first) return { type: "none" };
    const priority = first.priority ?? 0;
    const tied = matches.filter((entry) => (entry.priority ?? 0) === priority);
    return tied.length === 1
      ? { type: "match", entry: first }
      : { type: "conflict", shortcut, entries: tied };
  }

  getConflicts(context: Context) {
    const byShortcut = new Map<string, string[]>();
    for (const entry of this.#entries.values()) {
      if (!(entry.when?.(context) ?? true)) continue;
      for (const shortcut of this.#overrides.get(entry.id) ?? entry.shortcuts) {
        const ids = byShortcut.get(shortcut) ?? [];
        ids.push(entry.id);
        byShortcut.set(shortcut, ids);
      }
    }
    return [...byShortcut.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([shortcut, entryIds]) => ({ shortcut, entryIds }));
  }

  #emit() {
    this.#listeners.forEach((listener) => listener());
  }
}
