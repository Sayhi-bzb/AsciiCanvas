import { describe, expect, it } from "vitest";
import { EditorKeymap } from "./keymap";

describe("EditorKeymap", () => {
  it("applies overrides and orders contextual matches by priority", () => {
    const keymap = new EditorKeymap<{ editing: boolean }>();
    keymap.register({
      id: "global.undo",
      shortcuts: ["mod+z"],
      target: { type: "command", id: "undo" },
    });
    keymap.register({
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

    keymap.setUserBindings("global.undo", ["mod+u"]);
    expect(keymap.resolve("mod+z", { editing: false })).toEqual([]);
    expect(keymap.resolve("mod+u", { editing: false })[0]?.target).toEqual({
      type: "command",
      id: "undo",
    });
  });
});
