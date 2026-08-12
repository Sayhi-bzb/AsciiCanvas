const MODIFIERS = new Set(["mod", "shift", "alt"]);
const NAMED_KEYS = new Set([
  "backspace",
  "delete",
  "enter",
  "escape",
  "space",
  "tab",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "home",
  "end",
  "pageup",
  "pagedown",
]);

const normalizeKey = (key: string) => {
  const normalized = key === " " ? "space" : key.toLowerCase();
  if (normalized.length === 1 || NAMED_KEYS.has(normalized) || /^f\d{1,2}$/.test(normalized)) {
    return normalized;
  }
  return null;
};

export const normalizeShortcut = (shortcut: string): string | null => {
  const tokens = shortcut.toLowerCase().split("+").filter(Boolean);
  const keyTokens = tokens.filter((token) => !MODIFIERS.has(token));
  if (keyTokens.length !== 1) return null;
  const key = normalizeKey(keyTokens[0]);
  if (!key) return null;
  const modifiers = ["mod", "shift", "alt"].filter((token) => tokens.includes(token));
  return [...modifiers, key].join("+");
};

export const shortcutFromKeyboardEvent = (
  event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">
) => {
  const key = normalizeKey(event.key);
  if (!key || MODIFIERS.has(key)) return null;
  return [
    event.ctrlKey || event.metaKey ? "mod" : null,
    event.shiftKey ? "shift" : null,
    event.altKey ? "alt" : null,
    key,
  ]
    .filter((token): token is string => token !== null)
    .join("+");
};
