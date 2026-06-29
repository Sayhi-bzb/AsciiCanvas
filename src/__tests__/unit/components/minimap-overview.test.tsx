import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Minimap } from "@/domains/canvas/components/AsciiCanvas/Minimap";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { GridManager } from "@/shared/utils/grid";

const createMockContext = () => ({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  setTransform: vi.fn(),
  strokeRect: vi.fn(),
  imageSmoothingEnabled: true,
});

describe("Minimap overview panel", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      createMockContext() as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts collapsed and expands into the overview panel", () => {
    render(<Minimap containerSize={{ width: 1000, height: 700 }} />);

    const toggle = screen.getByTestId("overview-panel-toggle");
    expect(toggle).toHaveAccessibleName("Open overview panel");
    expect(screen.queryByTestId("overview-panel")).toBeNull();

    fireEvent.click(toggle);

    const overviewCanvas = screen.getByLabelText("Canvas overview");
    expect(screen.getByTestId("overview-panel")).toBeInTheDocument();
    expect(overviewCanvas).toBeInTheDocument();
    expect(overviewCanvas).toHaveAttribute("width", "220");
    expect(overviewCanvas).toHaveAttribute("height", "220");
  });

  it("auto-collapses the overview panel on narrow containers", () => {
    const { rerender } = render(
      <Minimap containerSize={{ width: 1000, height: 700 }} />
    );

    fireEvent.click(screen.getByTestId("overview-panel-toggle"));
    expect(screen.getByTestId("overview-panel")).toBeInTheDocument();

    rerender(<Minimap containerSize={{ width: 820, height: 700 }} />);

    expect(screen.queryByTestId("overview-panel")).toBeNull();
    expect(screen.getByTestId("overview-panel-toggle")).toBeInTheDocument();
  });


  it("does not draw blank foreground-only cells as content", () => {
    const grid = new Map([
      [GridManager.toKey(0, 0), { char: " ", color: "#000000" }],
      [GridManager.toKey(1, 0), { char: " ", color: "#000000", bgColor: "#ffffff" }],
      [GridManager.toKey(2, 0), { char: "A", color: "#111111" }],
    ]);
    useCanvasStore.setState({ grid });

    const contexts: Array<ReturnType<typeof createMockContext>> = [];
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => {
      const context = createMockContext();
      contexts.push(context);
      return context as unknown as CanvasRenderingContext2D;
    });

    render(<Minimap containerSize={{ width: 1000, height: 700 }} />);
    fireEvent.click(screen.getByTestId("overview-panel-toggle"));

    const baseContext = contexts.find((context) =>
      context.strokeRect.mock.calls.some(
        ([x, y]) => x === 7.5 && y === 7.5
      )
    );

    expect(baseContext).toBeDefined();
    expect(baseContext?.fillRect).toHaveBeenCalledTimes(3);
  });
});

