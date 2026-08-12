import { describe, expect, it } from "vitest";
import { normalizeShortcut, shortcutFromKeyboardEvent } from "./shortcut";

describe("editor shortcut normalization", () => {
  it("normalizes modifier order, named keys, and platform mod keys", () => {
    expect(normalizeShortcut("Shift+MOD+Z")).toBe("mod+shift+z");
    expect(normalizeShortcut("Backspace")).toBe("backspace");
    expect(shortcutFromKeyboardEvent({
      key: "Z",
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
      altKey: false,
    })).toBe("mod+shift+z");
  });

  it("rejects incomplete and multi-key chords", () => {
    expect(normalizeShortcut("mod")).toBeNull();
    expect(normalizeShortcut("mod+a+b")).toBeNull();
    expect(shortcutFromKeyboardEvent({
      key: "Control",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    })).toBeNull();
  });
});
