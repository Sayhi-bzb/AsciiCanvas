import { APP_ACTION_META, EDITOR_COMMAND_META } from './catalog';
import type { CanvasEditorRuntime } from '@/domains/editor/public';
import type { EditorActionId, ShortcutToken, SidebarActionId } from './types';

type CanvasEditorKeymap = CanvasEditorRuntime['keymap'];

const getEditorCommandShortcuts = (keymap: CanvasEditorKeymap, commandId: EditorActionId) => {
  const configured = keymap.getBindings(`command:${commandId}`);
  if (configured) {
    return configured.map((shortcut) => shortcut.split('+') as ShortcutToken[]);
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
    shortcuts?.map((shortcut) => shortcut.join('+')) ?? null
  );

export type ShortcutPlatform = 'mac' | 'other';

export type ShortcutDisplayStroke = {
  label: string;
  accessibleLabel: string;
};

const getShortcutPlatform = (): ShortcutPlatform => {
  if (typeof navigator === 'undefined') return 'other';
  const platform = navigator.platform || navigator.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform) ? 'mac' : 'other';
};

type ShortcutKeyLabel = ShortcutDisplayStroke;

const PHYSICAL_CODE_LABELS: Record<string, string> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num ×',
  NumpadDivide: 'Num ÷',
  NumpadDecimal: 'Num .',
  NumpadEnter: 'Num Enter',
};

const NAMED_KEY_LABELS: Record<string, ShortcutKeyLabel> = {
  arrowup: { label: '↑', accessibleLabel: 'Up Arrow' },
  arrowdown: { label: '↓', accessibleLabel: 'Down Arrow' },
  arrowleft: { label: '←', accessibleLabel: 'Left Arrow' },
  arrowright: { label: '→', accessibleLabel: 'Right Arrow' },
  escape: { label: 'Esc', accessibleLabel: 'Escape' },
  enter: { label: 'Enter', accessibleLabel: 'Enter' },
  space: { label: 'Space', accessibleLabel: 'Space' },
  tab: { label: 'Tab', accessibleLabel: 'Tab' },
  home: { label: 'Home', accessibleLabel: 'Home' },
  end: { label: 'End', accessibleLabel: 'End' },
  pageup: { label: 'PgUp', accessibleLabel: 'Page Up' },
  pagedown: { label: 'PgDn', accessibleLabel: 'Page Down' },
};

const MAC_MODIFIER_LABELS: Record<string, ShortcutKeyLabel> = {
  mod: { label: '⌘', accessibleLabel: 'Command' },
  meta: { label: '⌘', accessibleLabel: 'Command' },
  ctrl: { label: '⌃', accessibleLabel: 'Control' },
  shift: { label: '⇧', accessibleLabel: 'Shift' },
  alt: { label: '⌥', accessibleLabel: 'Option' },
};

const OTHER_MODIFIER_LABELS: Record<string, ShortcutKeyLabel> = {
  mod: { label: 'Ctrl', accessibleLabel: 'Control' },
  ctrl: { label: 'Ctrl', accessibleLabel: 'Control' },
  meta: { label: 'Meta', accessibleLabel: 'Meta' },
  shift: { label: 'Shift', accessibleLabel: 'Shift' },
  alt: { label: 'Alt', accessibleLabel: 'Alt' },
};

const formatPhysicalCode = (code: string) => {
  const directLabel = PHYSICAL_CODE_LABELS[code];
  if (directLabel) return directLabel;
  const printableMatch = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code);
  if (printableMatch) return printableMatch[1] ?? printableMatch[2];
  const numpadMatch = /^Numpad([0-9])$/.exec(code);
  if (numpadMatch) return `Num ${numpadMatch[1]}`;
  return code.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
};

const formatToken = (token: ShortcutToken, platform: ShortcutPlatform): ShortcutKeyLabel => {
  const physicalCode = token.startsWith('code:') ? token.slice(5) : null;
  if (physicalCode) {
    const label = formatPhysicalCode(physicalCode);
    return { label, accessibleLabel: label };
  }

  if (token === 'delete') {
    return { label: platform === 'mac' ? '⌦' : 'Delete', accessibleLabel: 'Delete' };
  }
  if (token === 'backspace') {
    return { label: platform === 'mac' ? '⌫' : 'Backspace', accessibleLabel: 'Backspace' };
  }
  const namedKey = NAMED_KEY_LABELS[token];
  if (namedKey) return namedKey;

  const modifierLabels = platform === 'mac' ? MAC_MODIFIER_LABELS : OTHER_MODIFIER_LABELS;
  return (
    modifierLabels[token] ?? {
      label: token.toUpperCase(),
      accessibleLabel: token.toUpperCase(),
    }
  );
};

export const getShortcutDisplayStrokes = (
  shortcut: string,
  platform = getShortcutPlatform()
): ShortcutDisplayStroke[] => {
  const normalizedShortcut = shortcut.trim();
  if (!normalizedShortcut) return [];
  return normalizedShortcut.split(/\s+/).map((stroke) => {
    const keys = stroke.split('+').map((token) => formatToken(token, platform));
    return {
      label: keys.map((key) => key.label).join(' '),
      accessibleLabel: keys.map((key) => key.accessibleLabel).join('+'),
    };
  });
};

const formatChord = (chord: readonly ShortcutToken[], platform: ShortcutPlatform) => {
  const tokens = chord.map((token) => formatToken(token, platform).label);
  return platform === 'mac' ? tokens.join('') : tokens.join('+');
};

export const formatShortcutLabel = (shortcut: string, platform = getShortcutPlatform()) => {
  return getShortcutDisplayStrokes(shortcut, platform)
    .map((stroke) => stroke.accessibleLabel)
    .join(', then ');
};

export const getEditorCommandShortcutLabel = (
  keymap: CanvasEditorKeymap,
  commandId: EditorActionId,
  platform = getShortcutPlatform()
) => {
  const chords = getEditorCommandShortcuts(keymap, commandId);
  if (!chords || chords.length === 0) return undefined;
  return chords.map((chord) => formatChord(chord, platform)).join(' / ');
};

export const getAppActionShortcutLabel = (
  actionId: SidebarActionId,
  platform = getShortcutPlatform()
) => {
  const chords = APP_ACTION_META[actionId].shortcuts;
  if (!chords?.length) return undefined;
  return chords.map((chord) => formatChord(chord, platform)).join(' / ');
};
