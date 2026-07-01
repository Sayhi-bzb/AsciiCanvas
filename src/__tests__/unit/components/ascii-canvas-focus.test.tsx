import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { AsciiCanvas } from "@/domains/canvas/components/AsciiCanvas";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { STRUCTURED_TEMPLATE_MIME } from "@/domains/canvas/state/helpers/structuredTemplates";

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

  it("moves and clears structured grid focus from the managed textarea", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: null,
      selections: [],
      selectedStructuredNodeIds: [],
      structuredGridFocus: { x: 2, y: 3 },
    });

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);

    fireEvent.keyDown(textarea!, { key: "ArrowRight" });
    expect(useCanvasStore.getState().structuredGridFocus).toEqual({ x: 3, y: 3 });

    fireEvent.keyDown(textarea!, { key: "ArrowDown" });
    expect(useCanvasStore.getState().structuredGridFocus).toEqual({ x: 3, y: 4 });

    fireEvent.keyDown(textarea!, { key: "Escape" });
    expect(useCanvasStore.getState().structuredGridFocus).toBeNull();
  });

  it("drops a structured button template onto the canvas", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      brushColor: "#334155",
      structuredScene: [],
      selectedStructuredNodeIds: [],
      structuredGridFocus: { x: 1, y: 1 },
    });

    const dataTransfer = {
      types: [STRUCTURED_TEMPLATE_MIME],
      dropEffect: "none",
      getData: vi.fn((type: string) =>
        type === STRUCTURED_TEMPLATE_MIME ? "button" : ""
      ),
    };
    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const root = container.firstElementChild as HTMLDivElement;
    const dragOverEvent = createEvent.dragOver(root);
    Object.defineProperties(dragOverEvent, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 18 },
      clientY: { value: 38 },
    });
    const dropEvent = createEvent.drop(root);
    Object.defineProperties(dropEvent, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 18 },
      clientY: { value: 38 },
    });

    act(() => {
      fireEvent(root, dragOverEvent);
    });

    const preview = screen.getByTestId("structured-template-preview");
    expect(preview.textContent).toBe(" BUTTON ");
    expect(preview).toHaveStyle({
      left: "18px",
      top: "38px",
      width: "72px",
      height: "19px",
      background: "rgb(51, 65, 85)",
    });

    act(() => {
      fireEvent(root, dropEvent);
    });

    const state = useCanvasStore.getState();
    expect(dataTransfer.dropEffect).toBe("copy");
    expect(screen.queryByTestId("structured-template-preview")).not.toBeInTheDocument();
    expect(state.structuredScene).toHaveLength(2);
    expect(state.structuredScene[0]).toMatchObject({
      type: "bg",
      start: { x: 2, y: 2 },
      end: { x: 9, y: 2 },
      style: { bgColor: "#334155" },
    });
    expect(state.structuredScene[1]).toMatchObject({
      type: "text",
      position: { x: 3, y: 2 },
      text: "BUTTON",
    });
    expect(state.selectedStructuredNodeIds).toEqual(
      state.structuredScene.map((node) => node.id)
    );
    expect(state.structuredGridFocus).toBeNull();
  });
});
