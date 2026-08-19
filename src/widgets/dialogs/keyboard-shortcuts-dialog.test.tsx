import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditorCommandsExtension } from '@/domains/actions/public';
import { getCanvasState, testingCanvasRuntime } from '@/domains/canvas/testing';
import {
  createCanvasEditorRuntime,
  EditorProvider,
  type CanvasEditorRuntime,
} from '@/domains/editor/public';
import { setUiLanguage } from '@/shared/i18n';
import { ShortcutProvider } from '@/shared/shortcuts/dispatcher';
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

const renderDialog = (editor: CanvasEditorRuntime, onOpenChange = () => undefined) => {
  const view = render(
    <ShortcutProvider>
      <EditorProvider editor={editor}>
        <SettingsDialog open onOpenChange={onOpenChange} />
      </EditorProvider>
    </ShortcutProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: /Shortcuts|快捷键/ }));
  return view;
};

describe('KeyboardShortcutsPanel', () => {
  let editor: CanvasEditorRuntime;

  beforeEach(() => {
    setUiLanguage('en');
    editor = createEditor();
  });

  afterEach(() => {
    vi.useRealTimers();
    editor.dispose();
    setUiLanguage('en');
  });

  it('renders a dense grouped table with direct Kbd editing targets', () => {
    renderDialog(editor);

    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveClass('sm:max-w-[840px]');
    expect(screen.getByRole('columnheader', { name: 'Command' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Scope' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Shortcut' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toHaveTextContent('Actions');
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    const shortcutList = dialog.querySelector('[data-slot="shortcut-list"]');
    expect(shortcutList?.querySelectorAll('[data-slot="shortcut-row"]')).toHaveLength(
      editor.keymap.getSnapshot().entries.filter((entry) => entry.configurable).length
    );
    const shortcutGrid = dialog.querySelector('[data-slot="shortcut-grid"]');
    expect(shortcutGrid?.querySelector('[data-slot="table-container"]')).toHaveClass(
      'overflow-x-auto'
    );
    const shortcutTable = shortcutGrid?.querySelector('table');
    expect(shortcutTable).toHaveAttribute('data-density', 'compact');
    expect(shortcutTable).toHaveAttribute('data-row-hover', 'none');
    expect(shortcutTable).toHaveClass('min-w-[560px]', 'table-fixed', 'text-xs', 'leading-4');
    expect(shortcutTable).not.toHaveClass('text-sm');
    expect(shortcutGrid?.querySelector('[data-slot="table-head"]')).toHaveClass('h-8');
    expect(shortcutGrid?.querySelector('[data-slot="table-cell"]')).toHaveClass('h-8');
    expect(screen.queryByRole('button', { name: 'Reset all' })).not.toBeInTheDocument();
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search settings' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Search shortcuts' })).not.toBeInTheDocument();
    const addShortcutButtons = screen.getAllByRole('button', { name: /Set shortcut for/ });
    expect(addShortcutButtons.length).toBeGreaterThan(0);
    expect(addShortcutButtons.every((button) => button.classList.contains('ml-auto'))).toBe(true);
    expect(addShortcutButtons.every((button) => button.classList.contains('shrink-0'))).toBe(true);
    expect(screen.queryByRole('button', { name: /Remove .* from/ })).not.toBeInTheDocument();

    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    expect(editUndo).toHaveAttribute('data-slot', 'shortcut-binding');
    expect(editUndo).toHaveClass('focus-visible:ring-inset');
    expect(editUndo.closest('tr')).toHaveTextContent('Canvas');
    const undoKbdGroup = editUndo.querySelector('[data-slot="kbd-group"]');
    expect(undoKbdGroup).toBeInTheDocument();
    expect(undoKbdGroup?.querySelectorAll('[data-slot="kbd"]')).toHaveLength(1);
    expect(undoKbdGroup?.querySelector('[data-slot="kbd"]')).toHaveTextContent(/⌘ Z|Ctrl Z/);
    expect(undoKbdGroup?.querySelector('[data-slot="kbd"]')).toHaveClass('bg-kbd-surface');
    expect(undoKbdGroup?.querySelector('[data-slot="kbd"]')).not.toHaveClass('bg-muted');
  });

  it('persists edits and resets immediately without a save footer', () => {
    renderDialog(editor);

    const editUndo = screen.getByRole('button', {
      name: /Edit .* for Undo/,
    });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'Enter' });

    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+J']]);
    expect(screen.getByRole('button', { name: /Edit .*J for Undo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeInTheDocument();
    const resetUndo = screen.getByRole('button', { name: 'Restore defaults for Undo' });
    expect(resetUndo).toHaveAttribute('data-size', 'xs');
    expect(resetUndo).toHaveClass('size-6');
    expect(resetUndo.closest('td')).toHaveClass('h-8', 'p-1');

    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults for Undo' }));
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+Z']]);
    expect(
      screen.queryByRole('button', { name: 'Restore defaults for Undo' })
    ).not.toBeInTheDocument();
  });

  it('preserves multiple bindings when one binding is edited', () => {
    renderDialog(editor);

    expect(editor.keymap.getBindings('command:redo')).toEqual([['Mod+Shift+Z'], ['Mod+Y']]);
    const redoBindings = screen.getAllByRole('button', { name: /Edit .* for Redo/ });
    expect(redoBindings).toHaveLength(2);
    expect(redoBindings[0].closest('tr')).toHaveTextContent('/');
    fireEvent.click(redoBindings[0]);
    fireEvent.keyDown(redoBindings[0], { key: 'j', ctrlKey: true });
    fireEvent.keyDown(redoBindings[0], { key: 'Enter' });

    expect(editor.keymap.getBindings('command:redo')).toEqual([['Mod+J'], ['Mod+Y']]);
    expect(screen.getAllByRole('button', { name: /Edit .* for Redo/ })).toHaveLength(2);
  });

  it('offers a compact entry point when a command has no binding', () => {
    editor.keymap.setUserBindings('command:undo', []);
    renderDialog(editor);

    const setUndo = screen.getByRole('button', { name: 'Set shortcut for Undo' });
    expect(setUndo).toHaveAttribute('data-tone', 'neutral');
    expect(setUndo).toHaveAttribute('data-size', 'xs');
    expect(setUndo).toHaveAttribute('data-shape', 'square');
    expect(setUndo).toContainElement(setUndo.querySelector('svg'));
    expect(setUndo).not.toHaveTextContent('Set shortcut');
    setUndo.focus();
    fireEvent.click(setUndo);
    expect(screen.getByRole('button', { name: 'Set shortcut for Undo' })).toBe(setUndo);
    expect(setUndo).toHaveFocus();
    expect(setUndo).toHaveAttribute('data-shape', 'auto');
    expect(setUndo).toHaveAttribute('data-pressed', 'true');
    expect(setUndo).toHaveClass('data-[pressed=true]:focus-visible:ring-0');
    expect(setUndo).toHaveTextContent('Press keys…');
    fireEvent.keyDown(setUndo, { key: 'u', altKey: true });
    fireEvent.keyDown(setUndo, { key: 'Enter' });

    expect(editor.keymap.getBindings('command:undo')).toEqual([['Alt+U']]);
    expect(screen.getByRole('button', { name: /Edit .* for Undo/ })).toHaveAttribute(
      'data-slot',
      'shortcut-binding'
    );
  });

  it('uses global search to reveal a command without filtering the shortcut page', async () => {
    renderDialog(editor);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Formatting' }));
    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'underline' } });

    const results = screen.getByRole('navigation', { name: 'Settings search results' });
    fireEvent.click(within(results).getByRole('button', { name: /Underline/ }));

    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Search settings' })).toHaveValue('');
      expect(screen.getByRole('button', { name: /Edit .* for Underline/ })).toHaveFocus();
    });
    expect(screen.getByRole('button', { name: 'Collapse Formatting' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: /Edit .* for Undo/ })).toBeInTheDocument();
  });

  it('preserves an auto-saved shortcut when search reveals another shortcut', async () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'Enter' });

    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'Underline' } });
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Settings search results' })).getByRole(
        'button',
        { name: /Underline/ }
      )
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Edit .* for Underline/ })).toHaveFocus();
    });
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit .*J for Undo/ })).toBeInTheDocument();
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+J']]);
  });

  it('reports a single-stroke shortcut that shadows existing chords', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'Enter' });

    const conflictingUndo = screen.getByRole('button', { name: /Edit .* for Undo.*Overlaps/ });
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+K']]);
    expect(conflictingUndo).toHaveAttribute('aria-invalid', 'true');
    expect(conflictingUndo.querySelector('[data-slot="kbd"]')).toHaveClass('text-destructive');
    expect(screen.queryByRole('heading', { name: 'Shortcut in use' })).not.toBeInTheDocument();
  });

  it('cancels recording with Escape', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });

    fireEvent.click(editUndo);
    expect(editUndo).toHaveAttribute('aria-pressed', 'true');
    expect(editUndo).toHaveClass('aria-pressed:focus-visible:ring-0');
    fireEvent.keyDown(editUndo, { key: 'Escape' });

    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+Z']]);
    expect(screen.getByRole('button', { name: /Edit .* for Undo/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('saves a non-empty recording when focus leaves the binding', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });

    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.blur(editUndo);

    expect(screen.getByRole('button', { name: /Edit .* for Undo/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+J']]);
  });

  it('cancels an empty recording when focus leaves the binding', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });

    fireEvent.click(editUndo);
    fireEvent.blur(editUndo);

    expect(screen.getByRole('button', { name: /Edit .* for Undo/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+Z']]);
  });

  it('saves a partial shortcut when the user clicks outside', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });

    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.pointerDown(screen.getByRole('columnheader', { name: 'Command' }));

    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+J']]);
    expect(screen.getByRole('button', { name: /Edit .*J for Undo/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('cancels recording from a global Escape without closing settings', () => {
    const onOpenChange = vi.fn();
    renderDialog(editor, onOpenChange);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });

    fireEvent.click(editUndo);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByRole('button', { name: /Edit .* for Undo/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('toggles the active binding or transfers recording to another binding', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    const editCopy = screen.getByRole('button', { name: /Edit .* for Copy/ });

    fireEvent.click(editUndo);
    fireEvent.click(editUndo);
    expect(editUndo).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(editUndo);
    fireEvent.pointerDown(editCopy);
    fireEvent.click(editCopy);
    expect(editUndo).toHaveAttribute('aria-pressed', 'false');
    expect(editCopy).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses unmodified Tab to save and leave a non-empty recording', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });

    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'Tab' });

    expect(screen.getByRole('button', { name: /Edit .*J for Undo/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+J']]);
  });

  it('cancels recording when the browser window loses focus', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });

    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.blur(window);

    expect(editUndo).toHaveAttribute('aria-pressed', 'false');
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+Z']]);
  });

  it('resets configurable bindings immediately without touching non-configurable overrides', () => {
    editor.keymap.register('test', {
      id: 'internal:test',
      label: 'Internal',
      configurable: false,
      shortcuts: ['alt+x'],
      target: { type: 'command', id: 'internal.test' },
    });
    editor.keymap.setUserBindings('internal:test', [['Alt+Y']]);
    editor.keymap.setUserBindings('command:undo', [['Mod+J']]);
    renderDialog(editor);

    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));

    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+Z']]);
    expect(editor.keymap.getBindings('internal:test')).toEqual([['Alt+Y']]);
    expect(screen.queryByText('Internal')).not.toBeInTheDocument();
  });

  it('saves duplicate bindings and marks every conflicting Kbd invalid', () => {
    let notifications = 0;
    editor.keymap.subscribe(() => notifications++);
    renderDialog(editor);

    const editCopy = screen.getByRole('button', { name: /Edit .* for Copy/ });
    fireEvent.click(editCopy);
    fireEvent.keyDown(editCopy, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(editCopy, { key: 'Enter' });

    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+Z']]);
    expect(editor.keymap.getBindings('command:copy')).toEqual([['Mod+Z']]);
    expect(notifications).toBe(1);
    const undoConflict = screen.getByRole('button', { name: /for Undo.*assigned to Copy/ });
    const copyConflict = screen.getByRole('button', { name: /for Copy.*assigned to Undo/ });
    expect(undoConflict).toHaveAttribute('aria-invalid', 'true');
    expect(copyConflict).toHaveAttribute('aria-invalid', 'true');
    expect(undoConflict.querySelector('[data-slot="kbd"]')).toHaveClass('bg-destructive/10');
    expect(copyConflict.querySelector('[data-slot="kbd"]')).toHaveClass('text-destructive');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('allows the same shortcut in different scopes', () => {
    editor.keymap.register('test', {
      id: 'grid:test-up',
      label: 'Grid Up',
      category: 'Selection',
      scope: 'grid',
      shortcuts: ['alt+g'],
      target: { type: 'command', id: 'grid.test-up' },
    });
    editor.keymap.register('test', {
      id: 'presentation:test-up',
      label: 'Previous Slide',
      category: 'Presentation',
      scope: 'presentation',
      shortcuts: ['alt+p'],
      target: { type: 'command', id: 'presentation.test-up' },
    });
    renderDialog(editor);

    const editGridUp = screen.getByRole('button', { name: /Edit .* for Grid Up/ });
    expect(editGridUp.closest('tr')).toHaveTextContent('Grid');
    fireEvent.click(editGridUp);
    fireEvent.keyDown(editGridUp, { key: 'p', altKey: true });
    fireEvent.keyDown(editGridUp, { key: 'Enter' });

    expect(screen.queryByRole('heading', { name: 'Shortcut in use' })).not.toBeInTheDocument();
    expect(editor.keymap.getBindings('grid:test-up')).toEqual([['Alt+P']]);
    expect(screen.getByRole('button', { name: /Edit .* for Grid Up/ })).not.toHaveAttribute(
      'aria-invalid'
    );
  });

  it('records a two-stroke chord', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'c', ctrlKey: true });
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+Z']]);
    fireEvent.keyDown(editUndo, { key: 'Enter' });
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+K', 'Mod+C']]);
  });

  it('ignores modifier-only events while recording Command+R', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'Meta', code: 'MetaLeft', metaKey: true });
    fireEvent.keyDown(editUndo, { key: 'r', code: 'KeyR', metaKey: true });
    fireEvent.keyDown(editUndo, { key: 'Enter' });

    expect(screen.queryByText(/Meta Left/i)).not.toBeInTheDocument();
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+R']]);
  });

  it('leaves through global search without prompting after an auto-saved edit', async () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'Enter' });

    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'Language' } });
    const languageResult = within(
      screen.getByRole('navigation', { name: 'Settings search results' })
    ).getByRole('button', { name: /Language/ });
    fireEvent.click(languageResult);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
      expect(screen.getByLabelText('Language')).toHaveFocus();
    });
    expect(search).toHaveValue('');
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+J']]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('navigates immediately after an auto-saved edit', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: 'General' }));
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+J']]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('closes immediately after an auto-saved edit', () => {
    const onOpenChange = vi.fn();
    renderDialog(editor, onOpenChange);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'Enter' });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+J']]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('never installs an unsaved-changes browser guard', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    fireEvent.keyDown(editUndo, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(editUndo, { key: 'Enter' });
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('cancels an empty recording and navigates on an outside click', () => {
    renderDialog(editor);
    const editUndo = screen.getByRole('button', { name: /Edit .* for Undo/ });
    fireEvent.click(editUndo);
    const general = screen.getByRole('button', { name: 'General' });
    fireEvent.pointerDown(general);
    fireEvent.click(general);
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(editor.keymap.getBindings('command:undo')).toEqual([['Mod+Z']]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('groups commands into expandable scenario rows without resetting disclosure state', async () => {
    renderDialog(editor);
    const shortcutList = screen
      .getByRole('columnheader', { name: 'Command' })
      .closest('table')
      ?.querySelector('[data-slot="shortcut-list"]');
    const initialCommandCount = shortcutList?.querySelectorAll('[data-slot="shortcut-row"]').length;
    const collapseGeneral = screen.getByRole('button', { name: 'Collapse General' });
    const categoryRow = collapseGeneral.closest('[data-slot="shortcut-category-row"]');
    const commandRow = shortcutList?.querySelector('[data-slot="shortcut-row"]');

    expect(collapseGeneral).toHaveAttribute('aria-expanded', 'true');
    expect(collapseGeneral).toHaveTextContent('General');
    expect(collapseGeneral).toHaveClass('h-8', 'w-full');
    expect(collapseGeneral.querySelector('span')).toHaveClass('font-semibold');
    expect(categoryRow).toHaveClass('border-separator');
    expect(commandRow).toHaveClass('border-separator');
    expect(commandRow).not.toHaveClass('hover:bg-accent');
    expect(screen.getAllByText(/commands$/).length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(collapseGeneral);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const expandGeneral = screen.getByRole('button', { name: 'Expand General' });
    expect(expandGeneral).toHaveAttribute('aria-expanded', 'false');
    expect(shortcutList?.querySelectorAll('[data-slot="shortcut-row"]').length).toBeLessThan(
      initialCommandCount ?? 0
    );

    await act(async () => {
      editor.keymap.setUserBindings('command:undo', [['mod+u']]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByRole('button', { name: 'Expand General' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expand General' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByRole('button', { name: 'Collapse General' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(shortcutList?.querySelectorAll('[data-slot="shortcut-row"]')).toHaveLength(
      initialCommandCount ?? 0
    );
  });

  it('localizes grid headers and categories in Chinese', () => {
    setUiLanguage('zh');
    renderDialog(editor);

    expect(screen.getByRole('columnheader', { name: '命令' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '场景' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '快捷键' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '状态' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '折叠通用' })).toBeInTheDocument();
  });
});
