import { describe, expect, it } from 'vitest';
import {
  matchesShortcutEvent,
  normalizeShortcut,
  shortcutFromKeyboardEvent,
} from './shortcut';

describe('editor shortcut adapter', () => {
  it('normalizes strokes and explicit two-stroke sequences', () => {
    expect(normalizeShortcut('Shift+MOD+Z')).toEqual(['Mod+Shift+Z']);
    expect(normalizeShortcut('Backspace')).toEqual(['Backspace']);
    expect(normalizeShortcut('MOD+K mod+C')).toEqual(['Mod+K', 'Mod+C']);
    expect(normalizeShortcut(['MOD+K', 'mod+C'])).toEqual(['Mod+K', 'Mod+C']);
  });

  it('rejects modifier-only, malformed, and overlong shortcuts', () => {
    expect(normalizeShortcut('mod')).toBeNull();
    expect(normalizeShortcut('mod+a+b')).toBeNull();
    expect(normalizeShortcut('mod+k mod+c mod+x')).toBeNull();
  });

  it('never records left or right modifier keys as strokes', () => {
    expect(shortcutFromKeyboardEvent(new KeyboardEvent('keydown', {
      key: 'Meta', code: 'MetaLeft', metaKey: true,
    }))).toBeNull();
    expect(shortcutFromKeyboardEvent(new KeyboardEvent('keydown', {
      key: 'Control', code: 'ControlRight', ctrlKey: true,
    }))).toBeNull();
  });

  it('records portable Mod and matches physical fallbacks for layouts and dead keys', () => {
    const commandR = new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', metaKey: true });
    expect(shortcutFromKeyboardEvent(commandR, 'mac')).toBe('Mod+R');
    expect(matchesShortcutEvent(
      new KeyboardEvent('keydown', { key: 'Dead', code: 'KeyE', altKey: true }),
      'Alt+E',
      'mac'
    )).toBe(true);
    expect(matchesShortcutEvent(
      new KeyboardEvent('keydown', { key: '¡', code: 'Digit1', altKey: true }),
      'Alt+1',
      'mac'
    )).toBe(true);
    expect(matchesShortcutEvent(commandR, 'Mod+R', 'linux')).toBe(true);
    expect(matchesShortcutEvent(
      new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', ctrlKey: true }),
      'Mod+R',
      'mac'
    )).toBe(true);
  });

  it('migrates supported physical letter and digit codes', () => {
    expect(normalizeShortcut('Alt+code:Digit1')).toEqual(['Alt+1']);
    expect(normalizeShortcut('Mod+code:KeyR')).toEqual(['Mod+R']);
  });
});
