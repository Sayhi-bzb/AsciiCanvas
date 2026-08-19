import { describe, expect, it, vi } from "vitest";
import { EditorKeymap } from "./core/keymap";
import {
  connectEditorKeymapPersistence,
  EDITOR_KEYMAP_STORAGE_KEY,
  LEGACY_EDITOR_KEYMAP_STORAGE_KEY,
  hydrateEditorKeymap,
} from "./keymapPersistence";

const createKeymap = () => {
  const keymap = new EditorKeymap();
  keymap.register("test", {
    id: "command:undo",
    shortcuts: ["mod+z"],
    target: { type: "command", id: "undo" },
  });
  return keymap;
};

describe("editor keymap persistence", () => {
  it("hydrates valid bindings, preserves dynamic entries, and ignores invalid shortcuts", () => {
    const keymap = createKeymap();
    hydrateEditorKeymap(keymap, {
      getItem: (key) => key === LEGACY_EDITOR_KEYMAP_STORAGE_KEY ? JSON.stringify({
        version: 1,
        bindings: {
          "command:undo": ["Shift+Mod+U", "mod"],
          "command:missing": ["mod+m"],
        },
      }) : null,
    });
    expect(keymap.getBindings("command:undo")).toEqual(["mod+shift+u"]);
    expect(keymap.getUserBindings()).toEqual({
      "command:missing": ["mod+m"],
      "command:undo": ["mod+shift+u"],
    });
  });

  it("persists changes and tolerates unavailable storage", () => {
    const keymap = createKeymap();
    const setItem = vi.fn();
    const disconnect = connectEditorKeymapPersistence(keymap, {
      getItem: () => null,
      setItem,
    });
    keymap.setUserBindings("command:undo", ["mod+u"]);
    expect(setItem).toHaveBeenCalledWith(
      EDITOR_KEYMAP_STORAGE_KEY,
      JSON.stringify({ version: 2, bindings: { "command:undo": ["mod+u"] } })
    );
    disconnect();

    expect(() =>
      hydrateEditorKeymap(keymap, { getItem: () => { throw new Error("blocked"); } })
    ).not.toThrow();
  });

  it("persists an atomic multi-entry update once", () => {
    const keymap = createKeymap();
    keymap.register("test", {
      id: "command:copy",
      shortcuts: ["mod+c"],
      target: { type: "command", id: "copy" },
    });
    const setItem = vi.fn();
    connectEditorKeymapPersistence(keymap, {
      getItem: () => null,
      setItem,
    });

    keymap.updateUserBindings({
      "command:undo": [],
      "command:copy": ["mod+z"],
    });

    expect(setItem).toHaveBeenCalledOnce();
    expect(setItem).toHaveBeenCalledWith(
      EDITOR_KEYMAP_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        bindings: {
          "command:undo": [],
          "command:copy": ["mod+z"],
        },
      })
    );
  });

  it("migrates v1 bindings to v2 without deleting the legacy value", () => {
    const keymap = createKeymap();
    const setItem = vi.fn();
    connectEditorKeymapPersistence(keymap, {
      getItem: (key) => key === LEGACY_EDITOR_KEYMAP_STORAGE_KEY
        ? JSON.stringify({ version: 1, bindings: { "command:undo": [] } })
        : null,
      setItem,
    });

    expect(keymap.getBindings("command:undo")).toEqual([]);
    expect(setItem).toHaveBeenCalledWith(
      EDITOR_KEYMAP_STORAGE_KEY,
      JSON.stringify({ version: 2, bindings: { "command:undo": [] } })
    );
  });
});
