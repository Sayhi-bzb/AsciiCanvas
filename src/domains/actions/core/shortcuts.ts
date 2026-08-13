import { APP_ACTION_META, EDITOR_COMMAND_META } from "./catalog";
import type { CanvasEditorRuntime } from "@/domains/editor/public";
import type { EditorActionId, ShortcutToken, SidebarActionId } from "./types";

type CanvasEditorKeymap = CanvasEditorRuntime["keymap"];

const getEditorCommandShortcuts = (
  keymap: CanvasEditorKeymap,
  commandId: EditorActionId
) => {
  const configured = keymap.getBindings(`command:${commandId}`);
  if (configured) {
    return configured.map((shortcut) => shortcut.split("+") as ShortcutToken[]);
  }
  return EDITOR_COMMAND_META[commandId]?.shortcuts;
};

export const setEditorCommandShortcutOverride = (
  keymap: CanvasEditorKeymap,
  commandId: EditorActionId,
  shortcuts: readonly (readonly ShortcutToken[])[] | null
) =>
  keymap.setUserBindings(
    `command:${commandId}`,
    shortcuts?.map((shortcut) => shortcut.join("+")) ?? null
  );

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

export const getShortcutDisplayTokens = (
  shortcut: string,
  platform = getShortcutPlatform()
) => shortcut
  .split("+")
  .map((token) => formatToken(token, platform));

const formatChord = (
  chord: readonly ShortcutToken[],
  platform: ShortcutPlatform
) => {
  const tokens = chord.map((token) => formatToken(token, platform));
  return platform === "mac" ? tokens.join("") : tokens.join("+");
};

export const formatShortcutLabel = (
  shortcut: string,
  platform = getShortcutPlatform()
) => getShortcutDisplayTokens(shortcut, platform).join(
  platform === "mac" ? "" : "+"
);

export const getEditorCommandShortcutLabel = (
  keymap: CanvasEditorKeymap,
  commandId: EditorActionId,
  platform = getShortcutPlatform()
) => {
  const chords = getEditorCommandShortcuts(keymap, commandId);
  if (!chords || chords.length === 0) return undefined;
  return chords.map((chord) => formatChord(chord, platform)).join(" / ");
};

export const getAppActionShortcutLabel = (
  actionId: SidebarActionId,
  platform = getShortcutPlatform()
) => {
  const chords = APP_ACTION_META[actionId].shortcuts;
  if (!chords?.length) return undefined;
  return chords.map((chord) => formatChord(chord, platform)).join(" / ");
};
