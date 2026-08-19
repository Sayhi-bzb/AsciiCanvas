import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatShortcutLabel } from '@/domains/actions/public';
import { setUiLanguage } from '@/shared/i18n';
import { SettingsDialog } from './settings-dialog';

vi.mock('@/domains/editor/public', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domains/editor/public')>();
  return {
    ...actual,
    useEditorKeymapSnapshot: () => ({
      revision: 1,
      entries: [
        {
          id: 'command:format-bold',
          owner: 'test',
          target: { type: 'command' as const, id: 'format-bold' },
          label: 'Bold',
          category: 'Formatting',
          scope: 'canvas' as const,
          configurable: true,
          defaultShortcuts: [['Mod+B']],
          shortcuts: [['Mod+B']],
          userDefined: false,
          weight: 0,
          repeat: 'ignore' as const,
        },
      ],
    }),
  };
});

vi.mock('./keyboard-shortcuts-dialog', () => ({
  KeyboardShortcutsPanel({ revealEntryId }: { revealEntryId?: string | null }) {
    return <div data-testid="shortcut-editor" data-reveal-entry-id={revealEntryId ?? ''} />;
  },
}));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

describe('SettingsDialog', () => {
  afterEach(() => {
    cleanup();
    act(() => setUiLanguage('en'));
  });

  it('uses compact responsive navigation without a visible dialog header', () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveClass('sm:max-w-[840px]', 'grid-rows-[minmax(0,1fr)]', 'gap-0');
    expect(dialog.querySelector('[data-slot="dialog-header"]')).not.toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="dialog-close"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Settings' })).toHaveClass('sr-only');
    expect(screen.getByRole('searchbox', { name: 'Search settings' })).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="settings-navigation-mobile"]')).toHaveClass(
      'md:hidden',
      '[&_svg]:size-[1em]!'
    );
    expect(dialog.querySelector('[data-slot="settings-navigation-inline"]')).toHaveClass(
      'hidden',
      'md:block',
      '[&_svg]:size-[1em]!'
    );
    expect(dialog.querySelector('[data-slot="scroll-area"]')).not.toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="settings-layout"]')).toHaveClass(
      'grid',
      'min-w-0',
      'grid-rows-[auto_minmax(0,1fr)]',
      'lg:grid-cols-[11rem_minmax(0,1fr)]'
    );
    expect(dialog.querySelector('[data-slot="settings-content"]')).toHaveClass('min-w-0');
    expect(dialog.querySelector('[data-slot="settings-content"]')).not.toHaveClass('w-full');
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toHaveClass(
      'flex-nowrap',
      'lg:flex-col'
    );
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="separator"]')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toHaveClass('shrink-0');
    expect(screen.getByText('Language', { selector: 'label' })).toHaveClass('whitespace-nowrap');
  });

  it('switches sections from the desktop navigation', () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />);
    const navigation = screen.getByRole('navigation', { name: 'Settings sections' });

    fireEvent.click(within(navigation).getByRole('button', { name: 'Shortcuts' }));

    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'Shortcuts' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const shortcutsItem = within(navigation).getByRole('button', {
      name: 'Shortcuts',
    });
    expect(shortcutsItem).toHaveClass('min-w-0', 'lg:w-full', 'min-h-7', 'text-xs', 'leading-4');
    expect(shortcutsItem).not.toHaveClass('min-h-8', 'text-sm');
    expect(within(shortcutsItem).getByText('Shortcuts')).toHaveClass('truncate');
  });

  it('switches sections from the mobile Select', async () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />);
    const trigger = screen.getByRole('combobox', { name: 'Settings sections' });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Shortcuts' }));

    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('applies language changes immediately', async () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />);
    const trigger = screen.getByLabelText('Language');

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: '中文' }));

    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '通用' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '快捷键' })).toBeInTheDocument();
  });

  it('searches settings globally and focuses the selected general control', async () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />);
    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'English' } });

    const results = screen.getByRole('navigation', { name: 'Settings search results' });
    const languageResult = within(results).getByRole('button', { name: 'Language' });
    expect(languageResult).toHaveTextContent(/^Language$/);
    expect(languageResult).not.toHaveTextContent('English');
    fireEvent.click(languageResult);

    await waitFor(() => {
      expect(search).toHaveValue('');
      expect(screen.getByLabelText('Language')).toHaveFocus();
    });
  });

  it('opens a shortcut result and passes its entry to the shortcut panel', async () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />);
    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'Bold' } });

    const boldResult = within(
      screen.getByRole('navigation', { name: 'Settings search results' })
    ).getByRole('button', { name: 'Bold' });
    expect(boldResult).toHaveTextContent(/^Bold$/);
    expect(boldResult).not.toHaveTextContent('Formatting');
    fireEvent.click(boldResult);

    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-editor')).toHaveAttribute(
      'data-reveal-entry-id',
      'command:format-bold'
    );
    expect(search).toHaveValue('');
  });

  it('keeps hidden shortcut metadata searchable', () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />);
    const search = screen.getByRole('searchbox', { name: 'Search settings' });

    fireEvent.change(search, { target: { value: 'Formatting' } });
    expect(
      within(screen.getByRole('navigation', { name: 'Settings search results' })).getByRole(
        'button',
        { name: 'Bold' }
      )
    ).toHaveTextContent(/^Bold$/);

    fireEvent.change(search, { target: { value: formatShortcutLabel(['Mod+B']) } });
    expect(
      within(screen.getByRole('navigation', { name: 'Settings search results' })).getByRole(
        'button',
        { name: 'Bold' }
      )
    ).toHaveTextContent(/^Bold$/);
  });

  it('clears global search with Escape and reports no results accessibly', () => {
    const onOpenChange = vi.fn();
    render(<SettingsDialog open onOpenChange={onOpenChange} />);
    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'missing setting' } });
    expect(screen.getByRole('status')).toHaveTextContent('No settings found');

    fireEvent.keyDown(search, { key: 'Escape' });
    expect(search).toHaveValue('');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeInTheDocument();
  });
});
