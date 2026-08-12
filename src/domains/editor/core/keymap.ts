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

export class EditorKeymap<Context = unknown> {
  readonly #entries = new Map<string, KeymapEntry<Context>>();
  readonly #overrides = new Map<string, readonly string[]>();

  register(entry: KeymapEntry<Context>) {
    if (this.#entries.has(entry.id)) throw new Error(`Keymap entry ${entry.id} already exists`);
    this.#entries.set(entry.id, entry);
    return () => this.#entries.delete(entry.id);
  }

  setUserBindings(entryId: string, shortcuts: readonly string[] | null) {
    if (!this.#entries.has(entryId)) throw new Error(`Unknown keymap entry ${entryId}`);
    if (shortcuts === null) this.#overrides.delete(entryId);
    else this.#overrides.set(entryId, [...new Set(shortcuts)]);
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
}
