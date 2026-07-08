import { describe, expect, it, vi } from "vitest";
import {
  createCanvasMoveExecutor,
  executeCanvasMoveDecision,
  type CanvasMoveExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/moveExecution";
import type { CanvasLinkHit } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/core/linkHitTesting";

const linkHit: CanvasLinkHit = {
  y: 2,
  startX: 1,
  endX: 5,
  href: "https://example.com",
};

const event = { ctrlKey: true, metaKey: false };

const createExecutor = (): CanvasMoveExecutor => ({
  updateColorPickerHover: vi.fn(),
  updateLinkHover: vi.fn(),
  setHoveredGrid: vi.fn(),
  setCursor: vi.fn(),
});

describe("canvas move execution", () => {
  it("executes color-picker hover without updating link hover", () => {
    const executor = createExecutor();

    executeCanvasMoveDecision(
      { type: "color-picker-hover", point: { x: 1, y: 2 } },
      executor,
      event
    );

    expect(executor.updateColorPickerHover).toHaveBeenCalledWith({ x: 1, y: 2 });
    expect(executor.updateLinkHover).not.toHaveBeenCalled();
  });

  it("updates link hover before structured text cursor actions", () => {
    const executor = createExecutor();

    executeCanvasMoveDecision(
      {
        type: "canvas-hover",
        linkHit,
        action: { type: "structured-text-cursor" },
      },
      executor,
      event
    );

    expect(executor.updateLinkHover).toHaveBeenCalledWith(linkHit, event);
    expect(executor.setCursor).toHaveBeenCalledWith("text");
  });

  it("executes structured shape hover", () => {
    const executor = createExecutor();

    executeCanvasMoveDecision(
      {
        type: "canvas-hover",
        linkHit: null,
        action: { type: "structured-shape-hover", point: { x: 3, y: 4 } },
      },
      executor,
      event
    );

    expect(executor.updateLinkHover).toHaveBeenCalledWith(null, event);
    expect(executor.setHoveredGrid).toHaveBeenCalledWith({ x: 3, y: 4 });
    expect(executor.setCursor).toHaveBeenCalledWith("crosshair");
  });

  it("executes structured select cursor hover", () => {
    const executor = createExecutor();

    executeCanvasMoveDecision(
      {
        type: "canvas-hover",
        linkHit,
        action: { type: "structured-select-hover", cursor: "ew-resize" },
      },
      executor,
      event
    );

    expect(executor.setCursor).toHaveBeenCalledWith("ew-resize");
  });

  it("executes eraser hover without changing cursor", () => {
    const executor = createExecutor();

    executeCanvasMoveDecision(
      {
        type: "canvas-hover",
        linkHit: null,
        action: { type: "eraser-hover", point: { x: 8, y: 1 } },
      },
      executor,
      event
    );

    expect(executor.setHoveredGrid).toHaveBeenCalledWith({ x: 8, y: 1 });
    expect(executor.setCursor).not.toHaveBeenCalled();
  });

  it("creates move executors that bind hover and cursor callbacks", () => {
    const updateColorPickerHover = vi.fn();
    const updateLinkHover = vi.fn();
    const setHoveredGrid = vi.fn();
    const setCursor = vi.fn();
    const executor = createCanvasMoveExecutor({
      updateColorPickerHover,
      updateLinkHover,
      setHoveredGrid,
      setCursor,
    });

    executor.updateColorPickerHover({ x: 1, y: 2 });
    executor.updateLinkHover(linkHit, event);
    executor.setHoveredGrid({ x: 3, y: 4 });
    executor.setCursor("crosshair");

    expect(updateColorPickerHover).toHaveBeenCalledWith({ x: 1, y: 2 });
    expect(updateLinkHover).toHaveBeenCalledWith(linkHit, event);
    expect(setHoveredGrid).toHaveBeenCalledWith({ x: 3, y: 4 });
    expect(setCursor).toHaveBeenCalledWith("crosshair");
  });
});
