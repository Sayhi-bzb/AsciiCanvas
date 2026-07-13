import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Toolbar } from "@/widgets/toolbar/dock";
import { ColorPickerPanel } from "@/widgets/toolbar/dock/submenus";
import { useEditorStore } from "@/domains/canvas/public";

vi.mock("@/shared/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

describe("Toolbar dock", () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("hides brush and eraser in freeform mode", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Box" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paint Char Color" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Brush/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eraser" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fill Area" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
  });

  it("uses the top bar surface and accent background for the active tool", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });

    const { container } = render(
      <Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />
    );
    const toolbar = screen.getByRole("toolbar");
    const activeItem = container.querySelector(
      '[data-toolbar-item="select"]'
    );
    const inactiveItem = container.querySelector(
      '[data-toolbar-item="shape-group"]'
    );

    expect(toolbar.parentElement).toHaveClass("bg-muted", "rounded-lg");
    expect(activeItem).toHaveClass("bg-accent", "text-foreground");
    expect(inactiveItem).not.toHaveClass("bg-accent");
    expect(toolbar.querySelector('[style*="translateX"]')).not.toBeInTheDocument();
  });

  it("uses a muted borderless surface for toolbar submenus", async () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });

    const { container } = render(
      <Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />
    );
    const shapeItem = container.querySelector(
      '[data-toolbar-item="shape-group"]'
    );
    const shapeButtons = shapeItem?.querySelectorAll("button") ?? [];

    fireEvent.click(shapeButtons[1]);
    await screen.findByText("Circle");

    expect(document.querySelector('[data-slot="popover-content"]')).toHaveClass(
      "bg-muted",
      "border-0",
      "shadow-none",
      "rounded-lg"
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
      "bg-accent",
      "text-foreground"
    );
    expect(screen.getByRole("button", { name: "Toggle animation loop" })).toHaveClass(
      "bg-accent",
      "text-foreground"
    );
  });

  it("does not show background in animation mode", () => {
    useEditorStore.setState({ canvasMode: "animation", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Background" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("hides the explicit text tool in structured mode", () => {
    useEditorStore.setState({ canvasMode: "structured", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Box" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
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
    expect(paletteTabs.parentElement).toHaveClass(
      "w-[22rem]",
      "gap-1.5",
      "px-1"
    );
    expect(screen.getByRole("tab", { name: "ANSI 16" })).toHaveClass(
      "data-[state=active]:bg-accent",
      "data-[state=active]:text-foreground"
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

    const colorTools = screen.getByRole("textbox").closest(
      '[data-color-picker-tools="true"]'
    );
    const eyedropperTrigger = screen.getByRole("button", {
      name: "Pick color from canvas",
    });
    expect(colorTools).toHaveClass("flex", "items-center");
    expect(colorTools).toContainElement(eyedropperTrigger);

    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #c0c0c0" }));
    expect(onPick).toHaveBeenCalledWith("#c0c0c0");

    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #000080" }));
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
      "data-[state=active]:bg-accent",
      "data-[state=active]:text-foreground"
    );
    expect(screen.getByTestId("color-palette-grid")).toHaveClass(
      "grid-cols-10",
      "gap-0.5"
    );
    fireEvent.click(screen.getByRole("button", { name: "Pick preset color #7f1d1d" }));
    expect(onPick).toHaveBeenCalledWith("#7f1d1d");
    fireEvent.click(screen.getByRole("button", { name: "Pick preset color #93c5fd" }));
    expect(onPick).toHaveBeenCalledWith("#93c5fd");
  });

  it("normalizes short hex colors before picking", () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "#0fc" } });
    const useButton = screen.getByRole("button", { name: "Use" });
    expect(useButton).not.toHaveTextContent("Use");
    expect(useButton.querySelector("svg")).toBeInTheDocument();
    fireEvent.click(useButton);

    expect(onPick).toHaveBeenCalledWith("#00ffcc");
  });

  it("opens canvas color targets in a borderless popover and retains the active target", () => {
    render(<ColorPickerPanel value="#000000" onPick={vi.fn()} />);

    const eyedropperTrigger = screen.getByRole("button", {
      name: "Pick color from canvas",
    });
    fireEvent.click(eyedropperTrigger);

    const pickChar = screen.getByRole("button", {
      name: "Pick char color from canvas",
    });
    expect(pickChar.closest('[data-slot="popover-content"]')).toHaveClass(
      "bg-muted",
      "border-0",
      "shadow-none"
    );
    fireEvent.click(pickChar);

    expect(
      screen.queryByRole("button", { name: "Pick char color from canvas" })
    ).not.toBeInTheDocument();
    expect(eyedropperTrigger).toHaveAttribute("aria-pressed", "true");
    expect(eyedropperTrigger).toHaveClass("bg-accent", "text-foreground");

    fireEvent.click(eyedropperTrigger);
    expect(
      screen.getByRole("button", { name: "Pick char color from canvas" })
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
    expect(screen.getByRole("tab", { name: "ANSI 16" })).toBeInTheDocument();
  });
});
