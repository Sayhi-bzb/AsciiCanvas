import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("hides the explicit text tool in structured mode", () => {
    useCanvasStore.setState({ canvasMode: "structured", tool: "select" });

    render(<Toolbar tool="select" setTool={vi.fn()} onUndo={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
  });

  it("returns hidden structured text tool state to select", () => {
    useCanvasStore.setState({ canvasMode: "structured", tool: "text" });
    const setTool = vi.fn();

    render(<Toolbar tool="text" setTool={setTool} onUndo={vi.fn()} />);

    expect(setTool).toHaveBeenCalledWith("select");
  });
});
