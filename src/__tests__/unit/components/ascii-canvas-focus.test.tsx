import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { AsciiCanvas } from "@/domains/canvas/components/AsciiCanvas";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { applyFreeformSnapshotToYMaps } from "@/domains/canvas/state/helpers/gridHelpers";
import {
  STRUCTURED_TEMPLATE_MIME,
  buildStructuredTemplateNodes,
  setActiveStructuredTemplateDragId,
} from "@/domains/canvas/state/helpers/structuredTemplates";

vi.mock("@/domains/canvas/components/AsciiCanvas/hooks/useCanvasRenderer", () => ({
  useCanvasRenderer: vi.fn(),
}));

const handleDoubleClickMock = vi.fn();

const stripNodeIds = <T extends { id: string }>(nodes: T[]) =>
  nodes.map(({ id: _id, ...node }) => node);

const waitForAnimationFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const fireDragOverAndFlush = async (
  root: HTMLElement,
  event: Event
) => {
  await act(async () => {
    fireEvent(root, event);
    await waitForAnimationFrame();
  });
};

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
    setActiveStructuredTemplateDragId(null);
    useCanvasStore.setState(initialState, true);
    applyFreeformSnapshotToYMaps([]);
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

  it("focuses the managed textarea for a freeform active cell and writes input there", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      textCursor: null,
      selections: [],
      grid: new Map(),
      staticGridSelection: {
        activeCell: { x: 4, y: 3 },
        anchorCell: { x: 4, y: 3 },
        ranges: [],
      },
      staticGridEditMode: "navigate",
    });

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);

    fireEvent.input(textarea!, { target: { value: "A" } });

    expect(useCanvasStore.getState().grid.get("4,3")).toMatchObject({
      char: "A",
    });
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 5, y: 3 });
  });

  it("does not steal focus from an external text input", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      textCursor: null,
      selections: [],
      staticGridSelection: {
        activeCell: { x: 2, y: 2 },
        anchorCell: { x: 2, y: 2 },
        ranges: [],
      },
      staticGridEditMode: "navigate",
    });
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    render(<AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />);

    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it("refocuses the managed textarea when the freeform input anchor changes", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      textCursor: null,
      selections: [],
      staticGridSelection: {
        activeCell: { x: 2, y: 2 },
        anchorCell: { x: 2, y: 2 },
        ranges: [],
      },
      staticGridEditMode: "navigate",
    });
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(input);

    input.blur();
    act(() => {
      useCanvasStore.getState().setTextCursor({ x: 6, y: 4 });
    });

    expect(document.activeElement).toBe(textarea);
    input.remove();
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

  it("renders structured layer actions behind a Layer context submenu", async () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: null,
      selections: [],
      selectedStructuredNodeIds: ["box-1"],
      selectedStructuredBoxId: "box-1",
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 4, y: 4 },
          style: { color: "#ffffff" },
        },
      ],
    });

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const root = container.firstElementChild as HTMLDivElement;

    fireEvent.contextMenu(root);

    expect(await screen.findByText("Layer")).toBeInTheDocument();
    expect(screen.queryByText("Bring Forward")).not.toBeInTheDocument();
    expect(screen.queryByText("Send Backward")).not.toBeInTheDocument();
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

  it("creates structured text from managed textarea input at structured grid focus", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      textCursor: null,
      selections: [],
      selectedStructuredNodeIds: [],
      structuredScene: [],
      structuredGridFocus: { x: 3, y: 4 },
      brushColor: "#123456",
    });

    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(document.activeElement).toBe(textarea);

    fireEvent.input(textarea!, { target: { value: "Go" } });

    const state = useCanvasStore.getState();
    expect(state.structuredScene).toHaveLength(1);
    expect(state.structuredScene[0]).toMatchObject({
      type: "text",
      position: { x: 3, y: 4 },
      text: "Go",
      style: { color: "#123456" },
    });
    expect(state.structuredGridFocus).toBeNull();
    expect(state.textCursor).toEqual({ x: 5, y: 4 });
  });

  it("drops a structured button template onto the canvas", async () => {
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

    await fireDragOverAndFlush(root, dragOverEvent);

    const preview = screen.getByTestId("structured-template-preview");
    expect(preview).toHaveStyle({
      left: "18px",
      top: "38px",
      width: "72px",
      height: "19px",
    });
    expect(preview.style.backgroundColor).toBe("");
    const previewGrid = preview.querySelector(
      '[data-testid="structured-template-preview-grid"]'
    );
    expect(previewGrid?.tagName).toBe("CANVAS");
    expect(previewGrid).toHaveStyle({ width: "72px", height: "19px" });

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
      style: { color: "#000000", bgColor: "#dbeafe" },
    });
    expect(state.structuredScene[1]).toMatchObject({
      type: "text",
      position: { x: 2, y: 2 },
      text: "[BUTTON]",
      style: { color: "#000000" },
    });
    expect(state.selectedStructuredNodeIds).toEqual(
      state.structuredScene.map((node) => node.id)
    );
    expect(state.structuredGridFocus).toBeNull();
  });

  it("drops a structured badge template onto the canvas", async () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      brushColor: "#334155",
      structuredScene: [],
      selectedStructuredNodeIds: [],
    });

    const dataTransfer = {
      types: [STRUCTURED_TEMPLATE_MIME],
      dropEffect: "none",
      getData: vi.fn((type: string) =>
        type === STRUCTURED_TEMPLATE_MIME ? "badge" : ""
      ),
    };
    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const root = container.firstElementChild as HTMLDivElement;
    const dragOverEvent = createEvent.dragOver(root);
    Object.defineProperties(dragOverEvent, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 27 },
      clientY: { value: 57 },
    });
    const dropEvent = createEvent.drop(root);
    Object.defineProperties(dropEvent, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 27 },
      clientY: { value: 57 },
    });

    await fireDragOverAndFlush(root, dragOverEvent);

    const preview = screen.getByTestId("structured-template-preview");
    expect(preview).toHaveStyle({
      left: "27px",
      top: "57px",
    });
    expect(preview.style.backgroundColor).toBe("");
    const previewGrid = preview.querySelector(
      '[data-testid="structured-template-preview-grid"]'
    );
    expect(previewGrid?.tagName).toBe("CANVAS");

    act(() => {
      fireEvent(root, dropEvent);
    });

    const state = useCanvasStore.getState();
    const expectedNodes = buildStructuredTemplateNodes(
      "badge",
      { x: 3, y: 3 },
      { brushColor: "#334155", startOrder: 1 }
    );
    expect(dataTransfer.dropEffect).toBe("copy");
    expect(screen.queryByTestId("structured-template-preview")).not.toBeInTheDocument();
    expect(stripNodeIds(state.structuredScene)).toEqual(
      stripNodeIds(expectedNodes)
    );
    expect(state.selectedStructuredNodeIds).toEqual(
      state.structuredScene.map((node) => node.id)
    );
  });

  it("drops a structured textarea template onto the canvas", async () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      brushColor: "#334155",
      structuredScene: [],
      selectedStructuredNodeIds: [],
    });

    const dataTransfer = {
      types: [STRUCTURED_TEMPLATE_MIME],
      dropEffect: "none",
      getData: vi.fn((type: string) =>
        type === STRUCTURED_TEMPLATE_MIME ? "textarea" : ""
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

    await fireDragOverAndFlush(root, dragOverEvent);

    const preview = screen.getByTestId("structured-template-preview");
    expect(preview).toHaveStyle({
      left: "18px",
      top: "38px",
      width: "162px",
      height: "95px",
    });
    const previewGrid = preview.querySelector(
      '[data-testid="structured-template-preview-grid"]'
    );
    expect(previewGrid?.tagName).toBe("CANVAS");
    expect(previewGrid).toHaveStyle({ width: "162px", height: "95px" });

    act(() => {
      fireEvent(root, dropEvent);
    });

    const state = useCanvasStore.getState();
    const expectedNodes = buildStructuredTemplateNodes(
      "textarea",
      { x: 2, y: 2 },
      { brushColor: "#000000", startOrder: 1 }
    );
    expect(dataTransfer.dropEffect).toBe("copy");
    expect(stripNodeIds(state.structuredScene)).toEqual(
      stripNodeIds(expectedNodes)
    );
    expect(state.selectedStructuredNodeIds).toEqual(
      state.structuredScene.map((node) => node.id)
    );
  });

  it("uses the active dragged template when dragover cannot read custom data", async () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      structuredScene: [],
      selectedStructuredNodeIds: [],
    });
    setActiveStructuredTemplateDragId("badge");

    const dataTransfer = {
      types: [STRUCTURED_TEMPLATE_MIME],
      dropEffect: "none",
      getData: vi.fn(() => ""),
    };
    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const root = container.firstElementChild as HTMLDivElement;
    const dragOverEvent = createEvent.dragOver(root);
    Object.defineProperties(dragOverEvent, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 36 },
      clientY: { value: 76 },
    });

    await fireDragOverAndFlush(root, dragOverEvent);

    const preview = screen.getByTestId("structured-template-preview");
    expect(preview).toHaveStyle({
      left: "36px",
      top: "76px",
      width: "81px",
      height: "19px",
    });
    expect(preview.style.backgroundColor).toBe("");
    const previewGrid = preview.querySelector(
      '[data-testid="structured-template-preview-grid"]'
    );
    expect(previewGrid?.tagName).toBe("CANVAS");
    expect(previewGrid).toHaveStyle({ width: "81px", height: "19px" });
  });

  it("coalesces structured template dragover previews to the latest frame position", async () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      structuredScene: [],
      selectedStructuredNodeIds: [],
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
    const firstDragOver = createEvent.dragOver(root);
    Object.defineProperties(firstDragOver, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 18 },
      clientY: { value: 38 },
    });
    const secondDragOver = createEvent.dragOver(root);
    Object.defineProperties(secondDragOver, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 54 },
      clientY: { value: 76 },
    });

    act(() => {
      fireEvent(root, firstDragOver);
      fireEvent(root, secondDragOver);
    });
    expect(screen.queryByTestId("structured-template-preview")).not.toBeInTheDocument();

    await act(async () => {
      await waitForAnimationFrame();
    });

    expect(screen.getByTestId("structured-template-preview")).toHaveStyle({
      left: "54px",
      top: "76px",
    });
  });

  it("drops at the latest dragover point even before the preview frame flushes", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      brushColor: "#334155",
      structuredScene: [],
      selectedStructuredNodeIds: [],
    });

    const dataTransfer = {
      types: [STRUCTURED_TEMPLATE_MIME],
      dropEffect: "none",
      getData: vi.fn((type: string) =>
        type === STRUCTURED_TEMPLATE_MIME ? "badge" : ""
      ),
    };
    const { container } = render(
      <AsciiCanvas onUndo={vi.fn()} onRedo={vi.fn()} />
    );
    const root = container.firstElementChild as HTMLDivElement;
    const dragOverEvent = createEvent.dragOver(root);
    Object.defineProperties(dragOverEvent, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 54 },
      clientY: { value: 76 },
    });
    const dropEvent = createEvent.drop(root);
    Object.defineProperties(dropEvent, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 18 },
      clientY: { value: 38 },
    });

    act(() => {
      fireEvent(root, dragOverEvent);
      fireEvent(root, dropEvent);
    });

    const state = useCanvasStore.getState();
    const expectedNodes = buildStructuredTemplateNodes(
      "badge",
      { x: 6, y: 4 },
      { brushColor: "#334155", startOrder: 1 }
    );
    expect(screen.queryByTestId("structured-template-preview")).not.toBeInTheDocument();
    expect(stripNodeIds(state.structuredScene)).toEqual(
      stripNodeIds(expectedNodes)
    );
  });
});
