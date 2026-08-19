import { describe, expect, it } from "vitest";
import {
  normalizeShortcut,
  shortcutFromKeyboardEvent,
  shortcutsFromKeyboardEvent,
} from "./shortcut";

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

  it("normalizes two-stroke chords and exposes logical and physical candidates", () => {
    expect(normalizeShortcut("MOD+K mod+C")).toBe("mod+k mod+c");
    expect(normalizeShortcut("mod+k mod+c mod+x")).toBeNull();
    expect(normalizeShortcut("Alt+code:Digit1")).toBe("alt+code:Digit1");
    expect(shortcutsFromKeyboardEvent({
      key: "¡",
      code: "Digit1",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: true,
    })).toContain("alt+code:Digit1");
    expect(shortcutsFromKeyboardEvent({
      key: "k",
      code: "KeyK",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    })).toEqual(expect.arrayContaining(["mod+k", "ctrl+k"]));
  });
});
