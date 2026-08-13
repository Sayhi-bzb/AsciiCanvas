import { describe, expect, it, vi } from "vitest";
import {
  getEditorCommandShortcutLabel,
  getShortcutDisplayTokens,
} from "./shortcuts";
import { createEditorCommandsExtension } from "./runtime";
import { getCanvasState, testingCanvasRuntime } from "@/domains/canvas/testing";
import { createCanvasEditorRuntime } from "@/domains/editor/public";

describe("editor command shortcut labels", () => {
  it("provides platform display tokens for native Kbd composition", () => {
    expect(getShortcutDisplayTokens("mod+shift+z", "mac")).toEqual([
      "⌘",
      "⇧",
      "Z",
    ]);
    expect(getShortcutDisplayTokens("mod+shift+z", "other")).toEqual([
      "Ctrl",
      "Shift",
      "Z",
    ]);
  });

  it("formats labels from the registered keymap", () => {
    const editor = createCanvasEditorRuntime({
      state: { get: getCanvasState, subscribe: () => () => undefined },
      history: {
        undo: () => false,
        redo: () => false,
        beginCheckpoint: () => ({ commit: vi.fn(), cancel: vi.fn() }),
        finishCapture: vi.fn(),
      },
      transactions: { run: (fn) => fn() },
    });
    editor.registerExtension(createEditorCommandsExtension(testingCanvasRuntime as never));

    expect(getEditorCommandShortcutLabel(editor.keymap, "undo", "mac")).toBe("⌘Z");
    expect(getEditorCommandShortcutLabel(editor.keymap, "undo", "other")).toBe("Ctrl+Z");
    expect(getEditorCommandShortcutLabel(editor.keymap, "redo", "mac")).toBe("⌘⇧Z / ⌘Y");
    expect(getEditorCommandShortcutLabel(
      editor.keymap,
      "delete-selection",
      "other"
    )).toBe(
      "Backspace / Delete"
    );
  });
});
