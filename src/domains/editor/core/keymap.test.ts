import { describe, expect, it } from "vitest";
import { EditorKeymap } from "./keymap";

describe("EditorKeymap", () => {
  it("applies overrides and orders contextual matches by priority", () => {
    const keymap = new EditorKeymap<{ editing: boolean }>();
    keymap.register("test", {
      id: "global.undo",
      shortcuts: ["mod+z"],
      target: { type: "command", id: "undo" },
    });
    keymap.register("test", {
      id: "text.undo",
      shortcuts: ["mod+z"],
      target: { type: "command", id: "text.undo" },
      priority: 10,
      when: ({ editing }) => editing,
    });

    expect(keymap.resolve("mod+z", { editing: true }).map((entry) => entry.id)).toEqual([
      "text.undo",
      "global.undo",
    ]);
    expect(keymap.getConflicts({ editing: true })).toEqual([
      { shortcut: "mod+z", entryIds: ["global.undo", "text.undo"] },
    ]);
    expect(keymap.resolveBest("mod+z", { editing: true })).toMatchObject({
      type: "match",
      entry: { id: "text.undo", owner: "test" },
    });

    keymap.setUserBindings("global.undo", ["mod+u"]);
    expect(keymap.resolve("mod+z", { editing: false })).toEqual([]);
    expect(keymap.resolve("mod+u", { editing: false })[0]?.target).toEqual({
      type: "command",
      id: "undo",
    });
  });

  it("does not choose between equal-priority bindings", () => {
    const keymap = new EditorKeymap();
    keymap.register("one", {
      id: "one",
      shortcuts: ["mod+k"],
      target: { type: "command", id: "one" },
    });
    keymap.register("two", {
      id: "two",
      shortcuts: ["mod+k"],
      target: { type: "command", id: "two" },
    });
    expect(keymap.resolveBest("mod+k", undefined)).toMatchObject({
      type: "conflict",
      shortcut: "mod+k",
    });
  });
});
