import { describe, expect, it, vi } from "vitest";
import {
  createColorPickerDragStartHandler,
  createColorPickerDragStartExecutor,
  chooseCanvasColorSource,
  executeCanvasColorPickDecision,
  executeColorPickerDragStart,
  getCanvasCellColorCandidates,
  resolveCanvasColorPickDecision,
  type CanvasColorPickExecutor,
  type ColorPickerDragStartExecutor,
} from "@/widgets/canvas-editor/hooks/interaction/gestures/colorPickerInteraction";
import type { GridCell } from "@/shared/types";

const cell: GridCell = {
  char: "A",
  color: "#112233",
  bgColor: "#445566",
};

const blankCell: GridCell = {
  char: " ",
  color: "#112233",
  bgColor: "#445566",
};

const createPickExecutor = (): CanvasColorPickExecutor => ({
  setBrushColor: vi.fn(),
  setBrushBackgroundColor: vi.fn(),
  setSelectionForegroundColor: vi.fn(),
  setSelectionBackgroundColor: vi.fn(),
  setStructuredTextColor: vi.fn(),
  setStructuredSelectionPrimaryColor: vi.fn(),
  openColorSourceChooser: vi.fn(),
  clearColorPickerTarget: vi.fn(),
  clearHoveredGrid: vi.fn(),
});

const createDragExecutor = (): ColorPickerDragStartExecutor => ({
  ...createPickExecutor(),
  preventDefault: vi.fn(),
  markColorPickerClick: vi.fn(),
  resetDragState: vi.fn(),
  setCursor: vi.fn(),
});

describe("canvas color picker interaction", () => {
  it("finds visible character and background color candidates", () => {
    expect(getCanvasCellColorCandidates(cell)).toEqual({
      foreground: "#112233",
      background: "#445566",
    });
    expect(getCanvasCellColorCandidates(blankCell)).toEqual({
      foreground: null,
      background: "#445566",
    });
  });

  it("requests a source choice when foreground and background differ", () => {
    expect(
      resolveCanvasColorPickDecision({
        cell,
        point: { x: 2, y: 3 },
        target: "auto",
        isStructuredTextSelectionActive: true,
      })
    ).toEqual({
      type: "choose-source",
      choice: {
        point: { x: 2, y: 3 },
        foreground: "#112233",
        background: "#445566",
        destination: "foreground",
        applyStaticGridSelection: false,
        applyStructuredTextColor: true,
        applyStructuredSelectionPrimaryColor: false,
      },
    });
  });

  it("picks the only available source and preserves structured selection precedence", () => {
    expect(
      resolveCanvasColorPickDecision({
        cell: { char: "A", color: "#112233" },
        point: { x: 2, y: 3 },
        target: "auto",
        isStructuredTextSelectionActive: true,
        isStructuredNodeSelectionActive: true,
      })
    ).toEqual({
      type: "picked",
      color: "#112233",
      destination: "foreground",
      applyStaticGridSelection: false,
      applyStructuredTextColor: true,
      applyStructuredSelectionPrimaryColor: false,
    });
  });

  it("picks matching foreground and background colors without prompting", () => {
    expect(
      resolveCanvasColorPickDecision({
        cell: { char: "A", color: "#112233", bgColor: "#112233" },
        point: { x: 2, y: 3 },
        target: "auto",
        isStructuredTextSelectionActive: false,
      })
    ).toMatchObject({ type: "picked", color: "#112233" });
  });

  it("keeps the active color picker when no color is found", () => {
    expect(
      resolveCanvasColorPickDecision({
        cell: undefined,
        point: { x: 2, y: 3 },
        target: "auto",
        isStructuredTextSelectionActive: false,
      })
    ).toEqual({ type: "empty" });
  });

  it("ignores inactive color picker decisions", () => {
    expect(
      resolveCanvasColorPickDecision({
        cell,
        point: { x: 2, y: 3 },
        target: null,
        isStructuredTextSelectionActive: false,
      })
    ).toEqual({ type: "none" });
  });

  it("executes picked color decisions", () => {
    const executor = createPickExecutor();

    expect(
      executeCanvasColorPickDecision(
        {
          type: "picked",
          color: "#112233",
          destination: "foreground",
          applyStaticGridSelection: false,
          applyStructuredTextColor: true,
          applyStructuredSelectionPrimaryColor: false,
        },
        executor
      )
    ).toBe(true);

    expect(executor.setBrushColor).toHaveBeenCalledWith("#112233");
    expect(executor.setStructuredTextColor).toHaveBeenCalledWith("#112233");
    expect(executor.clearColorPickerTarget).toHaveBeenCalledTimes(1);
    expect(executor.clearHoveredGrid).toHaveBeenCalledTimes(1);
  });

  it("opens a source chooser and applies the selected candidate", () => {
    const executor = createPickExecutor();
    const decision = resolveCanvasColorPickDecision({
      cell,
      point: { x: 2, y: 3 },
      target: "auto",
      isStructuredTextSelectionActive: false,
    });

    executeCanvasColorPickDecision(decision, executor);
    expect(executor.openColorSourceChooser).toHaveBeenCalledTimes(1);
    expect(executor.setBrushColor).not.toHaveBeenCalled();
    expect(executor.clearColorPickerTarget).toHaveBeenCalledTimes(1);

    if (decision.type !== "choose-source") throw new Error("Expected source choice");
    executeCanvasColorPickDecision(
      chooseCanvasColorSource(decision.choice, "background"),
      executor
    );
    expect(executor.setBrushColor).toHaveBeenCalledWith("#445566");
  });

  it("executes color-picker drag starts", () => {
    const executor = createDragExecutor();

    expect(
      executeColorPickerDragStart(
        {
          type: "picked",
          color: "#445566",
          destination: "foreground",
          applyStaticGridSelection: false,
          applyStructuredTextColor: false,
          applyStructuredSelectionPrimaryColor: false,
        },
        executor
      )
    ).toBe(true);

    expect(executor.preventDefault).toHaveBeenCalledTimes(1);
    expect(executor.markColorPickerClick).toHaveBeenCalledTimes(1);
    expect(executor.setBrushColor).toHaveBeenCalledWith("#445566");
    expect(executor.resetDragState).toHaveBeenCalledTimes(1);
    expect(executor.setCursor).toHaveBeenCalledWith("");
  });

  it("consumes empty-cell clicks without ending color-picker mode", () => {
    const executor = createDragExecutor();

    expect(executeColorPickerDragStart({ type: "empty" }, executor)).toBe(true);
    expect(executor.preventDefault).toHaveBeenCalledTimes(1);
    expect(executor.markColorPickerClick).toHaveBeenCalledTimes(1);
    expect(executor.clearColorPickerTarget).not.toHaveBeenCalled();
    expect(executor.clearHoveredGrid).not.toHaveBeenCalled();
    expect(executor.resetDragState).not.toHaveBeenCalled();
    expect(executor.setCursor).toHaveBeenCalledWith("crosshair");
  });

  it("routes palette background picks to the background default", () => {
    const executor = createPickExecutor();
    const decision = resolveCanvasColorPickDecision({
      cell: blankCell,
      point: { x: 2, y: 3 },
      target: "auto-to-background",
      isStructuredTextSelectionActive: false,
    });

    expect(decision).toEqual({
      type: "picked",
      color: "#445566",
      destination: "background",
      applyStaticGridSelection: false,
      applyStructuredTextColor: false,
      applyStructuredSelectionPrimaryColor: false,
    });
    executeCanvasColorPickDecision(decision, executor);
    expect(executor.setBrushBackgroundColor).toHaveBeenCalledWith("#445566");
    expect(executor.setBrushColor).not.toHaveBeenCalled();
  });

  it("applies eyedropper colors to an active static-grid selection", () => {
    const executor = createPickExecutor();
    const decision = resolveCanvasColorPickDecision({
      cell: { char: "A", color: "#112233" },
      point: { x: 2, y: 3 },
      target: "auto-to-background",
      isStructuredTextSelectionActive: false,
      isStaticGridSelectionActive: true,
    });

    executeCanvasColorPickDecision(decision, executor);
    expect(executor.setBrushBackgroundColor).toHaveBeenCalledWith("#112233");
    expect(executor.setSelectionBackgroundColor).toHaveBeenCalledWith(
      "#112233"
    );
  });

  it("applies either sampled source to a structured selection's primary color", () => {
    const executor = createPickExecutor();
    const decision = resolveCanvasColorPickDecision({
      cell: blankCell,
      point: { x: 2, y: 3 },
      target: "auto",
      isStructuredTextSelectionActive: false,
      isStructuredNodeSelectionActive: true,
    });

    executeCanvasColorPickDecision(decision, executor);
    expect(executor.setBrushColor).toHaveBeenCalledWith("#445566");
    expect(executor.setStructuredSelectionPrimaryColor).toHaveBeenCalledWith(
      "#445566"
    );
  });

  it("does not execute inactive color-picker drag starts", () => {
    const executor = createDragExecutor();

    expect(executeColorPickerDragStart({ type: "none" }, executor)).toBe(false);
    expect(executor.preventDefault).not.toHaveBeenCalled();
  });

  it("creates color-picker drag-start executors that bind refs and callbacks", () => {
    const colorPickerClick = { current: false };
    const setBrushColor = vi.fn();
    const setBrushBackgroundColor = vi.fn();
    const setSelectionForegroundColor = vi.fn();
    const setSelectionBackgroundColor = vi.fn();
    const setStructuredTextColor = vi.fn();
    const setStructuredSelectionPrimaryColor = vi.fn();
    const openColorSourceChooser = vi.fn();
    const clearColorPickerTarget = vi.fn();
    const clearHoveredGrid = vi.fn();
    const resetDragState = vi.fn();
    const setCursor = vi.fn();
    const executor = createColorPickerDragStartExecutor({
      colorPickerClick,
      preventDefault: vi.fn(),
      setBrushColor,
      setBrushBackgroundColor,
      setSelectionForegroundColor,
      setSelectionBackgroundColor,
      setStructuredTextColor,
      setStructuredSelectionPrimaryColor,
      openColorSourceChooser,
      clearColorPickerTarget,
      clearHoveredGrid,
      resetDragState,
      setCursor,
    });

    executor.markColorPickerClick();
    executor.setBrushColor("#112233");
    executor.setBrushBackgroundColor("#334455");
    executor.setSelectionForegroundColor("#556677");
    executor.setSelectionBackgroundColor("#778899");
    executor.setStructuredTextColor("#445566");
    executor.setStructuredSelectionPrimaryColor("#667788");
    executor.openColorSourceChooser({
      point: { x: 2, y: 3 },
      foreground: "#112233",
      background: "#445566",
      destination: "foreground",
      applyStaticGridSelection: false,
      applyStructuredTextColor: false,
      applyStructuredSelectionPrimaryColor: false,
    });
    executor.clearColorPickerTarget();
    executor.clearHoveredGrid();
    executor.resetDragState();
    executor.setCursor("");

    expect(colorPickerClick.current).toBe(true);
    expect(setBrushColor).toHaveBeenCalledWith("#112233");
    expect(setBrushBackgroundColor).toHaveBeenCalledWith("#334455");
    expect(setSelectionForegroundColor).toHaveBeenCalledWith("#556677");
    expect(setSelectionBackgroundColor).toHaveBeenCalledWith("#778899");
    expect(setStructuredTextColor).toHaveBeenCalledWith("#445566");
    expect(setStructuredSelectionPrimaryColor).toHaveBeenCalledWith("#667788");
    expect(openColorSourceChooser).toHaveBeenCalledTimes(1);
    expect(clearColorPickerTarget).toHaveBeenCalledTimes(1);
    expect(clearHoveredGrid).toHaveBeenCalledTimes(1);
    expect(resetDragState).toHaveBeenCalledTimes(1);
    expect(setCursor).toHaveBeenCalledWith("");
  });

  it("creates color-picker drag-start handlers that resolve cells and execute picks", () => {
    const executor = createDragExecutor();
    const getCell = vi.fn(() => cell);
    const preventDefault = vi.fn();
    const handler = createColorPickerDragStartHandler({
      target: "auto",
      isStructuredTextSelectionActive: true,
      getCell,
      executor,
    });

    expect(
      handler({
        point: { x: 2, y: 3 },
        preventDefault,
      })
    ).toBe(true);

    expect(getCell).toHaveBeenCalledWith({ x: 2, y: 3 });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(executor.markColorPickerClick).toHaveBeenCalledTimes(1);
    expect(executor.openColorSourceChooser).toHaveBeenCalledTimes(1);
    expect(executor.setBrushColor).not.toHaveBeenCalled();
    expect(executor.resetDragState).toHaveBeenCalledTimes(1);
  });

  it("ignores color-picker drag-start handlers without a point", () => {
    const executor = createDragExecutor();
    const getCell = vi.fn(() => cell);
    const handler = createColorPickerDragStartHandler({
      target: "auto",
      isStructuredTextSelectionActive: false,
      getCell,
      executor,
    });

    expect(handler({ point: null, preventDefault: vi.fn() })).toBe(false);
    expect(getCell).not.toHaveBeenCalled();
    expect(executor.preventDefault).not.toHaveBeenCalled();
  });
});
