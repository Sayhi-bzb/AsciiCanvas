import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SelectionFormatToolbar } from "@/widgets/canvas-editor/SelectionFormatToolbar";
import { STRUCTURED_CONTEXT_MENU } from "@/domains/actions/public";
import { ColorSubmenu } from "@/widgets/toolbar/dock/submenus";
import { useEditorStore } from "@/domains/canvas/testing";

describe("SelectionFormatToolbar", () => {
  const initialState = useEditorStore.getState();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useEditorStore.setState(initialState, true);
  });

  it("formats selected structured text ranges", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    useEditorStore.setState({
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

    const toolbar = screen.getByRole("toolbar", {
      name: "Selection text formatting",
    });
    expect(toolbar).toHaveClass(
      "bg-host-surface",
      "border-0",
      "shadow-host",
      "rounded-lg",
      "p-[3px]"
    );

    const boldButton = screen.getByLabelText("Toggle bold");
    expect(boldButton).toHaveClass(
      "hover:bg-accent",
      "hover:text-accent-foreground"
    );
    expect(fireEvent.mouseDown(boldButton)).toBe(false);
    fireEvent.click(boldButton);

    expect(boldButton).toHaveAttribute("data-state", "on");
    expect(boldButton).toHaveClass("data-[state=on]:bg-accent");
    expect(boldButton).not.toHaveClass("data-[state=on]:bg-primary");

    act(() => boldButton.focus());
    fireEvent.keyDown(boldButton, { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByLabelText("Toggle italic")).toHaveFocus();
    });

    expect(useEditorStore.getState().structuredScene[0]).toMatchObject({
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

  it("keeps color controls out of the structured text toolbar", () => {
    useEditorStore.setState({
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

    expect(screen.queryByLabelText("Apply brush color to selected text")).not.toBeInTheDocument();
  });

  it("keeps shape color controls out of the floating toolbar", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      brushColor: "#22c55e",
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
    expect(screen.queryByRole("toolbar", { name: "Shape color controls" })).not.toBeInTheDocument();
  });

  it("splits selected structured split boxes from the floating toolbar", () => {
    useEditorStore.setState({
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

    const toolbar = screen.getByRole("toolbar", { name: "Split box controls" });
    expect(toolbar).toHaveClass(
      "bg-host-surface",
      "border-0",
      "shadow-host",
      "rounded-lg",
      "p-[3px]"
    );
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
    expect(screen.queryByLabelText("Apply brush color to selected shape")).not.toBeInTheDocument();

    const splitHorizontal = screen.getByLabelText("Split box horizontally");
    expect(fireEvent.mouseDown(splitHorizontal)).toBe(false);
    fireEvent.click(splitHorizontal);

    expect(useEditorStore.getState().structuredScene[0]).toMatchObject({
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
    useEditorStore.setState({
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
    useEditorStore.setState({
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

    expect(useEditorStore.getState().structuredScene[0]).toMatchObject({
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

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Presets" }), {
      button: 0,
    });
    fireEvent.click(screen.getByLabelText("Pick preset color #dc2626"));

    expect(picked).toEqual(["#dc2626"]);
    expect(applied).toEqual(["#dc2626"]);
  });

  it("starts canvas char color picking from the color submenu", async () => {
    render(
      <ColorSubmenu
        brushColor="#ffffff"
        setBrushColor={() => {}}
        onPicked={() => {}}
      />
    );

    fireEvent.pointerDown(screen.getByLabelText("Pick color from canvas"));
    fireEvent.click(await screen.findByLabelText("Pick char color from canvas"));

    expect(useEditorStore.getState().canvasColorPickerTarget).toBe("char");
  });

  it("starts canvas background color picking from the color submenu", async () => {
    render(
      <ColorSubmenu
        brushColor="#ffffff"
        setBrushColor={() => {}}
        onPicked={() => {}}
      />
    );

    fireEvent.pointerDown(screen.getByLabelText("Pick color from canvas"));
    fireEvent.click(await screen.findByLabelText("Pick BG color from canvas"));

    expect(useEditorStore.getState().canvasColorPickerTarget).toBe("bg");
  });

  it("toggles an active canvas color picker target off", async () => {
    useEditorStore.setState({ canvasColorPickerTarget: "char" });

    render(
      <ColorSubmenu
        brushColor="#ffffff"
        setBrushColor={() => {}}
        onPicked={() => {}}
      />
    );

    fireEvent.pointerDown(screen.getByLabelText("Pick color from canvas"));
    fireEvent.click(await screen.findByLabelText("Pick char color from canvas"));

    expect(useEditorStore.getState().canvasColorPickerTarget).toBeNull();
  });
});
