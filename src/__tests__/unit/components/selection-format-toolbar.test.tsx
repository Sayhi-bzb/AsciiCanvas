import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SelectionFormatToolbar } from "@/domains/canvas/components/AsciiCanvas/SelectionFormatToolbar";
import { STRUCTURED_CONTEXT_MENU } from "@/domains/actions/core";
import { ColorSubmenu } from "@/domains/canvas/components/ToolBar/dock/submenus";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";

describe("SelectionFormatToolbar", () => {
  const initialState = useCanvasStore.getState();

  afterEach(() => {
    vi.restoreAllMocks();
    useCanvasStore.setState(initialState, true);
  });

  it("formats selected structured text ranges", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      brushColor: "#123456",
      offset: { x: 0, y: 0 },
      zoom: 1,
      selectedStructuredNodeIds: ["text-1"],
      editingStructuredTextNodeId: "text-1",
      structuredTextSelection: { nodeId: "text-1", anchor: 1, focus: 4 },
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 2, y: 3 },
          text: "Label",
          style: { color: "#ffffff" },
        },
      ],
    });

    render(<SelectionFormatToolbar containerSize={{ width: 800, height: 600 }} />);

    expect(screen.getByLabelText("Selection text formatting")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Toggle bold"));

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      text: "Label",
      styleRanges: [
        {
          start: 1,
          end: 4,
          style: {
            attrs: { bold: true },
          },
        },
      ],
    });
  });

  it("applies selected structured text color without filling with the brush character", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      brushChar: "\ue203",
      brushColor: "#ef4444",
      offset: { x: 0, y: 0 },
      zoom: 1,
      selectedStructuredNodeIds: ["text-1"],
      editingStructuredTextNodeId: "text-1",
      structuredTextSelection: { nodeId: "text-1", anchor: 1, focus: 4 },
      structuredScene: [
        {
          id: "text-1",
          type: "text",
          order: 1,
          position: { x: 2, y: 3 },
          text: "Label",
          style: { color: "#ffffff" },
        },
      ],
    });

    render(<SelectionFormatToolbar containerSize={{ width: 800, height: 600 }} />);

    expect(screen.queryByLabelText("Fill with brush character")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Apply brush color to selected text"));

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "text-1",
      text: "Label",
      styleRanges: [
        {
          start: 1,
          end: 4,
          style: { color: "#ef4444" },
        },
      ],
    });
  });

  it("does not show for selected structured boxes", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      selectedStructuredNodeIds: ["box-1"],
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

    render(<SelectionFormatToolbar containerSize={{ width: 800, height: 600 }} />);

    expect(screen.queryByLabelText("Selection text formatting")).not.toBeInTheDocument();
  });

  it("splits selected structured split boxes from the floating toolbar", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      selectedStructuredNodeIds: ["split-1"],
      hoveredGrid: { x: 2, y: 2 },
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

    render(<SelectionFormatToolbar containerSize={{ width: 800, height: 600 }} />);

    expect(screen.getByLabelText("Split box controls")).toBeInTheDocument();
    expect(
      screen
        .getByLabelText("Split box horizontally")
        .querySelector(".lucide-square-split-vertical")
    ).toBeInTheDocument();
    expect(
      screen
        .getByLabelText("Split box vertically")
        .querySelector(".lucide-square-split-horizontal")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Delete split divider")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Split box horizontally"));

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "split-1",
      type: "splitBox",
      root: {
        type: "split",
        axis: "horizontal",
        first: { type: "leaf", id: "root-leaf" },
      },
    });
  });

  it("disables split buttons without an active split box leaf", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      selectedStructuredNodeIds: ["split-1"],
      hoveredGrid: { x: 20, y: 20 },
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

    render(<SelectionFormatToolbar containerSize={{ width: 800, height: 600 }} />);

    expect(screen.getByLabelText("Split box horizontally")).toBeDisabled();
    expect(screen.getByLabelText("Split box vertically")).toBeDisabled();
    expect(screen.getByLabelText("Delete split divider")).toBeDisabled();
  });

  it("deletes selected split dividers from the floating toolbar", () => {
    useCanvasStore.setState({
      canvasMode: "structured",
      offset: { x: 0, y: 0 },
      zoom: 1,
      selectedStructuredNodeIds: ["split-1"],
      selectedStructuredSplitHandle: {
        nodeId: "split-1",
        handle: "split:split-existing",
      },
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

    render(<SelectionFormatToolbar containerSize={{ width: 800, height: 600 }} />);

    expect(screen.getByLabelText("Delete split divider")).toBeEnabled();

    fireEvent.click(screen.getByLabelText("Delete split divider"));

    expect(useCanvasStore.getState().structuredScene[0]).toMatchObject({
      id: "split-1",
      type: "splitBox",
      root: { type: "leaf", id: "leaf-split-existing" },
    });
  });

  it("keeps split actions out of the structured context menu", () => {
    const actionIds = STRUCTURED_CONTEXT_MENU.flatMap((entry) =>
      entry.type === "action" ? [entry.id] : []
    );

    expect(actionIds).not.toContain("structured-split-horizontal");
    expect(actionIds).not.toContain("structured-split-vertical");
    expect(actionIds).not.toContain("structured-delete-divider");
  });

  it("applies picked colors to the structured text selection callback", () => {
    const picked: string[] = [];
    const applied: string[] = [];

    render(
      <ColorSubmenu
        brushColor="#ffffff"
        setBrushColor={(color) => picked.push(color)}
        applyStructuredTextColor={(color) => applied.push(color)}
        onPicked={() => {}}
      />
    );

    fireEvent.click(screen.getByLabelText("Pick color #ef4444"));

    expect(picked).toEqual(["#ef4444"]);
    expect(applied).toEqual(["#ef4444"]);
  });

  it("starts canvas char color picking from the color submenu", () => {
    render(
      <ColorSubmenu
        brushColor="#ffffff"
        setBrushColor={() => {}}
        onPicked={() => {}}
      />
    );

    fireEvent.click(screen.getByLabelText("Pick char color from canvas"));

    expect(useCanvasStore.getState().canvasColorPickerTarget).toBe("char");
  });

  it("starts canvas background color picking from the color submenu", () => {
    render(
      <ColorSubmenu
        brushColor="#ffffff"
        setBrushColor={() => {}}
        onPicked={() => {}}
      />
    );

    fireEvent.click(screen.getByLabelText("Pick BG color from canvas"));

    expect(useCanvasStore.getState().canvasColorPickerTarget).toBe("bg");
  });

  it("toggles an active canvas color picker target off", () => {
    useCanvasStore.setState({ canvasColorPickerTarget: "char" });

    render(
      <ColorSubmenu
        brushColor="#ffffff"
        setBrushColor={() => {}}
        onPicked={() => {}}
      />
    );

    fireEvent.click(screen.getByLabelText("Pick char color from canvas"));

    expect(useCanvasStore.getState().canvasColorPickerTarget).toBeNull();
  });
});
