import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { replaceCanvasGrid, useEditorStore } from '@/domains/canvas/testing';
import { ShortcutProvider } from '@/shared/shortcuts/dispatcher';
import { FreeformPaletteControl } from './freeform-palette';

function Palette(props: React.ComponentProps<typeof FreeformPaletteControl>) {
  return (
    <ShortcutProvider>
      <FreeformPaletteControl {...props} />
    </ShortcutProvider>
  );
}

describe('FreeformPaletteControl', () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    act(() => {
      replaceCanvasGrid([]);
      useEditorStore.setState(initialState, true);
    });
  });

  it('starts open, toggles from the icon, and closes when Hand becomes active', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    render(<Palette />);

    const toggle = screen.getByRole('button', { name: 'Toggle palette' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('freeform-palette-panel')).toHaveClass(
      'left-[calc(100%+0.5rem)]',
      'top-0',
      'w-[min(10rem,calc(100vw-2rem))]',
      'bg-host-surface',
      'shadow-host'
    );
    expect(screen.getByTestId('freeform-palette-panel')).not.toHaveClass(
      'left-0',
      'top-[calc(100%+0.5rem)]',
      'bg-sidebar',
      'bg-overlay-surface',
      'shadow-overlay'
    );

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('freeform-palette-panel')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(screen.getByTestId('freeform-palette-panel')).toBeInTheDocument();

    act(() => useEditorStore.setState({ tool: 'pan' }));
    expect(screen.queryByTestId('freeform-palette-panel')).not.toBeInTheDocument();

    act(() => useEditorStore.setState({ tool: 'select' }));
    expect(screen.getByTestId('freeform-palette-panel')).toBeInTheDocument();
  });

  it('shows the current tool color as a swatch instead of an icon', () => {
    useEditorStore.setState({
      canvasMode: 'freeform',
      tool: 'select',
      brushColor: '#123456',
      brushBackgroundColor: '#abcdef',
    });
    render(<Palette />);

    const toggle = screen.getByRole('button', { name: 'Toggle palette' });
    const swatch = screen.getByTestId('freeform-palette-swatch');
    expect(toggle.querySelector('svg')).not.toBeInTheDocument();
    expect(swatch).toHaveClass('rounded-[3px]');
    expect(swatch).not.toHaveClass('rounded-md', 'rounded-full');
    expect(swatch).toHaveStyle({ backgroundColor: '#123456' });

    act(() => useEditorStore.setState({ tool: 'bg' }));
    expect(swatch).toHaveStyle({ backgroundColor: '#abcdef' });
  });

  it('owns the former Alt+6 shortcut and closes on Escape', () => {
    const onBeforeOpen = vi.fn();
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    render(<Palette onBeforeOpen={onBeforeOpen} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('freeform-palette-panel')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { code: 'Digit6', altKey: true });
    expect(onBeforeOpen).toHaveBeenCalledOnce();
    expect(screen.getByTestId('freeform-palette-panel')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('freeform-palette-panel')).not.toBeInTheDocument();
  });

  it('preserves a manual collapse while switching between drawing tools', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    render(<Palette />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle palette' }));
    expect(screen.queryByTestId('freeform-palette-panel')).not.toBeInTheDocument();

    act(() => useEditorStore.setState({ tool: 'bg' }));
    expect(screen.queryByTestId('freeform-palette-panel')).not.toBeInTheDocument();
  });

  it('applies foreground and background colors to the selection and defaults', () => {
    act(() => {
      replaceCanvasGrid([['0,0', { char: 'A', color: '#111111' }]]);
      useEditorStore.setState({
        canvasMode: 'freeform',
        tool: 'select',
        brushColor: '#111111',
        brushBackgroundColor: '#222222',
        selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
      });
    });
    render(<Palette />);

    fireEvent.click(screen.getByRole('button', { name: 'Pick ANSI color #ff0000' }));
    expect(useEditorStore.getState().brushColor).toBe('#ff0000');
    expect(useEditorStore.getState().grid.get('0,0')?.color).toBe('#ff0000');

    act(() => useEditorStore.setState({ tool: 'bg' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ANSI color #0000ff' }));
    expect(useEditorStore.getState().brushBackgroundColor).toBe('#0000ff');
    expect(useEditorStore.getState().grid.get('0,0')?.bgColor).toBe('#0000ff');
  });

  it('renders the picker directly without a separate color-target header', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    render(<Palette />);

    expect(screen.getByRole('tablist', { name: 'Color palettes' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Foreground' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Background' })).not.toBeInTheDocument();
  });

  it('does not render outside freeform mode', () => {
    useEditorStore.setState({ canvasMode: 'structured', tool: 'select' });
    render(<Palette />);
    expect(screen.queryByRole('button', { name: 'Toggle palette' })).not.toBeInTheDocument();
  });
});
