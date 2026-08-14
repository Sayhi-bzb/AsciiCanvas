import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canvasCommands,
  replaceCanvasGrid,
  useEditorStore,
} from "@/domains/canvas/testing";
import { ShortcutProvider } from "@/shared/shortcuts/dispatcher";
import { CanvasInspectorControl } from "./canvas-inspector";

const initialState = useEditorStore.getState();

function Inspector({
  formFactor = "desktop",
  readOnly = false,
  onBeforeOpen,
}: Partial<React.ComponentProps<typeof CanvasInspectorControl>>) {
  return (
    <ShortcutProvider>
      <CanvasInspectorControl
        formFactor={formFactor}
        readOnly={readOnly}
        onBeforeOpen={onBeforeOpen}
      />
    </ShortcutProvider>
  );
}

describe("CanvasInspectorControl", () => {
  afterEach(() => {
    act(() => {
      replaceCanvasGrid([]);
      useEditorStore.setState(initialState, true);
    });
  });

  it("uses one persistent swatch trigger and one global open state", () => {
    useEditorStore.setState({
      canvasMode: "freeform",
      tool: "select",
      brushColor: "#123456",
    });
    render(<Inspector />);

    const toggle = screen.getByRole("button", { name: "Toggle inspector" });
    const swatch = screen.getByTestId("canvas-inspector-swatch");
    expect(toggle.querySelector("svg")).not.toBeInTheDocument();
    expect(swatch).toHaveClass("rounded-[3px]");
    expect(swatch).toHaveStyle({ backgroundColor: "#123456" });
    const panel = screen.getByTestId("canvas-inspector-panel");
    const content = screen.getByTestId("canvas-inspector-content");
    const colorPicker = screen.getByTestId("color-picker-header").parentElement;
    expect(panel).toHaveClass(
      "w-[min(10rem,calc(100vw-2rem))]",
      "overflow-hidden"
    );
    expect(content).toHaveClass("px-1", "py-2");
    expect(content).not.toHaveClass("p-2");
    expect(colorPicker).toHaveClass("w-full", "px-0");
    expect(screen.getAllByTestId("canvas-inspector-panel")).toHaveLength(1);

    fireEvent.click(toggle);
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();

    act(() => useEditorStore.setState({ canvasMode: "structured" }));
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();
    act(() => useEditorStore.setState({ canvasMode: "freeform" }));
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();
  });

  it("starts collapsed on phone and adopts a resolved form factor before user input", () => {
    useEditorStore.setState({ canvasMode: "structured", tool: "select" });
    const view = render(<Inspector formFactor="desktop" />);
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();

    view.rerender(<Inspector formFactor="phone" />);
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();
  });

  it("automatically closes for Hand in every canvas mode without reopening on tool exit", () => {
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });
    render(<Inspector />);
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();

    act(() => useEditorStore.getState().setTool("pan"));
    expect(useEditorStore.getState().tool).toBe("pan");
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle inspector" })).toBeDisabled();

    act(() => useEditorStore.getState().setTool("select"));
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle inspector" }));
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();

    act(() => useEditorStore.setState({ canvasMode: "structured", tool: "select" }));
    act(() => useEditorStore.getState().setTool("pan"));
    expect(useEditorStore.getState().tool).toBe("pan");
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();

    act(() => {
      useEditorStore.getState().createCanvasSession("slide");
      useEditorStore.getState().setTool("select");
    });
    fireEvent.click(screen.getByRole("button", { name: "Toggle inspector" }));
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();
    act(() => useEditorStore.getState().setTool("pan"));
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();
  });

  it("owns Alt+6 and Escape across canvas modes", () => {
    const onBeforeOpen = vi.fn();
    useEditorStore.setState({ canvasMode: "freeform", tool: "select" });
    render(<Inspector onBeforeOpen={onBeforeOpen} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { code: "Digit6", altKey: true });
    expect(onBeforeOpen).toHaveBeenCalledOnce();
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();

    act(() => useEditorStore.setState({ canvasMode: "structured" }));
    fireEvent.keyDown(window, { code: "Digit6", altKey: true });
    expect(screen.queryByTestId("canvas-inspector-panel")).not.toBeInTheDocument();
  });

  it("closes the hex editor with Escape without closing the inspector", () => {
    useEditorStore.setState({ canvasMode: "structured", tool: "select" });
    render(<Inspector />);

    fireEvent.click(screen.getByRole("button", { name: /^Hex:/ }));
    const input = screen.getByRole("textbox", { name: "Hex" });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("textbox", { name: "Hex" })).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();
  });

  it("applies freeform foreground and background colors to defaults and selections", () => {
    act(() => {
      replaceCanvasGrid([["0,0", { char: "A", color: "#111111" }]]);
      useEditorStore.setState({
        canvasMode: "freeform",
        tool: "select",
        brushColor: "#111111",
        brushBackgroundColor: "#222222",
        selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
      });
    });
    render(<Inspector />);

    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #ff0000" }));
    expect(useEditorStore.getState().brushColor).toBe("#ff0000");
    expect(useEditorStore.getState().grid.get("0,0")?.color).toBe("#ff0000");
    fireEvent.click(screen.getByRole("button", { name: "Restore default color" }));
    expect(useEditorStore.getState().brushColor).toBe("#000000");
    expect(useEditorStore.getState().grid.get("0,0")?.color).toBe("#000000");

    act(() => useEditorStore.setState({ tool: "bg" }));
    expect(screen.getByTestId("canvas-inspector-swatch")).toHaveStyle({
      backgroundColor: "#222222",
    });
    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #0000ff" }));
    expect(useEditorStore.getState().brushBackgroundColor).toBe("#0000ff");
    expect(useEditorStore.getState().grid.get("0,0")?.bgColor).toBe("#0000ff");
    fireEvent.click(screen.getByRole("button", { name: "Restore default color" }));
    expect(useEditorStore.getState().brushBackgroundColor).toBe("#000000");
    expect(useEditorStore.getState().grid.get("0,0")?.bgColor).toBe("#000000");
  });

  it("applies structured semantic colors and exposes layer arrangement", () => {
    useEditorStore.setState({ canvasMode: "structured", tool: "select" });
    canvasCommands.structured.applyScene(
      [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 2, y: 3 },
          end: { x: 6, y: 5 },
          style: { color: "#ffffff", bgColor: "#eeeeee" },
        },
        {
          id: "bg-1",
          type: "bg",
          order: 2,
          start: { x: 0, y: 0 },
          end: { x: 8, y: 6 },
          style: { color: "#000000", bgColor: "#111111" },
        },
      ],
      "reset"
    );
    useEditorStore.setState({
      selectedStructuredNodeIds: ["box-1", "bg-1"],
    });
    render(<Inspector />);

    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #ff0000" }));
    const [box, bg] = useEditorStore.getState().structuredScene;
    expect(box.style).toMatchObject({
      color: "#ff0000",
      bgColor: "#eeeeee",
    });
    expect(bg.style).toMatchObject({
      color: "#000000",
      bgColor: "#ff0000",
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore default color" }));
    const [resetBox, resetBg] = useEditorStore.getState().structuredScene;
    expect(useEditorStore.getState().brushColor).toBe("#000000");
    expect(resetBox.style).toMatchObject({
      color: "#000000",
      bgColor: "#eeeeee",
    });
    expect(resetBg.style).toMatchObject({
      color: "#000000",
      bgColor: "#000000",
    });
    expect(screen.getByRole("region", { name: "Arrange" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send to Back" })).toBeInTheDocument();
    expect(screen.queryByText("Geometry")).not.toBeInTheDocument();
  });

  it("restores a structured text range and the creation default together", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      tool: "select",
      brushColor: "#ff0000",
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
    render(<Inspector />);

    fireEvent.click(screen.getByRole("button", { name: "Restore default color" }));

    expect(useEditorStore.getState().brushColor).toBe("#000000");
    expect(useEditorStore.getState().structuredScene[0]).toMatchObject({
      style: { color: "#ffffff" },
      styleRanges: [
        {
          start: 1,
          end: 4,
          style: { color: "#000000" },
        },
      ],
    });
  });

  it("remains inspectable but immutable in read-only sessions", () => {
    useEditorStore.setState({
      canvasMode: "structured",
      tool: "select",
      selectedStructuredNodeIds: ["box-1"],
      structuredScene: [
        {
          id: "box-1",
          type: "box",
          order: 1,
          start: { x: 0, y: 0 },
          end: { x: 2, y: 2 },
          style: { color: "#ffffff" },
        },
      ],
    });
    render(<Inspector readOnly />);

    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();
    expect(
      screen.getByTestId("canvas-inspector-panel").querySelector('[aria-disabled="true"]')
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bring Forward" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Restore default color" }));
    expect(useEditorStore.getState().structuredScene[0]?.style.color).toBe("#ffffff");
  });

  it("reuses grid appearance controls for the active slide", () => {
    act(() => {
      useEditorStore.getState().createCanvasSession("slide", {
        slideSize: { columns: 4, rows: 2 },
      });
      replaceCanvasGrid([["0,0", { char: "A", color: "#111111" }]]);
      useEditorStore.setState({
        tool: "select",
        brushColor: "#111111",
        brushBackgroundColor: "#222222",
        selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
      });
    });
    const firstSlideId = useEditorStore.getState().slideDeck!.activeSlideId;
    render(<Inspector />);

    expect(screen.getByRole("button", { name: "Toggle inspector" })).toBeVisible();
    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Arrange" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #ff0000" }));
    expect(useEditorStore.getState().brushColor).toBe("#ff0000");
    expect(useEditorStore.getState().grid.get("0,0")?.color).toBe("#ff0000");
    expect(useEditorStore.getState().slideDeck?.slides[0].grid[0]?.[1].color).toBe(
      "#ff0000"
    );

    act(() => {
      useEditorStore.getState().addSlide();
      replaceCanvasGrid([["0,0", { char: "B", color: "#222222" }]]);
      useEditorStore.setState({
        selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
      });
    });
    const secondSlideId = useEditorStore.getState().slideDeck!.activeSlideId;
    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #00ff00" }));
    const deckAfterSecondPick = useEditorStore.getState().slideDeck!;
    expect(
      deckAfterSecondPick.slides.find((slide) => slide.id === firstSlideId)?.grid[0]?.[1].color
    ).toBe("#ff0000");
    expect(
      deckAfterSecondPick.slides.find((slide) => slide.id === secondSlideId)?.grid[0]?.[1].color
    ).toBe("#00ff00");

    act(() => useEditorStore.getState().setTool("bg"));
    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #0000ff" }));
    expect(useEditorStore.getState().brushBackgroundColor).toBe("#0000ff");
    expect(useEditorStore.getState().grid.get("0,0")?.bgColor).toBe("#0000ff");

    fireEvent.click(screen.getByRole("button", { name: "Restore default color" }));
    expect(useEditorStore.getState().brushBackgroundColor).toBe("#000000");
    expect(useEditorStore.getState().grid.get("0,0")?.bgColor).toBe("#000000");
  });

  it("keeps the Slides inspector immutable in read-only sessions", () => {
    act(() => {
      useEditorStore.getState().createCanvasSession("slide", {
        slideSize: { columns: 4, rows: 2 },
      });
      replaceCanvasGrid([["0,0", { char: "A", color: "#111111" }]]);
      useEditorStore.setState({
        tool: "select",
        brushColor: "#111111",
        selections: [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }],
      });
    });
    render(<Inspector readOnly />);

    expect(screen.getByTestId("canvas-inspector-panel")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Pick ANSI color #ff0000" }));
    expect(useEditorStore.getState().brushColor).toBe("#111111");
    expect(useEditorStore.getState().grid.get("0,0")?.color).toBe("#111111");
  });
});
