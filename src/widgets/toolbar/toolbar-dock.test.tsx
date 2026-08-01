import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { Toolbar as ToolbarUnderTest } from "@/widgets/toolbar/dock";
import { ColorPickerPanel } from "@/widgets/toolbar/dock/submenus";
import { useEditorStore } from "@/domains/canvas/public";
import { setUiLanguage } from "@/shared/i18n";
import { ShortcutProvider } from "@/shared/shortcuts/dispatcher";

vi.mock("@/shared/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

type TestToolbarProps = Omit<
  ComponentProps<typeof ToolbarUnderTest>,
  "isCanvasTextEditing" | "onExitCanvasTextEditing"
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

describe("Toolbar dock", () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    act(() => setUiLanguage("en"));
    useEditorStore.setState(initialState, true);
  });

  it("shows Hand first in freeform and selects it persistently", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });
    const setTool = vi.fn();
    const { container } = render(
      <Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />
    );

    const items = container.querySelectorAll("[data-toolbar-item]");
    expect(items[0]).toHaveAttribute("data-toolbar-item", "pan");
    fireEvent.click(screen.getByRole("button", { name: "Hand" }));
    expect(setTool).toHaveBeenCalledWith("pan");
  });

  it("maps Alt+digits to the visible freeform dock order", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });
    const setTool = vi.fn();
    render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);

    fireEvent.keyDown(window, {
      key: "¡",
      code: "Digit1",
      altKey: true,
    });
    fireEvent.keyDown(window, {
      key: "£",
      code: "Digit3",
      altKey: true,
    });

    expect(setTool).toHaveBeenNthCalledWith(1, "pan");
    expect(setTool).toHaveBeenNthCalledWith(2, "box");
    expect(screen.getByRole("button", { name: "Hand" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Alt+1"
    );
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Alt+2"
    );
  });

  it("maps Alt+digits to animation tools and opens the color popover", async () => {
    useEditorStore.setState({ canvasMode: "animation", tool: "select" });
    const setTool = vi.fn();
    render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);

    fireEvent.keyDown(window, {
      key: "™",
      code: "Digit2",
      altKey: true,
    });
    expect(setTool).toHaveBeenCalledWith("brush");

    fireEvent.keyDown(window, {
      key: "§",
      code: "Digit6",
      altKey: true,
    });
    expect(
      await screen.findByRole("tablist", { name: "Color palettes" })
    ).toBeInTheDocument();
  });

  it("exits canvas text editing before using a Dock shortcut", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });
    const setTool = vi.fn();
    const onExitCanvasTextEditing = vi.fn();
    const input = document.createElement("input");
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
      code: "Digit1",
      altKey: true,
    });
    expect(onExitCanvasTextEditing).toHaveBeenCalledOnce();
    expect(setTool).toHaveBeenCalledWith("pan");
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
      code: "Digit1",
      altKey: true,
    });
    expect(setTool).toHaveBeenCalledTimes(1);
    expect(onExitCanvasTextEditing).toHaveBeenCalledOnce();
    input.remove();
  });

  it("exits canvas text editing before opening the color popover", async () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });
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
      code: "Digit6",
      altKey: true,
    });

    expect(onExitCanvasTextEditing).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("tablist", { name: "Color palettes" })
    ).toBeInTheDocument();
  });

  it("shows Hand first in structured mode", () => {
    useEditorStore.setState({ canvasMode: "structured", tool: "select" });
    const { container } = render(
      <Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />
    );

    const items = container.querySelectorAll("[data-toolbar-item]");
    expect(items[0]).toHaveAttribute("data-toolbar-item", "pan");
  });

  it("uses the active accent state for Hand", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "pan" });
    const { container } = render(
      <Toolbar tool="pan" setTool={vi.fn()} onUndo={vi.fn()} />
    );

    expect(container.querySelector('[data-toolbar-item="pan"]')).toHaveClass(
      "bg-accent",
      "text-foreground"
    );
  });

  it("returns Hand to select and hides it in animation mode", () => {
    useEditorStore.setState({ canvasMode: "animation", tool: "pan" });
    const setTool = vi.fn();
    render(<Toolbar tool="pan" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith("select");
    expect(
      screen.queryByRole("button", { name: "Hand" })
    ).not.toBeInTheDocument();
  });

  it("hides brush and eraser in freeform mode", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Box" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Background" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Paint Char Color" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Brush/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Eraser" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Fill Area" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument();
  });

  it("returns hidden freeform brush tool state to select", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "brush" });
    const setTool = vi.fn();

    render(<Toolbar tool="brush" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith("select");
  });

  it("returns hidden freeform eraser tool state to select", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "eraser" });
    const setTool = vi.fn();

    render(<Toolbar tool="eraser" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith("select");
  });

  it("activates background from the first-level freeform dock", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });
    const setTool = vi.fn();

    render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Background" }));

    expect(setTool).toHaveBeenCalledWith("bg");
  });

  it("keeps background separate from the shape group active label", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "bg" });

    render(<Toolbar tool="bg" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Box" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Background" })
    ).toBeInTheDocument();
  });

  it("uses the top bar surface and accent background for the active tool", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });

    const { container } = render(
      <Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />
    );
    const toolbar = screen.getByRole("toolbar");
    const activeItem = container.querySelector('[data-toolbar-item="select"]');
    const inactiveItem = container.querySelector(
      '[data-toolbar-item="shape-group"]'
    );
    const inactiveButtons = inactiveItem?.querySelectorAll("button") ?? [];

    expect(screen.getByTestId("tool-dock")).toBe(toolbar.parentElement);
    expect(toolbar.parentElement).toHaveClass(
      "bg-host-surface",
      "rounded-lg",
      "border-0",
      "shadow-host"
    );
    expect(activeItem).toHaveClass("bg-accent", "text-foreground");
    expect(inactiveItem).not.toHaveClass("bg-accent");
    expect(inactiveItem).toHaveClass(
      "has-[[data-toolbar-submenu-trigger]:hover]:bg-accent",
      "has-[[data-toolbar-submenu-trigger]:hover]:text-foreground"
    );
    expect(inactiveButtons[0]).toHaveClass(
      "size-8",
      "rounded-r-none",
      "focus-visible:ring-[3px]",
      "hover:bg-accent",
      "hover:text-accent-foreground"
    );
    expect(inactiveButtons[1]).toHaveClass(
      "size-8",
      "rounded-l-none",
      "focus-visible:ring-[3px]",
      "hover:bg-accent",
      "hover:text-accent-foreground"
    );
    expect(inactiveButtons[1]).toHaveAttribute(
      "data-toolbar-submenu-trigger",
      "true"
    );
    expect(inactiveButtons[1]).not.toHaveClass(
      "border-l",
      "border-transparent",
      "hover:border-border"
    );
    expect(
      toolbar.querySelector('[style*="translateX"]')
    ).not.toBeInTheDocument();
  });

  it("uses dropdown menu semantics and styling for shape submenus", async () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });
    const setTool = vi.fn();

    const { container } = render(
      <Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />
    );
    const shapeItem = container.querySelector(
      '[data-toolbar-item="shape-group"]'
    );
    const shapeButtons = shapeItem?.querySelectorAll("button") ?? [];

    fireEvent.pointerDown(shapeButtons[1], { button: 0, ctrlKey: false });
    const circle = await screen.findByRole("menuitemradio", {
      name: "Circle",
    });

    expect(shapeItem).toHaveClass("bg-accent", "text-foreground");
    expect(
      document.querySelector('[data-slot="dropdown-menu-content"]')
    ).toHaveClass(
      "min-w-48",
      "bg-overlay-surface",
      "border-0",
      "shadow-overlay",
      "rounded-lg"
    );
    fireEvent.click(circle);
    expect(setTool).toHaveBeenCalledWith("circle");
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="dropdown-menu-content"]')
      ).not.toBeInTheDocument()
    );
  });

  it("keeps custom brush input open and closes after preset selection", async () => {
    useEditorStore.setState({
      canvasMode: "animation",
      tool: "select",
      brushChar: "#",
    });
    const setTool = vi.fn();
    const { container } = render(
      <Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />
    );
    const brushItem = container.querySelector('[data-toolbar-item="brush"]');
    const brushButtons = brushItem?.querySelectorAll("button") ?? [];

    fireEvent.pointerDown(brushButtons[1], { button: 0, ctrlKey: false });
    const customInput = await screen.findByRole("textbox");
    fireEvent.change(customInput, { target: { value: "A" } });

    expect(useEditorStore.getState().brushChar).toBe("A");
    expect(
      document.querySelector('[data-slot="dropdown-menu-content"]')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio", { name: "*" }));
    expect(setTool).toHaveBeenCalledWith("brush");
    expect(useEditorStore.getState().brushChar).toBe("*");
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="dropdown-menu-content"]')
      ).not.toBeInTheDocument()
    );
  });

  it("uses accent backgrounds for active animation playback controls", () => {
    useEditorStore.setState({
      canvasMode: "animation",
      tool: "select",
      animationIsPlaying: true,
      animationTimeline: {
        frames: [{ id: "frame-1", name: "Frame 1", grid: [] }],
        currentFrameId: "frame-1",
        fps: 10,
        loop: true,
        onionSkin: {
          enabled: true,
          backwardLayers: 2,
          forwardLayers: 2,
          opacityFalloff: [0.5, 0.3, 0.1],
        },
      },
    });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Pause animation" })).toHaveClass(
      "size-8",
      "bg-accent",
      "text-foreground",
      "focus-visible:ring-[3px]"
    );
    expect(
      screen.getByRole("button", { name: "Toggle animation loop" })
    ).toHaveClass(
      "size-8",
      "bg-accent",
      "text-foreground",
      "focus-visible:ring-[3px]"
    );
  });

  it("localizes the Tool Dock and animation controls", () => {
    act(() => setUiLanguage("zh"));
    useEditorStore.setState({
      canvasMode: "animation",
      tool: "select",
      animationIsPlaying: false,
      animationTimeline: {
        frames: [{ id: "frame-1", name: "Frame 1", grid: [] }],
        currentFrameId: "frame-1",
        fps: 10,
        loop: false,
        onionSkin: {
          enabled: false,
          backwardLayers: 2,
          forwardLayers: 2,
          opacityFalloff: [0.5, 0.3, 0.1],
        },
      },
    });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("toolbar", { name: "画布工具" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一帧" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放动画" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一帧" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换动画循环" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "切换洋葱皮" })).toBeInTheDocument();
    expect(screen.getByText("洋葱皮")).toBeInTheDocument();
    expect(screen.getByText("FPS")).toBeInTheDocument();
  });

  it("does not show background in animation mode", () => {
    useEditorStore.setState({ canvasMode: "animation", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "Background" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument();
  });

  it("hides the explicit text tool in structured mode", () => {
    useEditorStore.setState({ canvasMode: "structured", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Box" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Background" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Text" })
    ).not.toBeInTheDocument();
  });

  it("returns hidden structured text tool state to select", () => {
    useEditorStore.setState({ canvasMode: "structured", tool: "text" });
    const setTool = vi.fn();

    render(<Toolbar tool="text" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith("select");
  });

  it("switches between ansi 16 and preset color tabs", () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);

    expect(screen.getByRole("tab", { name: "ANSI 16" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const paletteTabs = screen.getByRole("tablist", {
      name: "Color palettes",
    });
    expect(paletteTabs).toHaveAttribute("data-orientation", "vertical");
    expect(paletteTabs).toHaveClass("order-2", "w-fit", "flex-col", "gap-1");
    const ansiTab = screen.getByRole("tab", { name: "ANSI 16" });
    expect(ansiTab).toHaveClass(
      "size-8",
      "rounded-lg",
      "group-data-[orientation=vertical]/tabs:w-8",
      "group-data-[orientation=vertical]/tabs:justify-center",
      "hover:bg-accent",
      "hover:text-accent-foreground",
      "focus-visible:ring-[3px]",
      "focus-visible:border-transparent",
      "focus-visible:outline-0",
      "focus-visible:outline-transparent",
      "focus-visible:outline-none",
      "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none"
    );
    expect(ansiTab).not.toHaveClass("min-w-8");
    expect(ansiTab.querySelector("svg")).toBeInTheDocument();
    expect(paletteTabs.parentElement).toHaveClass(
      "w-[22rem]",
      "gap-1.5",
      "px-1"
    );
    const contentFrame = screen.getByTestId("color-picker-content-frame");
    expect(contentFrame).toHaveClass("order-1");
    expect(contentFrame).toHaveClass("h-[8.875rem]");
    expect(contentFrame).not.toHaveClass("h-[6.375rem]");

    expect(screen.getByRole("tab", { name: "ANSI 16" })).toHaveClass(
      "bg-accent",
      "text-foreground"
    );
    expect(screen.getByRole("tab", { name: "Presets" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.queryByText("Hex")).not.toBeInTheDocument();

    const activeColorView = screen.getByRole("tabpanel");
    expect(activeColorView).toContainElement(screen.getByRole("textbox"));
    expect(activeColorView).toContainElement(
      screen.getByRole("button", { name: "Pick color from canvas" })
    );
    expect(activeColorView).toContainElement(
      screen.getByTestId("color-palette-grid")
    );

    const colorTools = screen
      .getByRole("textbox")
      .closest('[data-color-picker-tools="true"]');
    const eyedropperTrigger = screen.getByRole("button", {
      name: "Pick color from canvas",
    });
    expect(colorTools).toHaveClass("flex", "items-center");
    expect(colorTools).toContainElement(eyedropperTrigger);

    fireEvent.click(
      screen.getByRole("button", { name: "Pick ANSI color #c0c0c0" })
    );
    expect(onPick).toHaveBeenCalledWith("#c0c0c0");

    fireEvent.click(
      screen.getByRole("button", { name: "Pick ANSI color #000080" })
    );
    expect(onPick).toHaveBeenCalledWith("#000080");
    expect(screen.getByTestId("color-palette-grid")).toHaveClass(
      "grid-cols-8",
      "gap-0.5"
    );

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Presets" }), {
      button: 0,
    });

    expect(screen.getByRole("tab", { name: "ANSI 16" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: "Presets" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Presets" })).toHaveClass(
      "bg-accent",
      "text-foreground"
    );
    expect(contentFrame).toHaveClass("h-[8.875rem]");
    expect(screen.getByTestId("color-palette-grid")).toHaveClass(
      "grid-cols-10",
      "gap-0.5"
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Pick preset color #7f1d1d" })
    );
    expect(onPick).toHaveBeenCalledWith("#7f1d1d");
    fireEvent.click(
      screen.getByRole("button", { name: "Pick preset color #93c5fd" })
    );
    expect(onPick).toHaveBeenCalledWith("#93c5fd");
  });

  it("normalizes short hex colors before picking", () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "#0fc" },
    });
    const useButton = screen.getByRole("button", { name: "Use" });
    expect(useButton).not.toHaveTextContent("Use");
    expect(useButton.querySelector("svg")).toBeInTheDocument();
    fireEvent.click(useButton);

    expect(onPick).toHaveBeenCalledWith("#00ffcc");
  });

  it("opens canvas color targets in a dropdown and retains the active target", async () => {
    render(<ColorPickerPanel value="#000000" onPick={vi.fn()} />);

    const eyedropperTrigger = screen.getByRole("button", {
      name: "Pick color from canvas",
    });
    fireEvent.pointerDown(eyedropperTrigger, { button: 0, ctrlKey: false });

    const pickChar = await screen.findByRole("menuitem", {
      name: "Pick char color from canvas",
    });
    expect(pickChar.closest('[data-slot="dropdown-menu-content"]')).toHaveClass(
      "min-w-36",
      "bg-overlay-surface",
      "border-0",
      "shadow-overlay"
    );
    fireEvent.click(pickChar);

    await waitFor(() =>
      expect(
        screen.queryByRole("menuitem", {
          name: "Pick char color from canvas",
        })
      ).not.toBeInTheDocument()
    );
    expect(eyedropperTrigger).toHaveAttribute("aria-pressed", "true");
    expect(eyedropperTrigger).toHaveClass("bg-accent", "text-foreground");

    fireEvent.pointerDown(eyedropperTrigger, { button: 0, ctrlKey: false });
    expect(
      await screen.findByRole("menuitem", {
        name: "Pick char color from canvas",
      })
    ).toHaveClass("bg-accent", "text-foreground");
  });

  it("hides hex and eyedropper tools in palette-only mode", () => {
    render(
      <ColorPickerPanel
        value="#000000"
        onPick={vi.fn()}
        showCustomInput={false}
      />
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pick color from canvas" })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("color-picker-content-frame")).toHaveClass(
      "h-[6.375rem]"
    );
    expect(screen.getByRole("tab", { name: "ANSI 16" })).toBeInTheDocument();
  });
});
