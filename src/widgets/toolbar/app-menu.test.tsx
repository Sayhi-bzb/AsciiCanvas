import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/domains/canvas/testing';
import { createSlideDeck } from '@/domains/slides/public';
import { setUiLanguage } from '@/shared/i18n';
import { AppMenu } from './app-menu';

describe('AppMenu slide interchange', () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    cleanup();
    act(() => setUiLanguage('en'));
    useEditorStore.setState(initialState, true);
  });

  it('offers Markdown import and export while a Slide Deck is active', async () => {
    const slideDeck = createSlideDeck({ initialSlideId: 'slide-1' });
    useEditorStore.setState({
      canvasMode: 'slide',
      slideDeck,
      activeCanvasId: 'deck',
      canvasSessions: [
        {
          id: 'deck',
          name: 'Agent Deck',
          mode: 'slide',
          slideDeck,
          scene: [],
          components: [],
          grid: [],
        },
      ],
      grid: new Map(),
    });
    act(() => setUiLanguage('en'));

    const { container } = render(<AppMenu />);
    expect(container.querySelector('input[type="file"]')).toHaveAttribute(
      'accept',
      expect.stringContaining('.md')
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      button: 0,
      ctrlKey: false,
    });

    const importItem = await screen.findByRole('menuitem', { name: 'Import' });
    expect(importItem.closest('[data-slot="dropdown-menu-content"]')).toHaveClass(
      'w-48',
      'min-w-32',
      'max-h-(--radix-dropdown-menu-content-available-height)'
    );
    const exportItem = screen.getByRole('menuitem', { name: 'Export' });
    fireEvent.pointerMove(exportItem, { pointerType: 'mouse' });
    await waitFor(() => expect(exportItem).toHaveAttribute('data-state', 'open'));
    expect(await screen.findByRole('menuitem', { name: 'Markdown' })).not.toHaveAttribute(
      'aria-haspopup',
      'menu'
    );
    const githubItem = screen.getByRole('menuitem', { name: 'GitHub' });
    const githubMark = githubItem.querySelector('[data-slot="github-mark-icon"]');
    expect(githubMark).toHaveAttribute('viewBox', '0 0 98 96');
    expect(githubMark?.querySelector('path')).toHaveAttribute('fill', 'currentColor');
    expect(githubItem.querySelector('.lucide-git-fork')).not.toBeInTheDocument();
  });

  it('opens settings and restores menu trigger focus', async () => {
    act(() => setUiLanguage('en'));
    render(<AppMenu />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Settings' })
    );

    expect(
      await screen.findByRole('heading', { name: 'Settings' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('localizes the settings menu item', async () => {
    act(() => setUiLanguage('zh'));
    render(<AppMenu />);

    fireEvent.pointerDown(screen.getByRole('button', { name: '打开菜单' }), {
      button: 0,
      ctrlKey: false,
    });

    expect(
      await screen.findByRole('menuitem', { name: '设置' })
    ).toBeInTheDocument();
  });
});
