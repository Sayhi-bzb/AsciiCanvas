import type { ActionId } from "./types";

type ShortcutToken =
  | "mod"
  | "shift"
  | "alt"
  | "delete"
  | "backspace"
  | "z"
  | "y"
  | "c"
  | "x"
  | "v";

export type ActionShortcutEvent = Pick<KeyboardEvent, "key"> &
  Partial<
    Pick<
      KeyboardEvent,
      | "altKey"
      | "ctrlKey"
      | "defaultPrevented"
      | "isComposing"
      | "metaKey"
      | "repeat"
      | "shiftKey"
    >
  >;

const ACTION_SHORTCUTS: Partial<
  Record<ActionId, readonly (readonly ShortcutToken[])[]>
> = {
  undo: [["mod", "z"]],
  redo: [
    ["mod", "shift", "z"],
    ["mod", "y"],
  ],
  copy: [["mod", "c"]],
  cut: [["mod", "x"]],
  paste: [["mod", "v"]],
  "delete-selection": [["backspace"], ["delete"]],
};

export type ShortcutPlatform = "mac" | "other";

const getShortcutPlatform = (): ShortcutPlatform => {
  if (typeof navigator === "undefined") return "other";
  const platform = navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform) ? "mac" : "other";
};

const formatToken = (token: ShortcutToken, platform: ShortcutPlatform) => {
  if (platform === "mac") {
    switch (token) {
      case "mod":
        return "⌘";
      case "shift":
        return "⇧";
      case "alt":
        return "⌥";
      case "delete":
        return "⌦";
      case "backspace":
        return "⌫";
      default:
        return token.toUpperCase();
    }
  }

  switch (token) {
    case "mod":
      return "Ctrl";
    case "shift":
      return "Shift";
    case "alt":
      return "Alt";
    case "delete":
      return "Delete";
    case "backspace":
      return "Backspace";
    default:
      return token.toUpperCase();
  }
};

const formatChord = (
  chord: readonly ShortcutToken[],
  platform: ShortcutPlatform
) => {
  const tokens = chord.map((token) => formatToken(token, platform));
  return platform === "mac" ? tokens.join("") : tokens.join("+");
};

const matchesChord = (
  chord: readonly ShortcutToken[],
  event: ActionShortcutEvent
) => {
  if (event.defaultPrevented || event.isComposing || event.repeat) return false;

  const expectsMod = chord.includes("mod");
  const expectsShift = chord.includes("shift");
  const expectsAlt = chord.includes("alt");
  if (Boolean(event.ctrlKey || event.metaKey) !== expectsMod) return false;
  if (Boolean(event.shiftKey) !== expectsShift) return false;
  if (Boolean(event.altKey) !== expectsAlt) return false;

  const keyToken = chord.find(
    (token) => token !== "mod" && token !== "shift" && token !== "alt"
  );
  return !!keyToken && event.key.toLowerCase() === keyToken;
};

export const matchesActionShortcut = (
  actionId: ActionId,
  event: ActionShortcutEvent
) =>
  ACTION_SHORTCUTS[actionId]?.some((chord) => matchesChord(chord, event)) ??
  false;

export const resolveActionShortcut = <T extends ActionId>(
  event: ActionShortcutEvent,
  actionIds: readonly T[]
): T | null =>
  actionIds.find((actionId) => matchesActionShortcut(actionId, event)) ?? null;

export const getActionShortcutLabel = (
  actionId: ActionId,
  platform = getShortcutPlatform()
) => {
  const chords = ACTION_SHORTCUTS[actionId];
  if (!chords || chords.length === 0) return undefined;
  return chords.map((chord) => formatChord(chord, platform)).join(" / ");
};
