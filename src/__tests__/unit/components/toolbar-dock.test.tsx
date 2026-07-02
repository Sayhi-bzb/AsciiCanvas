import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Toolbar } from "@/domains/canvas/components/ToolBar/dock";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";

vi.mock("@/hooks/use-mobile", () => ({
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
    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fill Area" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Brush/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eraser" })).not.toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
  });

  it("does not show background in animation mode", () => {
    useCanvasStore.setState({ canvasMode: "animation", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Background" })).not.toBeInTheDocument();
  });

  it("hides the explicit text tool in structured mode", () => {
    useCanvasStore.setState({ canvasMode: "structured", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
  });

  it("returns hidden structured text tool state to select", () => {
    useCanvasStore.setState({ canvasMode: "structured", tool: "text" });
    const setTool = vi.fn();

    render(<Toolbar tool="text" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith("select");
  });
});
