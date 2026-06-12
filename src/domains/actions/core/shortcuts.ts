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

const ACTION_SHORTCUTS: Partial<Record<ActionId, ShortcutToken[][]>> = {
  undo: [["mod", "z"]],
  redo: [
    ["mod", "shift", "z"],
    ["mod", "y"],
  ],
  copy: [["mod", "c"]],
  cut: [["mod", "x"]],
  paste: [["mod", "v"]],
  "delete-selection": [["backspace"]],
};

const isMacLikePlatform = () => {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
};

const formatToken = (token: ShortcutToken, isMacLike: boolean) => {
  if (isMacLike) {
    switch (token) {
      case "mod":
        return "⌘";
      case "shift":
        return "⇧";
      case "alt":
        return "⌥";
      case "delete":
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

const formatChord = (chord: ShortcutToken[], isMacLike: boolean) => {
  const tokens = chord.map((token) => formatToken(token, isMacLike));
  return isMacLike ? tokens.join("") : tokens.join("+");
};

export const getActionShortcutLabel = (actionId: ActionId) => {
  const chords = ACTION_SHORTCUTS[actionId];
  if (!chords || chords.length === 0) return undefined;
  const isMacLike = isMacLikePlatform();
  return chords.map((chord) => formatChord(chord, isMacLike)).join(" / ");
};
