import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { AsciiCanvas } from "@/domains/canvas/components/AsciiCanvas";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";

vi.mock("@/domains/canvas/components/AsciiCanvas/hooks/useCanvasRenderer", () => ({
  useCanvasRenderer: vi.fn(),
}));

const handleDoubleClickMock = vi.fn();

vi.mock("@/domains/canvas/components/AsciiCanvas/hooks/useCanvasInteraction", () => ({
  useCanvasInteraction: vi.fn(() => ({
    bind: {},
    draggingSelection: null,
    handleDoubleClick: handleDoubleClickMock,
  })),
}));

vi.mock("@/domains/canvas/components/AsciiCanvas/Minimap", () => ({
  Minimap: () => null,
}));

describe("AsciiCanvas focus management", () => {
  const initialState = useCanvasStore.getState();

  afterEach(() => {
    handleDoubleClickMock.mockClear();
    useCanvasStore.setState(initialState, true);
  });

  it("focuses the managed textarea immediately when a selection exists", () => {
    useCanvasStore.setState({
      selections: [
        {
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
        },
      ],
      textCursor: null,
      canvasMode: "freeform",
    });

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );

    const textarea = container.querySelector("textarea");

    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);
  });

  it("forwards root double clicks to the canvas interaction hook", () => {
    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );

    const root = container.firstElementChild;
    expect(root).toBeInstanceOf(HTMLDivElement);

    fireEvent.doubleClick(root!);

    expect(handleDoubleClickMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a selected structured box when Delete edits its active name", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: { x: 6, y: 2 },
      selectedStructuredNodeIds: ["box-1"],
      selectedStructuredBoxId: "box-1",
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 2 },
          end: { x: 12, y: 6 },
          name: "API",
          style: { color: "#ffffff" },
        },
      ],
    });

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    fireEvent.keyDown(textarea!, { key: "Delete" });

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      { id: "box-1", name: "AI" },
    ]);
    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual(["box-1"]);
  });
  it("pans the viewport for ctrl arrow keys without moving the static active cell", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      offset: { x: 0, y: 0 },
      textCursor: { x: 5, y: 5 },
      selections: [],
      staticGridSelection: {
        activeCell: { x: 5, y: 5 },
        anchorCell: { x: 5, y: 5 },
        ranges: [],
      },
      staticGridEditMode: "text-edit",
    });

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    fireEvent.keyDown(textarea!, { key: "ArrowLeft", ctrlKey: true });
    expect(useCanvasStore.getState().offset).toEqual({ x: 48, y: 0 });

    fireEvent.keyDown(textarea!, { key: "ArrowRight", ctrlKey: true });
    expect(useCanvasStore.getState().offset).toEqual({ x: 0, y: 0 });

    fireEvent.keyDown(textarea!, { key: "ArrowUp", ctrlKey: true });
    expect(useCanvasStore.getState().offset).toEqual({ x: 0, y: 48 });

    fireEvent.keyDown(textarea!, { key: "ArrowDown", ctrlKey: true });
    expect(useCanvasStore.getState().offset).toEqual({ x: 0, y: 0 });
    expect(useCanvasStore.getState().staticGridSelection.activeCell).toEqual({
      x: 5,
      y: 5,
    });
  });
});
