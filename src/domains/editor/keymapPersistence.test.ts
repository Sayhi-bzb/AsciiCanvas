import { describe, expect, it, vi } from "vitest";
import { EditorKeymap } from "./core/keymap";
import {
  connectEditorKeymapPersistence,
  EDITOR_KEYMAP_STORAGE_KEY,
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
  it("hydrates valid known bindings and ignores invalid or unknown entries", () => {
    const keymap = createKeymap();
    hydrateEditorKeymap(keymap, {
      getItem: () => JSON.stringify({
        version: 1,
        bindings: {
          "command:undo": ["Shift+Mod+U", "mod"],
          "command:missing": ["mod+m"],
        },
      }),
    });
    expect(keymap.getBindings("command:undo")).toEqual(["mod+shift+u"]);
    expect(keymap.getUserBindings()).toEqual({
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
      JSON.stringify({ version: 1, bindings: { "command:undo": ["mod+u"] } })
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
        version: 1,
        bindings: {
          "command:undo": [],
          "command:copy": ["mod+z"],
        },
      })
    );
  });
});
