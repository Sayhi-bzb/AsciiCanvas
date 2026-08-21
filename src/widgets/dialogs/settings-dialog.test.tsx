import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatShortcutLabel } from '@/domains/actions/public';
import {
  createTextRenderingRuntime,
  TextRenderingProvider,
} from '@/domains/document/public';
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

const renderSettings = (onOpenChange = vi.fn()) =>
  render(
    <TextRenderingProvider runtime={createTextRenderingRuntime()}>
      <SettingsDialog open onOpenChange={onOpenChange} />
    </TextRenderingProvider>
  );

describe('SettingsDialog', () => {
  afterEach(() => {
    cleanup();
    act(() => setUiLanguage('en'));
  });

  it('uses compact responsive navigation without a visible dialog header', () => {
    renderSettings();

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
      'grid-rows-[auto_minmax(0,1fr)_2.25rem]',
      'md:grid-cols-[11rem_minmax(0,1fr)]',
      'md:grid-rows-[minmax(0,1fr)_2.25rem]'
    );
    expect(dialog.querySelector('[data-slot="settings-content"]')).toHaveClass('min-w-0');
    expect(dialog.querySelector('[data-slot="settings-content"]')).not.toHaveClass('w-full');
    expect(dialog.querySelector('[data-slot="dialog-footer"]')).toHaveClass(
      'h-9',
      'md:col-start-2',
      'md:row-start-2'
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toHaveClass(
      'flex-col',
      'gap-1'
    );
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).not.toHaveClass(
      'flex-nowrap',
      'lg:flex-col'
    );
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(dialog.querySelector('[data-slot="separator"]')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toHaveClass('shrink-0');
    expect(screen.getByText('Language', { selector: 'label' })).toHaveClass('min-w-0', 'truncate');
    expect(dialog.querySelector('[data-slot="settings-section-scroll"]')).toHaveClass(
      'overflow-x-hidden',
      'overflow-y-auto'
    );
  });

  it('switches sections from the desktop navigation', () => {
    renderSettings();
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
    expect(shortcutsItem).toHaveClass('w-full', 'min-w-0', 'min-h-7', 'text-xs', 'leading-4');
    expect(shortcutsItem).not.toHaveClass('min-h-8', 'text-sm');
    expect(within(shortcutsItem).getByText('Shortcuts')).toHaveClass('truncate');
  });

  it('switches sections from the mobile Select', async () => {
    renderSettings();
    const trigger = screen.getByRole('combobox', { name: 'Settings sections' });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Shortcuts' }));

    expect(screen.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });

  it('updates pasted text rendering preferences immediately', async () => {
    const runtime = createTextRenderingRuntime();
    render(
      <TextRenderingProvider runtime={runtime}>
        <SettingsDialog open onOpenChange={vi.fn()} />
      </TextRenderingProvider>
    );
    const navigation = screen.getByRole('navigation', { name: 'Settings sections' });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Display' }));

    expect(screen.getByRole('columnheader', { name: 'Setting' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Rendering' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Collapse Renderer theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Inline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Blocks' })).toBeInTheDocument();
    const displayGrid = screen
      .getByRole('heading', { name: 'Display' })
      .parentElement?.querySelector('[data-slot="display-settings-grid"]');
    expect(displayGrid?.querySelector('table')).toHaveAttribute('data-density', 'compact');
    expect(displayGrid?.querySelector('table')).toHaveAttribute('data-row-hover', 'none');
    expect(displayGrid?.querySelector('[data-slot="table-container"]')).toHaveClass(
      'overflow-x-hidden'
    );
    expect(displayGrid?.querySelector('table')).toHaveClass('min-w-0', 'table-fixed');
    expect(displayGrid?.querySelector('table')).not.toHaveClass(
      'min-w-[420px]',
      'min-w-[520px]'
    );
    expect(displayGrid?.querySelectorAll('col')).toHaveLength(3);

    const trigger = screen.getByLabelText('Pasted text rendering');
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Raw' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bold' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tables' }));

    expect(runtime.getProfile()).toMatchObject({
      mode: 'raw',
      features: {
        'markdown.strong': { enabled: false },
        'markdown.table': { enabled: false },
      },
    });
  });

  it('customizes and restores a Markdown rule color without exposing the Canvas picker', () => {
    const runtime = createTextRenderingRuntime();
    render(
      <TextRenderingProvider runtime={runtime}>
        <SettingsDialog open onOpenChange={vi.fn()} />
      </TextRenderingProvider>
    );
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Settings sections' })).getByRole('button', {
        name: 'Display',
      })
    );

    expect(screen.getByText('Syntax')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mermaid diagrams' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'GitHub alerts' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Unified diff' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Inline math' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Block math' })).toBeChecked();
    expect(screen.getByRole('button', {
      name: 'Customize color for Inline math: Default (Inherited)',
    })).toHaveAttribute('data-inherited', 'true');
    expect(screen.getByRole('button', {
      name: 'Customize color for Block math: Default (Inherited)',
    })).toHaveAttribute('data-inherited', 'true');
    expect(screen.getByRole('button', {
      name: 'Customize color for Mermaid diagrams: Default (Inherited)',
    })).toHaveAttribute('data-inherited', 'true');
    expect(screen.getByRole('button', {
      name: 'Customize color for Warning alerts: Default (#ca8a04)',
    }).querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#ca8a04',
    });
    expect(screen.getByRole('button', {
      name: 'Customize color for Deleted lines: Default (#dc2626)',
    }).querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#dc2626',
    });
    const inlineCodeColor = screen.getByRole('button', {
      name: 'Customize color for Inline code foreground: Default (#0891b2)',
    });
    expect(inlineCodeColor).toHaveAttribute('data-color-preview', 'default');
    expect(inlineCodeColor.querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#0891b2',
    });
    expect(screen.getByRole('button', {
      name: 'Customize color for Inline code background: Default (#e2e8f0)',
    }).querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#e2e8f0',
    });

    const blockquoteColor = screen.getByRole('button', {
      name: 'Customize color for Blockquotes: Default (#16a34a)',
    });
    expect(blockquoteColor.querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#16a34a',
    });

    const listColor = screen.getByRole('button', {
      name: 'Customize color for Lists: Default (#2563eb / Inherited)',
    });
    expect(listColor).toHaveAttribute('data-color-preview', 'mixed');
    expect(listColor.querySelectorAll('[data-color-segment]')).toHaveLength(2);
    expect(listColor.querySelector('[data-color-segment="#2563eb"]')).toHaveStyle({
      backgroundColor: '#2563eb',
    });
    expect(listColor.querySelector('[data-color-segment="inherited"]')).toHaveClass(
      'after:bg-muted-foreground'
    );

    expect(screen.getByRole('checkbox', { name: 'Task lists' })).toBeChecked();
    const uncheckedTaskColor = screen.getByRole('button', {
      name: 'Customize color for Unchecked tasks: Default (#94a3b8)',
    });
    const checkedTaskColor = screen.getByRole('button', {
      name: 'Customize color for Checked tasks: Default (#16a34a)',
    });
    expect(uncheckedTaskColor.querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#94a3b8',
    });
    expect(checkedTaskColor.querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#16a34a',
    });

    const tableHeaderColor = screen.getByRole('button', {
      name: 'Customize color for Table header background: Default (#2563eb)',
    });
    expect(tableHeaderColor.querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#2563eb',
    });
    expect(screen.getByRole('button', {
      name: 'Customize color for Table separator: Default (#94a3b8)',
    }).querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#94a3b8',
    });

    const boldColor = screen.getByRole('button', {
      name: 'Customize color for Bold: Default (Inherited)',
    });
    expect(boldColor).toHaveClass('size-6', 'rounded-full');
    expect(boldColor).toHaveAttribute('data-color-preview', 'inherit');
    expect(boldColor).toHaveAttribute('data-inherited', 'true');
    expect(boldColor.querySelector('[data-slot="color-swatch"]')).toHaveClass(
      'after:bg-muted-foreground'
    );
    fireEvent.click(boldColor);
    expect(screen.queryByRole('button', { name: 'Pick color from canvas' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pick ANSI color #800000' }));

    expect(runtime.getProfile().features['markdown.strong']?.colors).toEqual({
      foreground: '#800000',
    });
    const customBoldColor = screen.getByRole('button', {
      name: 'Customize color for Bold: #800000',
    });
    const customBoldSwatch = customBoldColor.querySelector('[data-slot="color-swatch"]');
    expect(customBoldColor).not.toHaveAttribute('data-inherited');
    expect(customBoldSwatch).not.toHaveClass('after:bg-muted-foreground');
    expect(customBoldSwatch).toHaveStyle({
      backgroundColor: '#800000',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Restore default color' }));
    expect(runtime.getProfile().features['markdown.strong']?.colors).toEqual({});
    expect(
      screen.getByRole('button', { name: 'Customize color for Bold: Default (Inherited)' })
    ).toHaveAttribute('data-inherited', 'true');
  });

  it('customizes a renderer theme token and updates rule defaults', () => {
    const runtime = createTextRenderingRuntime();
    render(
      <TextRenderingProvider runtime={runtime}>
        <SettingsDialog open onOpenChange={vi.fn()} />
      </TextRenderingProvider>
    );
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Settings sections' })).getByRole('button', {
        name: 'Display',
      })
    );

    fireEvent.click(screen.getByRole('button', {
      name: 'Customize color for Accent: Default (#2563eb)',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ANSI color #800000' }));

    expect(runtime.getProfile().renderTheme).toEqual({ accent: '#800000' });
    expect(screen.getByRole('button', {
      name: 'Customize color for Headings: Default (#800000)',
    }).querySelector('[data-slot="color-swatch"]')).toHaveStyle({
      backgroundColor: '#800000',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Restore default color' }));
    expect(runtime.getProfile().renderTheme).toEqual({});
  });

  it('customizes and restores task state colors independently', () => {
    const runtime = createTextRenderingRuntime();
    render(
      <TextRenderingProvider runtime={runtime}>
        <SettingsDialog open onOpenChange={vi.fn()} />
      </TextRenderingProvider>
    );
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Settings sections' })).getByRole('button', {
        name: 'Display',
      })
    );

    fireEvent.click(screen.getByRole('button', {
      name: 'Customize color for Unchecked tasks: Default (#94a3b8)',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ANSI color #800000' }));
    fireEvent.click(screen.getByRole('button', {
      name: 'Customize color for Checked tasks: Default (#16a34a)',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ANSI color #008000' }));

    expect(runtime.getProfile().features['markdown.task-list']?.colors).toEqual({
      unchecked: '#800000',
      checked: '#008000',
    });

    fireEvent.click(screen.getByRole('button', {
      name: 'Customize color for Unchecked tasks: #800000',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore default color' }));
    expect(runtime.getProfile().features['markdown.task-list']?.colors).toEqual({
      checked: '#008000',
    });
  });

  it('preserves display disclosure state while preferences update', async () => {
    renderSettings();
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Settings sections' })).getByRole('button', {
        name: 'Display',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Inline' }));
    expect(screen.queryByRole('checkbox', { name: 'Bold' })).not.toBeInTheDocument();

    const trigger = screen.getByLabelText('Pasted text rendering');
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: 'Raw' }));

    expect(screen.getByRole('button', { name: 'Expand Inline' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('checkbox', { name: 'Bold' })).not.toBeInTheDocument();
  });

  it('applies language changes immediately', async () => {
    renderSettings();
    const trigger = screen.getByLabelText('Language');

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: '中文' }));

    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '通用' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '快捷键' })).toBeInTheDocument();
  });

  it('searches settings globally and focuses the selected general control', async () => {
    renderSettings();
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

  it('expands and focuses a collapsed display setting selected from global search', async () => {
    renderSettings();
    const navigation = screen.getByRole('navigation', { name: 'Settings sections' });
    fireEvent.click(within(navigation).getByRole('button', { name: 'Display' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Rendering' }));
    expect(screen.queryByLabelText('Pasted text rendering')).not.toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'Pasted text rendering' } });
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Settings search results' })).getByRole(
        'button',
        { name: 'Pasted text rendering' }
      )
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Pasted text rendering')).toHaveFocus();
    });
    expect(screen.getByRole('button', { name: 'Collapse Rendering' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(search).toHaveValue('');
  });

  it('opens a shortcut result and passes its entry to the shortcut panel', async () => {
    renderSettings();
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
    renderSettings();
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
    renderSettings(onOpenChange);
    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'missing setting' } });
    expect(screen.getByRole('status')).toHaveTextContent('No settings found');

    fireEvent.keyDown(search, { key: 'Escape' });
    expect(search).toHaveValue('');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeInTheDocument();
  });
});
