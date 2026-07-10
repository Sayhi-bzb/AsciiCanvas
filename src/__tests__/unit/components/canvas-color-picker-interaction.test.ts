import { describe, expect, it, vi } from "vitest";
import {
  createColorPickerDragStartHandler,
  createColorPickerDragStartExecutor,
  executeCanvasColorPickDecision,
  executeColorPickerDragStart,
  getCanvasCellPickedColor,
  resolveCanvasColorPickDecision,
  type CanvasColorPickExecutor,
  type ColorPickerDragStartExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/colorPickerInteraction";
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
  setStructuredTextColor: vi.fn(),
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
  it("picks character and background colors from cells", () => {
    expect(getCanvasCellPickedColor(cell, "char")).toBe("#112233");
    expect(getCanvasCellPickedColor(cell, "bg")).toBe("#445566");
    expect(getCanvasCellPickedColor(blankCell, "char")).toBeNull();
  });

  it("resolves structured text color synchronization", () => {
    expect(
      resolveCanvasColorPickDecision({
        cell,
        target: "char",
        isStructuredTextSelectionActive: true,
      })
    ).toEqual({
      type: "picked",
      color: "#112233",
      applyStructuredTextColor: true,
    });
  });

  it("clears active color picker target when no color is picked", () => {
    expect(
      resolveCanvasColorPickDecision({
        cell: undefined,
        target: "bg",
        isStructuredTextSelectionActive: false,
      })
    ).toEqual({ type: "clear-target" });
  });

  it("ignores inactive color picker decisions", () => {
    expect(
      resolveCanvasColorPickDecision({
        cell,
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
          applyStructuredTextColor: true,
        },
        executor
      )
    ).toBe(true);

    expect(executor.setBrushColor).toHaveBeenCalledWith("#112233");
    expect(executor.setStructuredTextColor).toHaveBeenCalledWith("#112233");
    expect(executor.clearColorPickerTarget).toHaveBeenCalledTimes(1);
    expect(executor.clearHoveredGrid).toHaveBeenCalledTimes(1);
  });

  it("executes color-picker drag starts", () => {
    const executor = createDragExecutor();

    expect(
      executeColorPickerDragStart(
        {
          type: "picked",
          color: "#445566",
          applyStructuredTextColor: false,
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

  it("does not execute inactive color-picker drag starts", () => {
    const executor = createDragExecutor();

    expect(executeColorPickerDragStart({ type: "none" }, executor)).toBe(false);
    expect(executor.preventDefault).not.toHaveBeenCalled();
  });

  it("creates color-picker drag-start executors that bind refs and callbacks", () => {
    const colorPickerClick = { current: false };
    const setBrushColor = vi.fn();
    const setStructuredTextColor = vi.fn();
    const clearColorPickerTarget = vi.fn();
    const clearHoveredGrid = vi.fn();
    const resetDragState = vi.fn();
    const setCursor = vi.fn();
    const executor = createColorPickerDragStartExecutor({
      colorPickerClick,
      preventDefault: vi.fn(),
      setBrushColor,
      setStructuredTextColor,
      clearColorPickerTarget,
      clearHoveredGrid,
      resetDragState,
      setCursor,
    });

    executor.markColorPickerClick();
    executor.setBrushColor("#112233");
    executor.setStructuredTextColor("#445566");
    executor.clearColorPickerTarget();
    executor.clearHoveredGrid();
    executor.resetDragState();
    executor.setCursor("");

    expect(colorPickerClick.current).toBe(true);
    expect(setBrushColor).toHaveBeenCalledWith("#112233");
    expect(setStructuredTextColor).toHaveBeenCalledWith("#445566");
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
      target: "char",
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
    expect(executor.setBrushColor).toHaveBeenCalledWith("#112233");
    expect(executor.setStructuredTextColor).toHaveBeenCalledWith("#112233");
    expect(executor.resetDragState).toHaveBeenCalledTimes(1);
  });

  it("ignores color-picker drag-start handlers without a point", () => {
    const executor = createDragExecutor();
    const getCell = vi.fn(() => cell);
    const handler = createColorPickerDragStartHandler({
      target: "char",
      isStructuredTextSelectionActive: false,
      getCell,
      executor,
    });

    expect(handler({ point: null, preventDefault: vi.fn() })).toBe(false);
    expect(getCell).not.toHaveBeenCalled();
    expect(executor.preventDefault).not.toHaveBeenCalled();
  });
});
