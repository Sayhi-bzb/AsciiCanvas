import { describe, expect, it, vi } from "vitest";
import { getCanvasState } from "@/domains/canvas/testing";
import { createCanvasEditorRuntime } from "./runtime";
import { executeEditorKeymapEvent } from "./keyboard";

describe("editor keymap execution", () => {
  it("stops executing the old binding and executes the reassigned binding", () => {
    const execute = vi.fn(() => ({
      handled: true as const,
      status: "succeeded" as const,
    }));
    const editor = createCanvasEditorRuntime({
      state: { get: getCanvasState, subscribe: () => () => undefined },
      history: {
        undo: () => false,
        redo: () => false,
        beginCheckpoint: () => ({ commit: vi.fn(), cancel: vi.fn() }),
        finishCapture: vi.fn(),
      },
      transactions: { run: (operation) => operation() },
    });
    editor.registerExtension({
      id: "test.shortcuts",
      commands: [{ id: "test-command", execute }],
      keybindings: [
        {
          id: "command:test-command",
          shortcuts: ["mod+z"],
          target: { type: "command", id: "test-command" },
        },
      ],
    });
    editor.keymap.setUserBindings("command:test-command", ["mod+u"]);

    const oldBinding = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
    });
    const newBinding = new KeyboardEvent("keydown", {
      key: "u",
      ctrlKey: true,
    });

    expect(
      executeEditorKeymapEvent(editor, oldBinding, "canvas-surface")
    ).toEqual({ type: "none" });
    expect(
      executeEditorKeymapEvent(editor, newBinding, "canvas-surface")
    ).toMatchObject({ type: "executed" });
    expect(execute).toHaveBeenCalledOnce();
  });
});
