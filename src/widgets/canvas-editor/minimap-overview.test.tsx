import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Minimap } from "@/widgets/canvas-editor/Minimap";
import { useEditorStore } from "@/domains/canvas/public";
import { GridManager } from "@/shared/utils/grid";

const initialState = useEditorStore.getState();

const createMockContext = () => ({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  setTransform: vi.fn(),
  strokeRect: vi.fn(),
  imageSmoothingEnabled: true,
});

describe("Minimap canvas", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      createMockContext() as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders only the interactive minimap canvas", () => {
    useEditorStore.setState({
      grid: new Map([
        [GridManager.toKey(0, 0), { char: "A", color: "#ffffff" }],
        [GridManager.toKey(9, 9), { char: "B", color: "#ffffff" }],
      ]),
    });
    render(<Minimap containerSize={{ width: 1000, height: 700 }} />);

    const canvas = screen.getByLabelText("Canvas minimap");
    expect(canvas).toHaveAttribute("width", "108");
    expect(canvas).toHaveAttribute("height", "220");
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse overview panel" })
    ).not.toBeInTheDocument();
  });


  it("does not draw blank foreground-only cells as content", () => {
    const grid = new Map([
      [GridManager.toKey(0, 0), { char: " ", color: "#000000" }],
      [GridManager.toKey(1, 0), { char: " ", color: "#000000", bgColor: "#ffffff" }],
      [GridManager.toKey(2, 0), { char: "A", color: "#111111" }],
    ]);
    useEditorStore.setState({ grid });

    const contexts: Array<ReturnType<typeof createMockContext>> = [];
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => {
      const context = createMockContext();
      contexts.push(context);
      return context as unknown as CanvasRenderingContext2D;
    });

    render(<Minimap containerSize={{ width: 1000, height: 700 }} />);

    const baseContext = contexts.find(
      (context) => context.fillRect.mock.calls.length === 3
    );

    expect(baseContext).toBeDefined();
    expect(baseContext?.fillRect).toHaveBeenCalledTimes(3);
  });

  it("centers the clicked minimap position in the canvas container", () => {
    useEditorStore.setState({
      grid: new Map([
        [GridManager.toKey(0, 0), { char: "A", color: "#ffffff" }],
        [GridManager.toKey(9, 9), { char: "B", color: "#ffffff" }],
      ]),
      offset: { x: 0, y: 0 },
      zoom: 1,
    });

    render(<Minimap containerSize={{ width: 1000, height: 700 }} />);

    const canvas = screen.getByLabelText("Canvas minimap");
    const width = Number(canvas.getAttribute("width"));
    const height = Number(canvas.getAttribute("height"));
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    });
    fireEvent.click(canvas, { clientX: width / 2, clientY: height / 2 });

    expect(useEditorStore.getState().offset.x).toBeCloseTo(455);
    expect(useEditorStore.getState().offset.y).toBeCloseTo(255);
  });

  it("drags the viewport using canvas-pixel scale", () => {
    useEditorStore.setState({
      grid: new Map([
        [GridManager.toKey(0, 0), { char: "A", color: "#ffffff" }],
        [GridManager.toKey(199, 99), { char: "B", color: "#ffffff" }],
      ]),
      offset: { x: 0, y: 0 },
      zoom: 1,
    });

    render(<Minimap containerSize={{ width: 1000, height: 700 }} />);

    const canvas = screen.getByLabelText("Canvas minimap") as HTMLCanvasElement;
    const width = Number(canvas.getAttribute("width"));
    const height = Number(canvas.getAttribute("height"));
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    });
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => true);
    canvas.releasePointerCapture = vi.fn();

    const pointerDown = createEvent.pointerDown(canvas);
    Object.defineProperties(pointerDown, {
      button: { value: 0 },
      pointerId: { value: 1 },
      clientX: { value: 20 },
      clientY: { value: 20 },
    });
    fireEvent(canvas, pointerDown);

    const pointerMove = createEvent.pointerMove(canvas);
    Object.defineProperties(pointerMove, {
      pointerId: { value: 1 },
      clientX: { value: 30 },
      clientY: { value: 30 },
    });
    fireEvent(canvas, pointerMove);

    const expectedDelta = 10 / (212 / 1900);
    expect(useEditorStore.getState().offset.x).toBeCloseTo(-expectedDelta);
    expect(useEditorStore.getState().offset.y).toBeCloseTo(-expectedDelta);
  });
});

