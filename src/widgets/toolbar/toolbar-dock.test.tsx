import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Toolbar } from "@/widgets/toolbar/dock";
import { ColorPickerPanel } from "@/widgets/toolbar/dock/submenus";
import { useCanvasStore } from "@/domains/canvas/public";

vi.mock("@/shared/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

describe("Toolbar dock", () => {
  const initialState = useCanvasStore.getState();

  afterEach(() => {
    useCanvasStore.setState(initialState, true);
  });

  it("hides brush and eraser in freeform mode", () => {
    useCanvasStore.setState({ canvasMode: "freeform", tool: "select" });

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
    useCanvasStore.setState({ canvasMode: "freeform", tool: "brush" });
    const setTool = vi.fn();

    render(<Toolbar tool="brush" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith("select");
  });

  it("returns hidden freeform eraser tool state to select", () => {
    useCanvasStore.setState({ canvasMode: "freeform", tool: "eraser" });
    const setTool = vi.fn();

    render(<Toolbar tool="eraser" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith("select");
  });

  it("activates background from the first-level freeform dock", () => {
    useCanvasStore.setState({ canvasMode: "freeform", tool: "select" });
    const setTool = vi.fn();

    render(<Toolbar tool="select" setTool={setTool} onUndo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Background" }));

    expect(setTool).toHaveBeenCalledWith("bg");
  });

  it("keeps background separate from the shape group active label", () => {
    useCanvasStore.setState({ canvasMode: "freeform", tool: "bg" });

    render(<Toolbar tool="bg" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Box" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
  });

  it("uses the top bar surface and accent background for the active tool", () => {
    useCanvasStore.setState({ canvasMode: "freeform", tool: "select" });

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

  it("uses accent backgrounds for active animation playback controls", () => {
    useCanvasStore.setState({
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
    useCanvasStore.setState({ canvasMode: "animation", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Background" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("hides the explicit text tool in structured mode", () => {
    useCanvasStore.setState({ canvasMode: "structured", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Box" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
  });

  it("returns hidden structured text tool state to select", () => {
    useCanvasStore.setState({ canvasMode: "structured", tool: "text" });
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
    expect(screen.getByRole("tab", { name: "ANSI 16" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground"
    );
    expect(screen.getByRole("tab", { name: "Presets" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.queryByText("Hex")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #c0c0c0" }));
    expect(onPick).toHaveBeenCalledWith("#c0c0c0");

    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #000080" }));
    expect(onPick).toHaveBeenCalledWith("#000080");
    expect(screen.getByTestId("color-palette-grid")).toHaveClass("grid-cols-8");

    fireEvent.click(screen.getByRole("tab", { name: "Presets" }));

    expect(screen.getByRole("tab", { name: "ANSI 16" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: "Presets" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Presets" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground"
    );
    expect(screen.getByTestId("color-palette-grid")).toHaveClass("grid-cols-10");
    fireEvent.click(screen.getByRole("button", { name: "Pick preset color #7f1d1d" }));
    expect(onPick).toHaveBeenCalledWith("#7f1d1d");
    fireEvent.click(screen.getByRole("button", { name: "Pick preset color #93c5fd" }));
    expect(onPick).toHaveBeenCalledWith("#93c5fd");
  });

  it("normalizes short hex colors before picking", () => {
    const onPick = vi.fn();

    render(<ColorPickerPanel value="#000000" onPick={onPick} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "#0fc" } });
    fireEvent.click(screen.getByRole("button", { name: "Use" }));

    expect(onPick).toHaveBeenCalledWith("#00ffcc");
  });
});
