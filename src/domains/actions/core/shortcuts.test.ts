import { describe, expect, it } from "vitest";
import {
  getActionShortcutLabel,
  matchesActionShortcut,
  resolveActionShortcut,
  type ActionShortcutEvent,
} from "./shortcuts";

const shortcutEvent = (
  key: string,
  overrides: Partial<ActionShortcutEvent> = {}
): ActionShortcutEvent => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

describe("action shortcuts", () => {
  it("matches Ctrl and Meta through the same mod token", () => {
    expect(
      matchesActionShortcut("cut", shortcutEvent("x", { ctrlKey: true }))
    ).toBe(true);
    expect(
      matchesActionShortcut("cut", shortcutEvent("X", { metaKey: true }))
    ).toBe(true);
  });

  it("matches exact modifiers and rejects unsafe keyboard states", () => {
    expect(
      matchesActionShortcut(
        "undo",
        shortcutEvent("z", { ctrlKey: true, shiftKey: true })
      )
    ).toBe(false);
    expect(
      matchesActionShortcut(
        "redo",
        shortcutEvent("z", { metaKey: true, shiftKey: true })
      )
    ).toBe(true);
    expect(
      matchesActionShortcut(
        "copy",
        shortcutEvent("c", { metaKey: true, altKey: true })
      )
    ).toBe(false);
    expect(
      matchesActionShortcut(
        "copy",
        shortcutEvent("c", { metaKey: true, isComposing: true })
      )
    ).toBe(false);
    expect(
      matchesActionShortcut(
        "copy",
        shortcutEvent("c", { metaKey: true, repeat: true })
      )
    ).toBe(false);
  });

  it("resolves history actions and both deletion keys", () => {
    expect(
      resolveActionShortcut(
        shortcutEvent("y", { ctrlKey: true }),
        ["undo", "redo"] as const
      )
    ).toBe("redo");
    expect(
      matchesActionShortcut("delete-selection", shortcutEvent("Backspace"))
    ).toBe(true);
    expect(
      matchesActionShortcut("delete-selection", shortcutEvent("Delete"))
    ).toBe(true);
  });

  it("formats labels from the same binding source", () => {
    expect(getActionShortcutLabel("redo", "mac")).toBe("⌘⇧Z / ⌘Y");
    expect(getActionShortcutLabel("redo", "other")).toBe(
      "Ctrl+Shift+Z / Ctrl+Y"
    );
    expect(getActionShortcutLabel("delete-selection", "mac")).toBe("⌫ / ⌦");
    expect(getActionShortcutLabel("delete-selection", "other")).toBe(
      "Backspace / Delete"
    );
  });
});
