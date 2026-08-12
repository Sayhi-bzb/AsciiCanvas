import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

    expect(await screen.findByRole('menuitem', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Export' })).toBeInTheDocument();
  });
});
