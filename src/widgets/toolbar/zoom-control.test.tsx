import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEditorStore } from '@/domains/canvas/public';
import { ZoomControl } from './zoom-control';

let isMobile = false;
let reduceMotion = true;

vi.mock('@/shared/hooks/use-mobile', () => ({
  useIsMobile: () => isMobile,
}));

vi.mock('@/widgets/canvas-editor/Minimap', () => ({
  Minimap: ({ containerSize }: { containerSize?: { width: number; height: number } }) => (
    <div data-testid="mock-minimap">
      {containerSize ? `${containerSize.width}x${containerSize.height}` : 'no-size'}
    </div>
  ),
}));

beforeEach(() => {
  reduceMotion = true;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduceMotion }))
  );
});

describe('ZoomControl', () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    isMobile = false;
    cleanup();
    useEditorStore.setState(initialState, true);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders an inline compound control in the lower-left host', () => {
    useEditorStore.setState({ zoom: 1.256 });

    render(<ZoomControl containerSize={{ width: 1000, height: 700 }} />);

    const host = screen.getByTestId('zoom-control');
    const out = screen.getByTestId('zoom-out');
    const reset = screen.getByTestId('zoom-reset');
    const zoomIn = screen.getByTestId('zoom-in');
    const grid = screen.getByTestId('zoom-grid');
    const minimap = screen.getByTestId('zoom-minimap-toggle');

    expect(host).toHaveClass('fixed', 'bottom-3', 'left-3', 'flex', 'bg-muted');
    expect(Array.from(host.children)).toEqual([out, reset, zoomIn, grid, minimap]);
    expect(out).toHaveClass('size-8', 'rounded-r-none');
    expect(reset).toHaveClass('h-8', 'min-w-14', 'rounded-none', 'tabular-nums');
    expect(zoomIn).toHaveClass('size-8', 'rounded-none');
    expect(grid).toHaveClass('size-8', 'rounded-none');
    expect(minimap).toHaveClass('size-8', 'rounded-l-none');
    expect(reset).toHaveTextContent('126%');
    expect(reset).toHaveAttribute('aria-label', 'Reset to 100% — 126%');
    expect(screen.queryByTestId('zoom-menu-trigger')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles the workspace grid and minimap from the viewport group', async () => {
    useEditorStore.setState({ canvasMode: 'freeform', showGrid: true });
    render(<ZoomControl containerSize={{ width: 1000, height: 700 }} />);

    const grid = screen.getByTestId('zoom-grid');
    const minimap = screen.getByTestId('zoom-minimap-toggle');
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    expect(grid).toHaveClass('bg-accent');
    fireEvent.click(grid);
    expect(useEditorStore.getState().showGrid).toBe(false);
    expect(grid).toHaveAttribute('aria-pressed', 'false');

    expect(minimap).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(minimap);
    expect(minimap).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByTestId('mock-minimap')).toHaveTextContent('1000x700');
    expect(screen.getByTestId('zoom-minimap')).toHaveClass('absolute', 'bottom-full', 'left-0');
    fireEvent.click(minimap);
    expect(screen.queryByTestId('zoom-minimap')).not.toBeInTheDocument();
  });

  it('hides and closes the minimap in animation mode', async () => {
    useEditorStore.setState({ canvasMode: 'freeform' });
    render(<ZoomControl containerSize={{ width: 1000, height: 700 }} />);
    fireEvent.click(screen.getByTestId('zoom-minimap-toggle'));
    expect(await screen.findByTestId('zoom-minimap')).toBeInTheDocument();

    act(() => useEditorStore.setState({ canvasMode: 'animation' }));
    await waitFor(() => {
      expect(screen.queryByTestId('zoom-minimap-toggle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('zoom-minimap')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('zoom-grid')).toHaveClass('rounded-l-none');
  });

  it('zooms around the canvas center and resets directly when motion is reduced', () => {
    useEditorStore.setState({
      canvasMode: 'freeform',
      zoom: 1,
      offset: { x: 10, y: 20 },
    });

    render(<ZoomControl containerSize={{ width: 1000, height: 700 }} />);
    fireEvent.click(screen.getByTestId('zoom-in'));

    expect(useEditorStore.getState().zoom).toBeCloseTo(1.2);
    expect(useEditorStore.getState().offset).toEqual({
      x: -88,
      y: -46,
    });
    fireEvent.click(screen.getByTestId('zoom-out'));
    expect(useEditorStore.getState().zoom).toBeCloseTo(1);
    expect(useEditorStore.getState().offset.x).toBeCloseTo(10);
    expect(useEditorStore.getState().offset.y).toBeCloseTo(20);

    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.click(screen.getByTestId('zoom-reset'));
    expect(useEditorStore.getState().zoom).toBeCloseTo(1);
    expect(useEditorStore.getState().offset.x).toBeCloseTo(10);
    expect(useEditorStore.getState().offset.y).toBeCloseTo(20);
  });
  it('animates zoom through intermediate center-anchored frames', () => {
    reduceMotion = false;
    let nextFrameId = 0;
    let currentTime = 0;
    const frames = new Map<number, FrameRequestCallback>();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrameId += 1;
      frames.set(nextFrameId, callback);
      return nextFrameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
      frames.delete(frameId);
    });
    vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

    const runFrame = (timestamp: number) => {
      const nextFrame = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
      expect(nextFrame).toBeDefined();
      if (!nextFrame) return;
      frames.delete(nextFrame[0]);
      act(() => nextFrame[1](timestamp));
      currentTime = timestamp;
    };

    useEditorStore.setState({
      canvasMode: 'freeform',
      zoom: 1,
      offset: { x: 10, y: 20 },
    });

    render(<ZoomControl containerSize={{ width: 1000, height: 700 }} />);
    fireEvent.click(screen.getByTestId('zoom-in'));

    expect(useEditorStore.getState().zoom).toBe(1);

    runFrame(140);
    expect(useEditorStore.getState().zoom).toBeGreaterThan(1);
    expect(useEditorStore.getState().zoom).toBeLessThan(1.2);
    expect(useEditorStore.getState().offset.x).toBeGreaterThan(-88);
    expect(useEditorStore.getState().offset.x).toBeLessThan(10);

    runFrame(280);
    expect(useEditorStore.getState().zoom).toBeCloseTo(1.2);
    expect(useEditorStore.getState().offset.x).toBeCloseTo(-88);
    expect(useEditorStore.getState().offset.y).toBeCloseTo(-46);

    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.click(screen.getByTestId('zoom-in'));
    expect(useEditorStore.getState().zoom).toBeCloseTo(1.2);

    runFrame(560);
    expect(useEditorStore.getState().zoom).toBeCloseTo(1.728);

    fireEvent.click(screen.getByTestId('zoom-in'));
    runFrame(700);
    const zoomBeforeReset = useEditorStore.getState().zoom;
    expect(zoomBeforeReset).toBeGreaterThan(1.728);

    fireEvent.click(screen.getByTestId('zoom-reset'));
    expect(useEditorStore.getState().zoom).toBeCloseTo(zoomBeforeReset);

    runFrame(980);
    expect(useEditorStore.getState().zoom).toBeCloseTo(1);
    expect(useEditorStore.getState().offset.x).toBeCloseTo(10);
    expect(useEditorStore.getState().offset.y).toBeCloseTo(20);
  });

  it('changes animation zoom without changing its offset', () => {
    useEditorStore.setState({
      canvasMode: 'animation',
      zoom: 1,
      offset: { x: 40, y: 60 },
    });

    render(<ZoomControl containerSize={{ width: 1000, height: 700 }} />);
    fireEvent.click(screen.getByTestId('zoom-in'));

    expect(useEditorStore.getState().zoom).toBeCloseTo(1.2);
    expect(useEditorStore.getState().offset).toEqual({ x: 40, y: 60 });
  });

  it('disables directional actions at their limits', async () => {
    useEditorStore.setState({ zoom: 5 });

    render(<ZoomControl containerSize={{ width: 1000, height: 700 }} />);
    expect(screen.getByTestId('zoom-in')).toBeDisabled();

    expect(screen.getByTestId('zoom-reset')).toBeEnabled();

    act(() => {
      useEditorStore.setState({ zoom: 0.1 });
    });
    await waitFor(() => expect(screen.getByTestId('zoom-out')).toBeDisabled());
  });
  it('disables all actions until the container size is available', () => {
    render(<ZoomControl containerSize={undefined} />);

    expect(screen.getByTestId('zoom-out')).toBeDisabled();
    expect(screen.getByTestId('zoom-reset')).toBeDisabled();
    expect(screen.getByTestId('zoom-in')).toBeDisabled();
  });

  it('does not render on mobile', () => {
    isMobile = true;

    render(<ZoomControl containerSize={{ width: 390, height: 844 }} />);

    expect(screen.queryByTestId('zoom-control')).not.toBeInTheDocument();
  });
});
