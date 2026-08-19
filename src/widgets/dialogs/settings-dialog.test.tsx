import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setUiLanguage } from '@/shared/i18n';
import { SettingsDialog } from './settings-dialog';

vi.mock('./keyboard-shortcuts-dialog', () => ({
  KeyboardShortcutsPanel: () => <div data-testid="shortcut-editor" />,
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
});
