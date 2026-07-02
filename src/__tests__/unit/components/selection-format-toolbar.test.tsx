import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SelectionFormatToolbar } from "@/domains/canvas/components/AsciiCanvas/SelectionFormatToolbar";
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
