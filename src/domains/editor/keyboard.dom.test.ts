import { describe, expect, it, vi } from "vitest";
import { getCanvasState } from "@/domains/canvas/testing";
import { createCanvasEditorRuntime } from "./runtime";
import { EditorShortcutEngine, executeEditorKeymapEvent } from "./keyboard";

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
    editor.keymap.setUserBindings("command:test-command", [["mod+u"]]);

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

  it("executes a chord and reprocesses a mismatched second stroke", () => {
    const chord = vi.fn(() => ({ handled: true as const, status: "succeeded" as const }));
    const root = vi.fn(() => ({ handled: true as const, status: "succeeded" as const }));
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
      id: "test.chords",
      commands: [
        { id: "chord", execute: chord },
        { id: "root", execute: root },
      ],
      keybindings: [
        { id: "chord", shortcuts: ["mod+k mod+c"], target: { type: "command", id: "chord" } },
        { id: "root", shortcuts: ["mod+x"], target: { type: "command", id: "root" } },
      ],
    });
    const engine = new EditorShortcutEngine(editor);

    expect(engine.handleKeyDown(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }), "canvas-surface"))
      .toEqual({ type: "pending" });
    expect(engine.handleKeyDown(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }), "canvas-surface"))
      .toMatchObject({ type: "executed" });
    expect(chord).toHaveBeenCalledOnce();

    engine.handleKeyDown(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }), "canvas-surface");
    expect(engine.handleKeyDown(new KeyboardEvent("keydown", { key: "x", ctrlKey: true }), "canvas-surface"))
      .toMatchObject({ type: "executed" });
    expect(root).toHaveBeenCalledOnce();
    engine.dispose();
  });
});
