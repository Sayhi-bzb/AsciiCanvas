import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '@/domains/canvas/testing';
import { createSlideDeck } from '@/domains/slides/public';
import { setUiLanguage } from '@/shared/i18n';
import { browser } from '@/shared/services/effects';
import { AppMenu } from './app-menu';
import { CanvasWorkspaceProvider } from '@/widgets/canvas-editor/engine/CanvasWorkspace';
import { OnboardingTourContext } from '@/widgets/onboarding/onboarding-context';
import { EditorPresentationProvider } from '@/widgets/editor-chrome/public';

describe('AppMenu slide interchange', () => {
  const initialState = useEditorStore.getState();

  beforeEach(() => {
    window.localStorage.removeItem('chardesk-github-stars-v1');
    window.localStorage.removeItem('chardesk-canvas-split-enabled');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 1234 }),
    }));
  });

  afterEach(() => {
    cleanup();
    act(() => setUiLanguage('en'));
    useEditorStore.setState(initialState, true);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

    const fileItem = await screen.findByRole('menuitem', { name: 'File' });
    fireEvent.pointerMove(fileItem, { pointerType: 'mouse' });
    await waitFor(() => expect(fileItem).toHaveAttribute('data-state', 'open'));
    await screen.findByRole('menuitem', { name: 'Import' });
    expect(fileItem.closest('[data-slot="dropdown-menu-content"]')).toHaveClass(
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
    const githubItem = screen.getByRole('menuitem', { name: /^GitHub/ });
    const githubMark = githubItem.querySelector('[data-slot="github-mark-icon"]');
    expect(githubMark).toHaveAttribute('viewBox', '0 0 98 96');
    expect(githubMark?.querySelector('path')).toHaveAttribute('fill', 'currentColor');
    expect(githubItem.querySelector('.lucide-git-fork')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(githubItem).toHaveTextContent('GitHub1,234');
      expect(githubItem.querySelector('.lucide-star')).toBeInTheDocument();
    });
  });

  it('keeps ANSI out of static canvas exports', async () => {
    useEditorStore.setState({
      canvasMode: 'freeform',
      grid: new Map([['0,0', { char: 'A', color: '#ffffff' }]]),
    });
    act(() => setUiLanguage('en'));
    render(<AppMenu />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      button: 0,
      ctrlKey: false,
    });
    const fileItem = await screen.findByRole('menuitem', { name: 'File' });
    fireEvent.pointerMove(fileItem, { pointerType: 'mouse' });
    await waitFor(() => expect(fileItem).toHaveAttribute('data-state', 'open'));
    const exportItem = screen.getByRole('menuitem', { name: 'Export' });
    fireEvent.pointerMove(exportItem, { pointerType: 'mouse' });
    await waitFor(() => expect(exportItem).toHaveAttribute('data-state', 'open'));

    expect(await screen.findByRole('menuitem', { name: 'TXT' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'CharDesk' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'PNG' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'ANSI' })).not.toBeInTheDocument();
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

  it('toggles split view from the app menu with the horizontal split icon', async () => {
    act(() => setUiLanguage('en'));
    render(
      <CanvasWorkspaceProvider>
        <AppMenu />
      </CanvasWorkspaceProvider>
    );

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const splitItem = await screen.findByRole('menuitem', { name: 'Split' });
    expect(splitItem.querySelector('.lucide-square-split-horizontal')).toBeInTheDocument();
    fireEvent.click(splitItem);

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(await screen.findByRole('menuitem', { name: 'Close split' })).toBeInTheDocument();
  });

  it('starts the guide after closing the menu and opens documentation externally', async () => {
    act(() => setUiLanguage('en'));
    const requestStart = vi.fn();
    const openExternal = vi.spyOn(browser, 'openExternal').mockReturnValue(null);
    render(
      <OnboardingTourContext.Provider
        value={{ phase: 'idle', canStart: true, requestStart }}
      >
        <AppMenu />
      </OnboardingTourContext.Provider>
    );

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const helpItem = await screen.findByRole('menuitem', { name: 'Help' });
    fireEvent.pointerMove(helpItem, { pointerType: 'mouse' });
    await waitFor(() => expect(helpItem).toHaveAttribute('data-state', 'open'));
    const guideItem = await screen.findByRole('menuitem', { name: 'Guide' });
    expect(guideItem.querySelector('.lucide-compass')).toBeInTheDocument();
    fireEvent.click(guideItem);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(requestStart).toHaveBeenCalledOnce());

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    const reopenedHelpItem = await screen.findByRole('menuitem', { name: 'Help' });
    fireEvent.pointerMove(reopenedHelpItem, { pointerType: 'mouse' });
    await waitFor(() => expect(reopenedHelpItem).toHaveAttribute('data-state', 'open'));
    const documentationItem = await screen.findByRole('menuitem', {
      name: 'Documentation',
    });
    expect(documentationItem.querySelector('.lucide-book-open')).toBeInTheDocument();
    fireEvent.click(documentationItem);

    expect(openExternal).toHaveBeenCalledWith('/docs');
  });

  it('disables the guide when onboarding is unavailable', async () => {
    act(() => setUiLanguage('en'));
    render(<AppMenu />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      button: 0,
      ctrlKey: false,
    });

    const helpItem = await screen.findByRole('menuitem', { name: 'Help' });
    fireEvent.pointerMove(helpItem, { pointerType: 'mouse' });
    await waitFor(() => expect(helpItem).toHaveAttribute('data-state', 'open'));
    expect(await screen.findByRole('menuitem', { name: 'Guide' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
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
    const helpItem = screen.getByRole('menuitem', { name: '帮助' });
    fireEvent.pointerMove(helpItem, { pointerType: 'mouse' });
    await waitFor(() => expect(helpItem).toHaveAttribute('data-state', 'open'));
    expect(await screen.findByRole('menuitem', { name: '引导' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '文档' })).toBeInTheDocument();
  });

  it('toggles Zen and uses an explicit exit label', async () => {
    act(() => setUiLanguage('en'));
    render(
      <EditorPresentationProvider>
        <AppMenu />
      </EditorPresentationProvider>
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      button: 0,
      ctrlKey: false,
    });
    const enterItem = await screen.findByRole('menuitem', { name: 'Zen' });
    expect(enterItem.querySelector('.lucide-focus')).toBeInTheDocument();
    fireEvent.click(enterItem);

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Exit Zen' }));

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      button: 0,
      ctrlKey: false,
    });
    expect(await screen.findByRole('menuitem', { name: 'Zen' })).toBeInTheDocument();
  });

  it('exits Zen before starting the guide', async () => {
    act(() => setUiLanguage('en'));
    const requestStart = vi.fn();
    render(
      <EditorPresentationProvider initialMode="zen">
        <OnboardingTourContext.Provider
          value={{ phase: 'idle', canStart: true, requestStart }}
        >
          <AppMenu />
        </OnboardingTourContext.Provider>
      </EditorPresentationProvider>
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      button: 0,
      ctrlKey: false,
    });
    const helpItem = await screen.findByRole('menuitem', { name: 'Help' });
    fireEvent.pointerMove(helpItem, { pointerType: 'mouse' });
    await waitFor(() => expect(helpItem).toHaveAttribute('data-state', 'open'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Guide' }));

    await waitFor(() => expect(requestStart).toHaveBeenCalledOnce());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      button: 0,
      ctrlKey: false,
    });
    expect(await screen.findByRole('menuitem', { name: 'Zen' })).toBeInTheDocument();
  });
});
