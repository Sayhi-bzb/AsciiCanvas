import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";

import { useCanvasInteraction } from "@/widgets/canvas-editor/hooks/useCanvasInteraction";
import type { StructuredMovePreview } from "@/widgets/canvas-editor/hooks/useCanvasRenderer";
import { useCanvasStore } from "@/domains/canvas/public";
import { runUndo } from "@/domains/actions/public";
import { useShallow } from "zustand/react/shallow";
import type { ToolType } from "@/shared/types";

const gestureState = vi.hoisted(() => ({
  handlers: null as Record<string, (input: unknown) => void> | null,
}));

vi.mock("@use-gesture/react", () => ({
  useGesture: vi.fn((handlers) => {
    gestureState.handlers = handlers;
    return {};
  }),
}));

function InteractionHarness() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const structuredMovePreviewRef = useRef<StructuredMovePreview | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const store = useCanvasStore(
    useShallow((state) => ({
      tool: state.tool,
      brushChar: state.brushChar,
      brushColor: state.brushColor,
      setBrushColor: state.setBrushColor,
      canvasColorPickerTarget: state.canvasColorPickerTarget,
      setCanvasColorPickerTarget: state.setCanvasColorPickerTarget,
      setOffset: state.setOffset,
      setZoom: state.setZoom,
      canvasMode: state.canvasMode,
      addScratchPoints: state.addScratchPoints,
      commitScratch: state.commitScratch,
      commitStructuredShape: state.commitStructuredShape,
      setTextCursor: state.setTextCursor,
      addSelection: state.addSelection,
      clearSelections: state.clearSelections,
      clearInteractionState: state.clearInteractionState,
      erasePoints: state.erasePoints,
      offset: state.offset,
      zoom: state.zoom,
      grid: state.grid,
      updateScratchForShape: state.updateScratchForShape,
      setHoveredGrid: state.setHoveredGrid,
      fillArea: state.fillArea,
      canvasBounds: state.canvasBounds,
      structuredScene: state.structuredScene,
      editingStructuredTextNodeId: state.editingStructuredTextNodeId,
      selectedStructuredNodeIds: state.selectedStructuredNodeIds,
      setStructuredGridFocus: state.setStructuredGridFocus,
      setStructuredContextPoint: state.setStructuredContextPoint,
      setSelectedStructuredNodeIds: state.setSelectedStructuredNodeIds,
      setSelectedStructuredSplitHandle: state.setSelectedStructuredSplitHandle,
      setEditingStructuredTextNodeId: state.setEditingStructuredTextNodeId,
      setStructuredTextSelection: state.setStructuredTextSelection,
      structuredTextSelection: state.structuredTextSelection,
      setStructuredTextColor: state.setStructuredTextColor,
      applyStructuredScene: state.applyStructuredScene,
      updateStructuredNode: state.updateStructuredNode,
    }))
  );
  const { handleDoubleClick } = useCanvasInteraction(
    store,
    containerRef,
    vi.fn(),
    structuredMovePreviewRef,
    requestRenderRef
  );

  return (
    <div
      ref={containerRef}
      data-testid="canvas-root"
      onDoubleClick={handleDoubleClick}
    />
  );
}

describe("structured text interaction", () => {
  const initialState = useCanvasStore.getState();

  afterEach(() => {
    gestureState.handlers = null;
    useCanvasStore.setState(initialState, true);
  });

  const setStructuredTextScene = (options?: { editing?: boolean }) => {
    useCanvasStore.setState({
      canvasMode: "structured",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      grid: new Map(),
      selections: [],
      textCursor: options?.editing ? { x: 0, y: 0 } : null,
      editingStructuredTextNodeId: options?.editing ? "text-1" : null,
      selectedStructuredNodeIds: options?.editing ? ["text-1"] : [],
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "Edit",
          style: { color: "#ffffff" },
        },
      ],
    });
  };

  const setStructuredMixedScene = () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      grid: new Map(),
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      selectedStructuredNodeIds: ["box-1", "text-1"],
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ffffff" },
        },
        {
          id: "text-1",
          type: "text",
          order: 2,
          position: { x: 5, y: 0 },
          text: "Node",
          style: { color: "#ffffff" },
        },
      ],
    });
  };

  const setStructuredMixedSceneWithHistory = () => {
    const scene = [
      {
        id: "box-1",
        type: "box" as const,
        order: 1,
        start: { x: 0, y: 0 },
        end: { x: 2, y: 2 },
        style: { color: "#ffffff" },
      },
      {
        id: "text-1",
        type: "text" as const,
        order: 2,
        position: { x: 5, y: 0 },
        text: "Node",
        style: { color: "#ffffff" },
      },
    ];
    useCanvasStore.setState({
      canvasMode: "structured",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      grid: new Map(),
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      selectedStructuredNodeIds: ["box-1", "text-1"],
    });
    useCanvasStore.getState().applyStructuredScene(scene, "reset");
    useCanvasStore.setState({
      selectedStructuredNodeIds: ["box-1", "text-1"],
    });
  };

  const setStructuredBgScene = (selected = false) => {
    useCanvasStore.setState({
      canvasMode: "structured",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      grid: new Map(),
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      selectedStructuredNodeIds: selected ? ["bg-1"] : [],
      structuredScene: [
        {
          id: "bg-1",
          type: "bg",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 4, y: 0 },
          style: { color: "#ffffff", bgColor: "#dbeafe" },
        },
      ],
    });
  };

  const setStructuredLineScene = (selected = false) => {
    useCanvasStore.setState({
      canvasMode: "structured",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      grid: new Map(),
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      selectedStructuredNodeIds: selected ? ["line-1"] : [],
      structuredScene: [
        {
          id: "line-1",
          type: "line",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 4, y: 0 },
          axis: "horizontal",
          style: { color: "#ffffff" },
        },
      ],
    });
  };

  const setStructuredSplitBoxScene = () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      grid: new Map(),
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      selectedStructuredNodeIds: [],
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      structuredScene: [
        {
          id: "split-1",
          type: "splitBox",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 9, y: 9 },
          verticalSplitRatio: 0.5,
          topSplitRatio: 0.25,
          bottomSplitRatio: 0.75,
          root: { type: "leaf", id: "root-leaf" },
          style: { color: "#ffffff" },
        },
      ],
    });
  };

  const dragEvent = (detail = 1) =>
    new MouseEvent("mousedown", {
      button: 0,
      bubbles: true,
      cancelable: true,
      detail,
    });

  it("enters text editing when double-clicking selected-mode structured text", () => {
    setStructuredTextScene();

    const { getByTestId } = render(<InteractionHarness />);

    fireEvent.doubleClick(getByTestId("canvas-root"), {
      clientX: 1,
      clientY: 1,
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([
      "text-1",
    ]);
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 0, y: 0 });
    expect(useCanvasStore.getState().editingStructuredTextNodeId).toBe(
      "text-1"
    );
    expect(useCanvasStore.getState().structuredTextSelection).toBeNull();
  });

  it("places the caret at the text end when double-clicking just after structured text", () => {
    setStructuredTextScene();

    const { getByTestId } = render(<InteractionHarness />);

    fireEvent.doubleClick(getByTestId("canvas-root"), {
      clientX: 45,
      clientY: 1,
    });
    useCanvasStore.getState().writeTextString("!");

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      text: "Edit!",
    });
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 5, y: 0 });
  });

  it("inserts text at the clicked middle offset while structured text is editing", () => {
    setStructuredTextScene({ editing: true });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [18, 1],
        event: dragEvent(),
      });
    });
    useCanvasStore.getState().writeTextString("!");

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      text: "Ed!it",
    });
    expect(useCanvasStore.getState().textCursor).toEqual({ x: 3, y: 0 });
  });

  it("keeps active text caret targeting above overlapping background nodes", () => {
    setStructuredTextScene({ editing: true });
    useCanvasStore.setState({
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 0, y: 0 },
          text: "Edit",
          style: { color: "#ffffff" },
        },
        {
          id: "bg-1",
          type: "bg",
          order: 2,
          start: { x: 0, y: 0 },
          end: { x: 6, y: 0 },
          style: { color: "#ffffff", bgColor: "#dbeafe" },
        },
      ],
    });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [18, 1],
        event: dragEvent(),
      });
    });
    useCanvasStore.getState().writeTextString("!");

    expect(useCanvasStore.getState().editingStructuredTextNodeId).toBe("text-1");
    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      text: "Ed!it",
    });
    expect(useCanvasStore.getState().structuredScene[1]).toMatchObject({
      id: "bg-1",
      start: { x: 0, y: 0 },
    });
  });

  it("keeps structured text editing when clicking just after the text end", () => {
    setStructuredTextScene({ editing: true });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [45, 1],
        event: dragEvent(),
      });
    });
    useCanvasStore.getState().writeTextString("!");

    expect(useCanvasStore.getState().editingStructuredTextNodeId).toBe("text-1");
    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      text: "Edit!",
    });
  });

  it("keeps active structured text editing from turning into a text-node drag", () => {
    setStructuredTextScene({ editing: true });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [1, 1],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [20, 1],
        delta: [19, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [20, 1],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [20, 1],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().textCursor).toEqual({ x: 2, y: 0 });
    expect(useCanvasStore.getState().editingStructuredTextNodeId).toBe(
      "text-1"
    );
    expect(useCanvasStore.getState().structuredTextSelection).toEqual({
      nodeId: "text-1",
      anchor: 0,
      focus: 2,
    });
    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      position: { x: 0, y: 0 },
    });
  });

  it("uses a text cursor when hovering the actively edited structured text", () => {
    setStructuredTextScene({ editing: true });
    const { getByTestId } = render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onMove?.({
        xy: [1, 1],
        event: new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
        }),
      });
    });

    expect(getByTestId("canvas-root").style.cursor).toBe("text");
  });

  it("uses a drawing cursor when hovering with structured shape tools", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      tool: "box",
      offset: { x: 0, y: 0 },
      zoom: 1,
      hoveredGrid: null,
    });
    const { getByTestId } = render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onMove?.({
        xy: [18, 57],
        event: new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
        }),
      });
    });

    expect(useCanvasStore.getState().hoveredGrid).toEqual({ x: 2, y: 3 });
    expect(getByTestId("canvas-root").style.cursor).toBe("crosshair");
  });

  it.each([
    ["box", "box"],
    ["splitBox", "splitBox"],
    ["line", "line"],
    ["bg", "bg"],
  ] as const)("creates a structured %s node by dragging", (tool, expectedType) => {
    useCanvasStore.setState({
      canvasMode: "structured",
      tool: tool as ToolType,
      offset: { x: 0, y: 0 },
      zoom: 1,
      brushColor: "#112233",
      grid: new Map(),
      structuredScene: [],
      selectedStructuredNodeIds: [],
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
    });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [9, 19],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [45, 57],
        delta: [36, 38],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [45, 57],
        event: dragEvent(),
      });
    });

    const state = useCanvasStore.getState();
    expect(state.structuredScene).toHaveLength(1);
    expect(state.structuredScene[0]).toMatchObject({
      type: expectedType,
      start: { x: 1, y: 1 },
      end: { x: 5, y: 3 },
    });
    expect(state.selectedStructuredNodeIds).toEqual([
      state.structuredScene[0].id,
    ]);
  });

  it("anchors the hovered cell while canvas color picking is active", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      canvasColorPickerTarget: "char",
      hoveredGrid: null,
    });
    const { getByTestId } = render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onMove?.({
        xy: [18, 57],
        event: new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
        }),
      });
    });

    expect(useCanvasStore.getState().hoveredGrid).toEqual({ x: 2, y: 3 });
    expect(getByTestId("canvas-root").style.cursor).toBe("crosshair");
  });

  it("picks char color from a visible canvas cell", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      brushColor: "#000000",
      canvasColorPickerTarget: "char",
      hoveredGrid: { x: 2, y: 3 },
      grid: new Map([
        ["2,3", { char: "A", color: "#112233", bgColor: "#445566" }],
      ]),
    });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [18, 57],
        event: dragEvent(),
      });
    });

    const state = useCanvasStore.getState();
    expect(state.brushColor).toBe("#112233");
    expect(state.canvasColorPickerTarget).toBeNull();
    expect(state.hoveredGrid).toBeNull();
  });

  it("picks background color from a blank canvas cell", () => {
    useCanvasStore.setState({
      canvasMode: "freeform",
      tool: "select",
      offset: { x: 0, y: 0 },
      zoom: 1,
      brushColor: "#000000",
      canvasColorPickerTarget: "bg",
      hoveredGrid: { x: 2, y: 3 },
      grid: new Map([
        ["2,3", { char: " ", color: "#112233", bgColor: "#445566" }],
      ]),
    });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [18, 57],
        event: dragEvent(),
      });
    });

    const state = useCanvasStore.getState();
    expect(state.brushColor).toBe("#445566");
    expect(state.canvasColorPickerTarget).toBeNull();
    expect(state.hoveredGrid).toBeNull();
  });

  it("activates a split box leaf focus from a left click", () => {
    setStructuredSplitBoxScene();
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [18, 39],
        event: dragEvent(),
      });
    });

    const state = useCanvasStore.getState();
    expect(state.selectedStructuredNodeIds).toEqual(["split-1"]);
    expect(state.structuredContextPoint).toEqual({ x: 2, y: 2 });
  });

  it("selects a split divider handle from a left click", () => {
    setStructuredSplitBoxScene();
    useCanvasStore.setState({
      structuredScene: [
        {
          id: "split-1",
          type: "splitBox",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 9, y: 9 },
          verticalSplitRatio: 0.5,
          topSplitRatio: 0.25,
          bottomSplitRatio: 0.75,
          root: {
            type: "split",
            id: "split-existing",
            axis: "vertical",
            ratio: 0.5,
            first: { type: "leaf", id: "left" },
            second: { type: "leaf", id: "right" },
          },
          style: { color: "#ffffff" },
        },
      ],
    });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [50, 39],
        event: dragEvent(),
      });
    });

    const state = useCanvasStore.getState();
    expect(state.selectedStructuredNodeIds).toEqual(["split-1"]);
    expect(state.selectedStructuredSplitHandle).toEqual({
      nodeId: "split-1",
      handle: "split:split-existing",
    });
    expect(state.structuredScene[0]).toMatchObject({
      type: "splitBox",
      root: { type: "split", id: "split-existing", ratio: 0.5 },
    });
  });

  it("resizes a split divider only after dragging away from the clicked cell", () => {
    setStructuredSplitBoxScene();
    useCanvasStore.setState({
      selectedStructuredNodeIds: ["split-1"],
      structuredScene: [
        {
          id: "split-1",
          type: "splitBox",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 9, y: 9 },
          verticalSplitRatio: 0.5,
          topSplitRatio: 0.25,
          bottomSplitRatio: 0.75,
          root: {
            type: "split",
            id: "split-existing",
            axis: "vertical",
            ratio: 0.5,
            first: { type: "leaf", id: "left" },
            second: { type: "leaf", id: "right" },
          },
          style: { color: "#ffffff" },
        },
      ],
    });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [50, 39],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [50, 39],
        delta: [0, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [50, 39],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      type: "splitBox",
      root: { type: "split", id: "split-existing", ratio: 0.5 },
    });

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [50, 39],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [68, 39],
        delta: [18, 0],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      type: "splitBox",
      root: { type: "split", id: "split-existing", ratio: 0.5 },
    });

    act(() => {
      gestureState.handlers?.onDragEnd?.({
        xy: [68, 39],
        event: dragEvent(),
      });
    });

    const node = useCanvasStore.getState().structuredScene[0];
    expect(node).toMatchObject({
      type: "splitBox",
      root: { type: "split", id: "split-existing" },
    });
    expect(node.type === "splitBox" && node.root?.type === "split" && node.root.ratio)
      .toBeGreaterThan(0.5);
    expect(useCanvasStore.getState().selectedStructuredSplitHandle).toEqual({
      nodeId: "split-1",
      handle: "split:split-existing",
    });
  });

  it("clears stale split box focus when left-clicking another structured node", () => {
    setStructuredMixedScene();
    useCanvasStore.setState({
      selectedStructuredNodeIds: [],
      structuredContextPoint: { x: 2, y: 2 },
    });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [1, 1],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([
      "box-1",
    ]);
    expect(useCanvasStore.getState().structuredContextPoint).toBeNull();
  });

  it("focuses an empty structured cell after a blank select click", () => {
    setStructuredTextScene();
    useCanvasStore.setState({
      selectedStructuredNodeIds: ["text-1"],
      structuredGridFocus: null,
    });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [50, 40],
        event: dragEvent(),
      });
    });
    act(() => {
      gestureState.handlers?.onDragEnd?.({
        xy: [50, 40],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([]);
    expect(useCanvasStore.getState().textCursor).toBeNull();
    expect(useCanvasStore.getState().structuredGridFocus).toEqual({ x: 5, y: 2 });
  });

  it("does not start moving text on the second press of a double-click", () => {
    setStructuredTextScene();
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [1, 1],
        event: dragEvent(2),
      });
      gestureState.handlers?.onDrag?.({
        xy: [20, 1],
        delta: [19, 0],
        event: dragEvent(2),
      });
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([
      "text-1",
    ]);
    expect(useCanvasStore.getState().editingStructuredTextNodeId).toBeNull();
    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      position: { x: 0, y: 0 },
    });
  });

  it("still drags structured text when it is not in text edit mode", () => {
    setStructuredTextScene();
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [1, 1],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [20, 1],
        delta: [19, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [20, 1],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().textCursor).toBeNull();
    expect(useCanvasStore.getState().editingStructuredTextNodeId).toBeNull();
    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      position: { x: 2, y: 0 },
    });
  });

  it("moves every selected structured node when dragging inside the selection", () => {
    setStructuredMixedScene();
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [11, 21],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [31, 21],
        delta: [20, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [31, 21],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [31, 21],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [31, 21],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([
      "box-1",
      "text-1",
    ]);
    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      {
        id: "box-1",
        start: { x: 2, y: 0 },
        end: { x: 4, y: 2 },
      },
      {
        id: "text-1",
        position: { x: 7, y: 0 },
      },
    ]);
  });

  it("undoes a structured multi-node drag as a single history step", () => {
    setStructuredMixedSceneWithHistory();
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [11, 21],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [31, 21],
        delta: [20, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [41, 21],
        delta: [10, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [41, 21],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      {
        id: "box-1",
        start: { x: 3, y: 0 },
        end: { x: 5, y: 2 },
      },
      {
        id: "text-1",
        position: { x: 8, y: 0 },
      },
    ]);

    act(() => {
      runUndo();
    });

    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      {
        id: "box-1",
        start: { x: 0, y: 0 },
        end: { x: 2, y: 2 },
      },
      {
        id: "text-1",
        position: { x: 5, y: 0 },
      },
    ]);
  });

  it("switches to single-node movement when dragging an unselected structured node", () => {
    setStructuredMixedScene();
    useCanvasStore.setState({ selectedStructuredNodeIds: ["text-1"] });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [11, 21],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [31, 21],
        delta: [20, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [31, 21],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([
      "box-1",
    ]);
    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      {
        id: "box-1",
        start: { x: 2, y: 0 },
        end: { x: 4, y: 2 },
      },
      {
        id: "text-1",
        position: { x: 5, y: 0 },
      },
    ]);
  });

  it("moves an unselected single-row background from its endpoint", () => {
    setStructuredBgScene(false);
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [1, 1],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [31, 1],
        delta: [30, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [31, 1],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([
      "bg-1",
    ]);
    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "bg-1",
      start: { x: 3, y: 0 },
      end: { x: 7, y: 0 },
    });
  });

  it("resizes a selected single-row background from its endpoint", () => {
    setStructuredBgScene(true);
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [45, 10],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [61, 10],
        delta: [18, 0],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([
      "bg-1",
    ]);
    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "bg-1",
      start: { x: 0, y: 0 },
      end: { x: 6, y: 0 },
    });
  });

  it("expands a selected single-row background vertically from its visible handle", () => {
    setStructuredBgScene(true);
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [23, 19],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [23, 41],
        delta: [0, 22],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "bg-1",
      start: { x: 0, y: 0 },
      end: { x: 4, y: 2 },
    });
  });

  it("moves a selected single-row background from its body safe area", () => {
    setStructuredBgScene(true);
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [23, 10],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [41, 10],
        delta: [18, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [41, 10],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "bg-1",
      start: { x: 2, y: 0 },
      end: { x: 6, y: 0 },
    });
  });

  it("resizes a selected structured line from its visible endpoint handle", () => {
    setStructuredLineScene(true);
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [41, 10],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [41, 48],
        delta: [0, 38],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "line-1",
      start: { x: 0, y: 0 },
      end: { x: 4, y: 2 },
      axis: "horizontal",
    });
  });

  it("moves a selected structured line from its body safe area", () => {
    setStructuredLineScene(true);
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [23, 10],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [41, 10],
        delta: [18, 0],
        event: dragEvent(),
      });
      gestureState.handlers?.onDragEnd?.({
        xy: [41, 10],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "line-1",
      start: { x: 2, y: 0 },
      end: { x: 6, y: 0 },
    });
  });

  it("resizes the hit rectangle instead of moving every selected node", () => {
    setStructuredMixedScene();
    useCanvasStore.setState({ selectedStructuredNodeIds: ["box-1"] });
    render(<InteractionHarness />);

    act(() => {
      gestureState.handlers?.onDragStart?.({
        xy: [1, 1],
        event: dragEvent(),
      });
      gestureState.handlers?.onDrag?.({
        xy: [31, 1],
        delta: [30, 0],
        event: dragEvent(),
      });
    });

    expect(useCanvasStore.getState().selectedStructuredNodeIds).toEqual([
      "box-1",
    ]);
    expect(useCanvasStore.getState().structuredScene).toMatchObject([
      {
        id: "box-1",
        start: { x: 2, y: 0 },
        end: { x: 3, y: 2 },
      },
      {
        id: "text-1",
        position: { x: 5, y: 0 },
      },
    ]);
  });
});
