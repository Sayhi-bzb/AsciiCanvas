import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEditorCommandsExtension } from '@/domains/actions/public';
import { getCanvasState, testingCanvasRuntime } from '@/domains/canvas/testing';
import {
  createCanvasEditorRuntime,
  EditorProvider,
  type CanvasEditorRuntime,
} from '@/domains/editor/public';
import { setUiLanguage } from '@/shared/i18n';
import { SettingsDialog } from './settings-dialog';

const createEditor = () => {
  const editor = createCanvasEditorRuntime({
    state: { get: getCanvasState, subscribe: () => () => undefined },
    history: testingCanvasRuntime.commands.history,
    transactions: { run: (operation) => operation() },
  });
  editor.registerExtension(createEditorCommandsExtension(testingCanvasRuntime));
  return editor;
};

const renderDialog = (editor: CanvasEditorRuntime) => {
  const view = render(
    <EditorProvider editor={editor}>
      <SettingsDialog open onOpenChange={() => undefined} />
    </EditorProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Shortcuts' }));
  return view;
};

describe('KeyboardShortcutsPanel', () => {
  let editor: CanvasEditorRuntime;

  beforeEach(() => {
    setUiLanguage('en');
    editor = createEditor();
  });

  afterEach(() => {
    editor.dispose();
    setUiLanguage('en');
  });

  it('records, removes, and restores command shortcuts reactively', () => {
    renderDialog(editor);

    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(screen.getAllByRole('heading')).toHaveLength(2);
    expect(dialog).toHaveClass('sm:max-w-[720px]');
    expect(dialog.querySelector('[class*="bg-accent/"]')).not.toBeInTheDocument();
    expect(dialog.querySelector('.border-accent')).not.toBeInTheDocument();
    const shortcutList = dialog.querySelector('[data-slot="shortcut-list"]');
    expect(shortcutList?.querySelectorAll('[data-slot="shortcut-row"]')).toHaveLength(6);
    expect(shortcutList?.querySelectorAll('[data-slot="separator"]')).toHaveLength(0);
    expect(shortcutList?.querySelector('[data-slot="shortcut-row"]')).toHaveClass('min-w-max');
    expect(screen.queryByRole('button', { name: 'Reset all' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit .* for Undo/ })).toHaveAttribute(
      'data-tone',
      'subtle'
    );
    expect(screen.getByRole('button', { name: /Remove .* from Undo/ })).toHaveClass(
      'opacity-0',
      'group-focus-within/binding:opacity-100'
    );

    const editUndo = screen.getByRole('button', {
      name: /Edit .* for Undo/,
    });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'u', ctrlKey: true });

    expect(editor.keymap.getBindings('command:undo')).toEqual(['mod+u']);
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit .*U for Undo/ })).toBeInTheDocument();
    const undoKbdGroup = screen
      .getAllByLabelText(/Ctrl\+U|⌘U/)
      .find((element) => element.getAttribute('data-slot') === 'kbd-group');
    expect(undoKbdGroup).toBeDefined();
    expect(undoKbdGroup).toHaveAttribute('data-slot', 'kbd-group');
    expect(undoKbdGroup?.querySelectorAll('[data-slot="kbd"]')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Remove .*U from Undo/ }));
    expect(editor.keymap.getBindings('command:undo')).toEqual([]);
    expect(screen.getByText('None')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults for Undo' }));
    expect(editor.keymap.getBindings('command:undo')).toEqual(['mod+z']);
  });

  it('adds a shortcut from the row action', () => {
    renderDialog(editor);

    const addUndo = screen.getByRole('button', {
      name: 'Add shortcut for Undo',
    });
    fireEvent.click(addUndo);
    fireEvent.keyDown(addUndo, { key: 'u', altKey: true });

    expect(editor.keymap.getBindings('command:undo')).toEqual(['mod+z', 'alt+u']);
  });

  it('cancels recording with Escape', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });

    fireEvent.click(editUndo);
    expect(editUndo).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(editUndo, { key: 'Escape' });

    expect(editor.keymap.getBindings('command:undo')).toEqual(['mod+z']);
    expect(editUndo).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('cancels or atomically confirms a conflicting replacement', () => {
    let notifications = 0;
    editor.keymap.subscribe(() => notifications++);
    renderDialog(editor);

    const recordCopyAsUndo = () => {
      const editCopy = screen.getByRole('button', { name: /Edit .* for Copy/ });
      fireEvent.click(editCopy);
      fireEvent.keyDown(editCopy, { key: 'z', ctrlKey: true });
    };

    recordCopyAsUndo();
    expect(screen.getByRole('heading', { name: 'Shortcut in use' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(editor.keymap.getBindings('command:undo')).toEqual(['mod+z']);
    expect(editor.keymap.getBindings('command:copy')).toEqual(['mod+c']);
    expect(notifications).toBe(0);

    recordCopyAsUndo();
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(editor.keymap.getBindings('command:undo')).toEqual([]);
    expect(editor.keymap.getBindings('command:copy')).toEqual(['mod+z']);
    expect(notifications).toBe(1);
  });

  it('restores all user bindings', () => {
    editor.keymap.updateUserBindings({
      'command:undo': ['mod+u'],
      'command:copy': [],
    });
    renderDialog(editor);
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));

    expect(editor.keymap.getUserBindings()).toEqual({});
    expect(editor.keymap.getBindings('command:undo')).toEqual(['mod+z']);
    expect(editor.keymap.getBindings('command:copy')).toEqual(['mod+c']);
  });
});
