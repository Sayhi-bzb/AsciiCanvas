import { describe, expect, it } from "vitest";
import {
  getDockShortcutAriaLabel,
  getDockShortcutLabel,
  resolveDockShortcutIndex,
  type DockShortcutEvent,
} from "./shortcuts";

const shortcutEvent = (
  code: string,
  overrides: Partial<DockShortcutEvent> = {}
): DockShortcutEvent => ({
  code,
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

const macShortcutEvent = (
  code: string,
  overrides: Partial<DockShortcutEvent> = {}
): DockShortcutEvent =>
  shortcutEvent(code, { altKey: false, ctrlKey: true, ...overrides });

describe("dock shortcuts", () => {
  it("resolves physical Alt+digit positions within the visible item count", () => {
    expect(resolveDockShortcutIndex(shortcutEvent("Digit1"), 6, "other")).toBe(0);
    expect(resolveDockShortcutIndex(shortcutEvent("Digit6"), 6, "other")).toBe(5);
    expect(resolveDockShortcutIndex(shortcutEvent("Digit6"), 5, "other")).toBeNull();
  });

  it("uses Control+digits on macOS without accepting Option characters", () => {
    expect(resolveDockShortcutIndex(macShortcutEvent("Digit1"), 6, "mac")).toBe(0);
    expect(resolveDockShortcutIndex(shortcutEvent("Digit1"), 6, "mac")).toBeNull();
  });

  it("uses event.code independently of the input method key value", () => {
    expect(
      resolveDockShortcutIndex(
        { ...shortcutEvent("Digit2"), key: "™" } as DockShortcutEvent,
        6,
        "other"
      )
    ).toBe(1);
  });

  it("rejects unsafe keyboard states and extra modifiers", () => {
    expect(
      resolveDockShortcutIndex(
        shortcutEvent("Digit1", { isComposing: true }),
        6,
        "other"
      )
    ).toBeNull();
    expect(
      resolveDockShortcutIndex(shortcutEvent("Digit1", { repeat: true }), 6, "other")
    ).toBeNull();
    expect(
      resolveDockShortcutIndex(shortcutEvent("Digit1", { ctrlKey: true }), 6, "other")
    ).toBeNull();
    expect(
      resolveDockShortcutIndex(shortcutEvent("Digit1", { shiftKey: true }), 6, "other")
    ).toBeNull();
    expect(
      resolveDockShortcutIndex(shortcutEvent("Digit1", { altKey: false }), 6, "other")
    ).toBeNull();
  });

  it("formats visible and accessible labels", () => {
    expect(getDockShortcutLabel(0, "mac")).toBe("⌃1");
    expect(getDockShortcutLabel(5, "other")).toBe("Alt+6");
    expect(getDockShortcutAriaLabel(2, "mac")).toBe("Control+3");
    expect(getDockShortcutAriaLabel(2, "other")).toBe("Alt+3");
  });
});
