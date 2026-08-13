import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Toolbar as ToolbarUnderTest } from '@/widgets/toolbar/dock';
import { ColorPickerPanel } from '@/widgets/color-picker';
import { useEditorStore } from '@/domains/canvas/testing';
import { setUiLanguage } from '@/shared/i18n';
import { ShortcutProvider } from '@/shared/shortcuts/dispatcher';

vi.mock('@/shared/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

type TestToolbarProps = Omit<
  ComponentProps<typeof ToolbarUnderTest>,
  'isCanvasTextEditing' | 'onExitCanvasTextEditing'
> & {
  isCanvasTextEditing?: boolean;
  onExitCanvasTextEditing?: () => void;
};

function Toolbar({
  isCanvasTextEditing = false,
  onExitCanvasTextEditing = () => {},
  ...props
}: TestToolbarProps) {
  return (
    <ShortcutProvider>
      <ToolbarUnderTest
        {...props}
        isCanvasTextEditing={isCanvasTextEditing}
        onExitCanvasTextEditing={onExitCanvasTextEditing}
      />
    </ShortcutProvider>
  );
}

function StoreToolbar() {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);

  return <Toolbar tool={tool} setTool={setTool} onUndo={() => {}} />;
}

describe('Toolbar dock', () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    act(() => setUiLanguage('en'));
    useEditorStore.setState(initialState, true);
  });

  it('shows Hand first in freeform and selects it persistently', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    const setTool = vi.fn();
    const { container } = render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);

    const items = container.querySelectorAll('[data-toolbar-item]');
    expect(items[0]).toHaveAttribute('data-toolbar-item', 'pan');
    fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
    expect(setTool).toHaveBeenCalledWith('pan');
  });

  it('maps Alt+digits to the visible freeform dock order', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    const setTool = vi.fn();
    render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);

    fireEvent.keyDown(window, {
      key: '¡',
      code: 'Digit1',
      altKey: true,
    });
    fireEvent.keyDown(window, {
      key: '£',
      code: 'Digit3',
      altKey: true,
    });

    expect(setTool).toHaveBeenNthCalledWith(1, 'pan');
    expect(setTool).toHaveBeenNthCalledWith(2, 'box');
    expect(screen.getByRole('button', { name: 'Hand' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Alt+1'
    );
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Alt+2'
    );
  });

  it('exits canvas text editing before using a Dock shortcut', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    const setTool = vi.fn();
    const onExitCanvasTextEditing = vi.fn();
    const input = document.createElement('input');
    document.body.append(input);
    const view = render(
      <Toolbar
        tool="select"
        setTool={setTool}
        onUndo={vi.fn()}
        isCanvasTextEditing
        onExitCanvasTextEditing={onExitCanvasTextEditing}
      />
    );

    fireEvent.keyDown(window, {
      code: 'Digit1',
      altKey: true,
    });
    expect(onExitCanvasTextEditing).toHaveBeenCalledOnce();
    expect(setTool).toHaveBeenCalledWith('pan');
    expect(onExitCanvasTextEditing.mock.invocationCallOrder[0]).toBeLessThan(
      setTool.mock.invocationCallOrder[0]
    );

    view.rerender(
      <Toolbar
        tool="select"
        setTool={setTool}
        onUndo={vi.fn()}
        onExitCanvasTextEditing={onExitCanvasTextEditing}
      />
    );
    fireEvent.keyDown(input, {
      code: 'Digit1',
      altKey: true,
    });
    expect(setTool).toHaveBeenCalledTimes(1);
    expect(onExitCanvasTextEditing).toHaveBeenCalledOnce();
    input.remove();
  });

  it('leaves Alt+6 available for the freeform palette surface', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    const onExitCanvasTextEditing = vi.fn();
    render(
      <Toolbar
        tool="select"
        setTool={vi.fn()}
        onUndo={vi.fn()}
        isCanvasTextEditing
        onExitCanvasTextEditing={onExitCanvasTextEditing}
      />
    );

    fireEvent.keyDown(window, {
      code: 'Digit6',
      altKey: true,
    });

    expect(onExitCanvasTextEditing).not.toHaveBeenCalled();
    expect(screen.queryByRole('tablist', { name: 'Color palettes' })).not.toBeInTheDocument();
  });

  it('shows Hand first in structured mode', () => {
    useEditorStore.setState({ canvasMode: 'structured', tool: 'select' });
    const { container } = render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    const items = container.querySelectorAll('[data-toolbar-item]');
    expect(items[0]).toHaveAttribute('data-toolbar-item', 'pan');
  });

  it('uses the active accent state for Hand', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'pan' });
    const { container } = render(<Toolbar tool="pan" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(container.querySelector('[data-toolbar-item="pan"]')).toHaveClass(
      'bg-accent',
      'text-foreground'
    );
  });

  it('hides brush and eraser in freeform mode', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Box' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paint Char Color' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Color' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Brush/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eraser' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fill Area' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('returns hidden freeform brush tool state to select', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'brush' });
    const setTool = vi.fn();

    render(<Toolbar tool="brush" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith('select');
  });

  it('returns hidden freeform eraser tool state to select', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'eraser' });
    const setTool = vi.fn();

    render(<Toolbar tool="eraser" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith('select');
  });

  it('activates background from the first-level freeform dock', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    const setTool = vi.fn();

    render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));

    expect(setTool).toHaveBeenCalledWith('bg');
  });

  it('keeps background separate from the shape group active label', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'bg' });

    render(<Toolbar tool="bg" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Box' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background' })).toBeInTheDocument();
  });

  it('uses the top bar surface and accent background for the active tool', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });

    const { container } = render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);
    const toolbar = screen.getByRole('toolbar');
    const activeItem = container.querySelector('[data-toolbar-item="select"]');
    const inactiveItem = container.querySelector('[data-toolbar-item="shape-group"]');
    const inactiveButtons = inactiveItem?.querySelectorAll('button') ?? [];

    expect(screen.getByTestId('tool-dock')).toBe(toolbar.parentElement);
    expect(toolbar.parentElement).toHaveClass(
      'bg-host-surface',
      'rounded-lg',
      'border-0',
      'shadow-host'
    );
    expect(activeItem).toHaveClass('bg-accent', 'text-foreground');
    expect(inactiveItem).not.toHaveClass('bg-accent');
    expect(inactiveItem).toHaveClass(
      'has-[[data-toolbar-submenu-trigger]:hover]:bg-accent',
      'has-[[data-toolbar-submenu-trigger]:hover]:text-foreground'
    );
    expect(inactiveButtons[0]).toHaveClass(
      'size-8',
      'rounded-r-none',
      'focus-visible:ring-[3px]',
      'hover:bg-accent',
      'hover:text-accent-foreground'
    );
    expect(inactiveButtons[1]).toHaveClass(
      'size-8',
      'rounded-l-none',
      'focus-visible:ring-[3px]',
      'hover:bg-accent',
      'hover:text-accent-foreground'
    );
    expect(inactiveButtons[1]).toHaveAttribute('data-toolbar-submenu-trigger', 'true');
    expect(inactiveButtons[1]).not.toHaveClass(
      'border-l',
      'border-transparent',
      'hover:border-border'
    );
    expect(toolbar.querySelector('[style*="translateX"]')).not.toBeInTheDocument();
  });

  it('uses dropdown menu semantics and styling for shape submenus', async () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'select' });
    const setTool = vi.fn();

    const { container } = render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);
    const shapeItem = container.querySelector('[data-toolbar-item="shape-group"]');
    const shapeButtons = shapeItem?.querySelectorAll('button') ?? [];

    fireEvent.pointerDown(shapeButtons[1], { button: 0, ctrlKey: false });
    const circle = await screen.findByRole('menuitemradio', {
      name: 'Circle',
    });

    expect(shapeItem).toHaveClass('bg-accent', 'text-foreground');
    const shapeMenu = document.querySelector('[data-slot="dropdown-menu-content"]');
    expect(shapeMenu).toHaveClass(
      'min-w-40',
      'bg-overlay-surface',
      'border-0',
      'shadow-overlay',
      'rounded-lg'
    );
    expect(shapeMenu).not.toHaveClass('min-w-48');
    fireEvent.click(circle);
    expect(setTool).toHaveBeenCalledWith('circle');
    await waitFor(() =>
      expect(document.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument()
    );
  });

  it('offers arrow lines only in the structured shape menu', async () => {
    useEditorStore.setState({ canvasMode: 'structured', tool: 'select' });
    const setTool = vi.fn();
    const { container } = render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);
    const shapeItem = container.querySelector('[data-toolbar-item="shape-group"]');
    const shapeButtons = shapeItem?.querySelectorAll('button') ?? [];

    fireEvent.pointerDown(shapeButtons[1], { button: 0, ctrlKey: false });
    const arrowLine = await screen.findByRole('menuitemradio', {
      name: 'Arrow line',
    });
    expect(screen.queryByRole('menuitemradio', { name: 'Circle' })).not.toBeInTheDocument();

    fireEvent.click(arrowLine);
    expect(setTool).toHaveBeenCalledWith('arrowLine');
  });

  it('activates arrow lines through the real editor store', async () => {
    useEditorStore.setState({ canvasMode: 'structured', tool: 'select' });
    const { container } = render(<StoreToolbar />);
    const shapeItem = container.querySelector('[data-toolbar-item="shape-group"]');
    const shapeButtons = shapeItem?.querySelectorAll('button') ?? [];

    fireEvent.pointerDown(shapeButtons[1], { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Arrow line' }));

    expect(useEditorStore.getState().tool).toBe('arrowLine');
  });

  it('returns a structured-only arrow line tool to select in freeform', () => {
    useEditorStore.setState({ canvasMode: 'freeform', tool: 'arrowLine' });
    const setTool = vi.fn();

    render(<Toolbar tool="arrowLine" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith('select');
  });

  it('hides the explicit text tool in structured mode', () => {
    useEditorStore.setState({ canvasMode: 'structured', tool: 'select' });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Box' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Color' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Text' })).not.toBeInTheDocument();
  });

  it('returns hidden structured text tool state to select', () => {
    useEditorStore.setState({ canvasMode: 'structured', tool: 'text' });
    const setTool = vi.fn();

    render(<Toolbar tool="text" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith('select');
  });

  it('switches between ansi 16 and preset color tabs', () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);

    expect(screen.getByRole('tab', { name: 'ANSI 16' })).toHaveAttribute('aria-selected', 'true');
    const paletteTabs = screen.getByRole('tablist', {
      name: 'Color palettes',
    });
    expect(paletteTabs).toHaveAttribute('data-orientation', 'horizontal');
    expect(paletteTabs).toHaveClass('w-fit', 'flex-row', 'gap-1');
    const ansiTab = screen.getByRole('tab', { name: 'ANSI 16' });
    expect(ansiTab).toHaveClass(
      'size-8',
      'rounded-lg',
      'flex-none',
      'justify-center',
      'hover:bg-accent',
      'hover:text-accent-foreground',
      'focus-visible:ring-[3px]',
      'focus-visible:border-transparent',
      'focus-visible:outline-0',
      'focus-visible:outline-transparent',
      'focus-visible:outline-none',
      'group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none'
    );
    expect(ansiTab).not.toHaveClass('min-w-8');
    expect(ansiTab.querySelector('svg')).toBeInTheDocument();
    const pickerPanel = paletteTabs.closest('[data-color-picker-panel="true"]');
    expect(pickerPanel).toHaveClass('w-40', 'gap-2', 'px-1');
    const pickerHeader = screen.getByTestId('color-picker-header');
    expect(pickerHeader).toContainElement(paletteTabs);
    const contentFrame = screen.getByTestId('color-picker-content-frame');
    expect(
      paletteTabs.compareDocumentPosition(contentFrame) & Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(contentFrame).toHaveClass('w-full', 'min-w-0');
    expect(contentFrame).not.toHaveClass('h-[8.875rem]', 'h-[6.375rem]');

    expect(screen.getByRole('tab', { name: 'ANSI 16' })).toHaveClass(
      'bg-accent',
      'text-foreground'
    );
    expect(screen.getByRole('tab', { name: 'Presets' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('Hex')).not.toBeInTheDocument();

    const activeColorView = screen.getByRole('tabpanel');
    const colorValueTrigger = screen.getByRole('button', { name: 'Hex: #000000' });
    expect(pickerHeader).toContainElement(colorValueTrigger);
    expect(activeColorView).not.toContainElement(colorValueTrigger);
    expect(screen.getByTestId('color-value-icon')).toHaveClass('size-4', 'rounded-full');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(activeColorView).toContainElement(screen.getByTestId('color-palette-grid'));

    const eyedropperTrigger = screen.getByRole('button', {
      name: 'Pick color from canvas',
    });
    const headerActions = screen.getByTestId('color-picker-header-actions');
    expect(headerActions).toContainElement(colorValueTrigger);
    expect(headerActions).toContainElement(eyedropperTrigger);
    expect(pickerHeader).toContainElement(eyedropperTrigger);

    fireEvent.click(colorValueTrigger);
    const hexInput = screen.getByRole('textbox', { name: 'Hex' });
    expect(hexInput).toHaveFocus();
    const visualColorPicker = screen.getByTestId('visual-color-picker');
    expect(visualColorPicker).toBeInTheDocument();
    expect(visualColorPicker.closest('[data-slot="popover-content"]')).toHaveAttribute(
      'data-side',
      'right'
    );
    expect(visualColorPicker.closest('[data-slot="popover-content"]')).toHaveAttribute(
      'data-align',
      'start'
    );
    expect(screen.getByRole('slider', { name: 'Color' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Hue' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Alpha' })).not.toBeInTheDocument();
    expect(hexInput).toHaveClass(
      'bg-search-surface',
      'border-0',
      'shadow-none',
      'focus-visible:ring-1'
    );
    expect(hexInput).not.toHaveClass('bg-muted/40');
    expect(screen.queryByRole('button', { name: 'Use' })).not.toBeInTheDocument();

    fireEvent.keyDown(hexInput, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pick ANSI color #c0c0c0' }));
    expect(onPick).toHaveBeenCalledWith('#c0c0c0');

    fireEvent.click(screen.getByRole('button', { name: 'Pick ANSI color #000080' }));
    expect(onPick).toHaveBeenCalledWith('#000080');
    expect(screen.getByTestId('color-palette-grid')).toHaveClass(
      'grid-cols-4',
      'justify-items-center',
      'gap-y-1'
    );
    const ansiColor = screen.getByRole('button', { name: 'Pick ANSI color #000080' });
    expect(ansiColor).toHaveClass('size-6', 'rounded-full', 'cursor-pointer');
    expect(ansiColor).not.toHaveClass(
      'transition-transform',
      'hover:scale-110',
      'active:scale-95'
    );
    expect(ansiColor.firstElementChild).toHaveClass('size-[18px]', 'rounded-full');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Presets' }), {
      button: 0,
    });

    expect(screen.getByRole('tab', { name: 'ANSI 16' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Presets' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Presets' })).toHaveClass(
      'bg-accent',
      'text-foreground'
    );
    expect(contentFrame).not.toHaveClass('h-[8.875rem]', 'h-[6.375rem]');
    expect(screen.getByTestId('color-palette-grid')).toHaveClass(
      'grid-cols-5',
      'justify-items-center',
      'gap-y-1'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pick preset color #7f1d1d' }));
    expect(onPick).toHaveBeenCalledWith('#7f1d1d');
    fireEvent.click(screen.getByRole('button', { name: 'Pick preset color #93c5fd' }));
    expect(onPick).toHaveBeenCalledWith('#93c5fd');
  });

  it('normalizes short hex colors before picking with Enter', () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hex: #000000' }));
    const input = screen.getByRole('textbox', { name: 'Hex' });
    fireEvent.change(input, {
      target: { value: '#0fc' },
    });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onPick).toHaveBeenCalledWith('#00ffcc');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hex: #00ffcc' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use' })).not.toBeInTheDocument();
  });

  it('keeps visual color changes local until the value popover is closed', async () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#ff0000" onPick={onPick} />);
    const colorValueTrigger = screen.getByRole('button', { name: 'Hex: #ff0000' });
    fireEvent.click(colorValueTrigger);

    const colorSlider = screen.getByRole('slider', { name: 'Color' });
    fireEvent.keyDown(colorSlider, { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 });

    const input = screen.getByRole('textbox', { name: 'Hex' });
    await waitFor(() => expect(input).not.toHaveValue('#ff0000'));
    const draftColor = input.getAttribute('value');
    expect(draftColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(onPick).not.toHaveBeenCalled();

    fireEvent.click(colorValueTrigger);

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(draftColor);
    expect(screen.queryByTestId('visual-color-picker')).not.toBeInTheDocument();
  });

  it('rejects alpha-bearing hex values', () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hex: #000000' }));
    const input = screen.getByRole('textbox', { name: 'Hex' });
    expect(input).toHaveAttribute('maxlength', '7');

    fireEvent.change(input, { target: { value: '#11223344' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onPick).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Hex' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hex: #000000' })).toBeInTheDocument();
  });

  it('commits valid hex outside the panel and restores invalid input', () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hex: #000000' }));
    let input = screen.getByRole('textbox', { name: 'Hex' });
    fireEvent.change(input, { target: { value: '#123456' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(onPick).toHaveBeenCalledWith('#123456');
    expect(screen.getByRole('button', { name: 'Hex: #123456' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hex: #123456' }));
    input = screen.getByRole('textbox', { name: 'Hex' });
    fireEvent.change(input, { target: { value: '#invalid' } });
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hex: #000000' })).toBeInTheDocument();
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('cancels pending hex while focus moves within the picker', () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hex: #000000' }));
    const input = screen.getByRole('textbox', { name: 'Hex' });
    const eyedropperTrigger = screen.getByRole('button', {
      name: 'Pick color from canvas',
    });
    fireEvent.change(input, { target: { value: '#123456' } });
    fireEvent.blur(input, { relatedTarget: eyedropperTrigger });

    expect(onPick).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hex: #000000' })).toBeInTheDocument();
  });

  it('closes only the hex popover when Escape is pressed inside the dock color popover', async () => {
    useEditorStore.setState({ canvasMode: 'structured', tool: 'select' });
    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Color options' }));
    expect(
      await screen.findByRole('tablist', { name: 'Color palettes' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Hex:/ }));
    const input = screen.getByRole('textbox', { name: 'Hex' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('textbox', { name: 'Hex' })).not.toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Color palettes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Color options' })).toHaveAttribute(
      'data-state',
      'open'
    );
  });

  it('opens canvas color targets in a dropdown and retains the active target', async () => {
    render(<ColorPickerPanel value="#000000" onPick={vi.fn()} />);

    const eyedropperTrigger = screen.getByRole('button', {
      name: 'Pick color from canvas',
    });
    fireEvent.pointerDown(eyedropperTrigger, { button: 0, ctrlKey: false });

    const pickChar = await screen.findByRole('menuitem', {
      name: 'Pick char color from canvas',
    });
    expect(pickChar.closest('[data-slot="dropdown-menu-content"]')).toHaveClass(
      'min-w-36',
      'bg-overlay-surface',
      'border-0',
      'shadow-overlay'
    );
    fireEvent.click(pickChar);

    await waitFor(() =>
      expect(
        screen.queryByRole('menuitem', {
          name: 'Pick char color from canvas',
        })
      ).not.toBeInTheDocument()
    );
    expect(eyedropperTrigger).toHaveAttribute('aria-pressed', 'true');
    expect(eyedropperTrigger).toHaveClass('bg-accent', 'text-foreground');

    fireEvent.pointerDown(eyedropperTrigger, { button: 0, ctrlKey: false });
    expect(
      await screen.findByRole('menuitem', {
        name: 'Pick char color from canvas',
      })
    ).toHaveClass('bg-accent', 'text-foreground');
  });

  it('hides hex and eyedropper tools in palette-only mode', () => {
    render(<ColorPickerPanel value="#000000" onPick={vi.fn()} showCustomInput={false} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Hex:/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pick color from canvas' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('color-picker-content-frame')).not.toHaveClass(
      'h-[8.875rem]',
      'h-[6.375rem]'
    );
    expect(screen.getByRole('tab', { name: 'ANSI 16' })).toBeInTheDocument();
  });
});
