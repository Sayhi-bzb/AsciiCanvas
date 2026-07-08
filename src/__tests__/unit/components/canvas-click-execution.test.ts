import { describe, expect, it, vi } from "vitest";
import {
  createCanvasClickExecutor,
  createCanvasClickHandler,
  executeCanvasClickDecision,
  type CanvasClickExecutor,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/clickExecution";
import type { CanvasLinkHit } from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/core/linkHitTesting";

const linkHit: CanvasLinkHit = {
  y: 2,
  startX: 1,
  endX: 4,
  href: "https://example.com",
};

const createExecutor = (): CanvasClickExecutor => ({
  preventDefault: vi.fn(),
  clearColorPickerClick: vi.fn(),
  clearSelections: vi.fn(),
  setSelectedStructuredNodeIds: vi.fn(),
  setSelectedStructuredSplitHandle: vi.fn(),
  setEditingStructuredTextNodeId: vi.fn(),
  setTextCursor: vi.fn(),
  setCursor: vi.fn(),
  openLink: vi.fn(),
  setHoveredLink: vi.fn(),
});

describe("canvas click execution", () => {
  it("executes color-picker click consumption", () => {
    const executor = createExecutor();

    expect(
      executeCanvasClickDecision(
        { type: "consume-color-picker-click" },
        executor
      )
    ).toBe(true);

    expect(executor.clearColorPickerClick).toHaveBeenCalledTimes(1);
    expect(executor.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("executes structured text caret placement", () => {
    const executor = createExecutor();
    const point = { x: 3, y: 4 };

    expect(
      executeCanvasClickDecision(
        { type: "structured-text-caret", point },
        executor
      )
    ).toBe(true);

    expect(executor.preventDefault).toHaveBeenCalledTimes(1);
    expect(executor.clearSelections).toHaveBeenCalledTimes(1);
    expect(executor.setSelectedStructuredNodeIds).toHaveBeenCalledWith([]);
    expect(executor.setSelectedStructuredSplitHandle).toHaveBeenCalledWith(null);
    expect(executor.setEditingStructuredTextNodeId).toHaveBeenCalledWith(null);
    expect(executor.setTextCursor).toHaveBeenCalledWith(point);
    expect(executor.setCursor).toHaveBeenCalledWith("text");
  });

  it("executes link openings", () => {
    const executor = createExecutor();

    expect(
      executeCanvasClickDecision({ type: "open-link", hit: linkHit }, executor)
    ).toBe(true);

    expect(executor.preventDefault).toHaveBeenCalledTimes(1);
    expect(executor.openLink).toHaveBeenCalledWith(linkHit.href);
    expect(executor.setHoveredLink).toHaveBeenCalledWith(linkHit);
  });

  it("ignores none decisions", () => {
    const executor = createExecutor();

    expect(executeCanvasClickDecision({ type: "none" }, executor)).toBe(false);
    expect(executor.preventDefault).not.toHaveBeenCalled();
  });
  it("creates click executors that bind refs and callbacks", () => {
    const colorPickerClick = { current: true };
    const openLink = vi.fn();
    const setCursor = vi.fn();
    const setHoveredLink = vi.fn();
    const executor = createCanvasClickExecutor({
      colorPickerClick,
      preventDefault: vi.fn(),
      clearSelections: vi.fn(),
      setSelectedStructuredNodeIds: vi.fn(),
      setSelectedStructuredSplitHandle: vi.fn(),
      setEditingStructuredTextNodeId: vi.fn(),
      setTextCursor: vi.fn(),
      setCursor,
      openLink,
      setHoveredLink,
    });

    executor.clearColorPickerClick();
    executor.setCursor("text");
    executor.openLink(linkHit.href);
    executor.setHoveredLink(linkHit);

    expect(colorPickerClick.current).toBe(false);
    expect(setCursor).toHaveBeenCalledWith("text");
    expect(openLink).toHaveBeenCalledWith(linkHit.href);
    expect(setHoveredLink).toHaveBeenCalledWith(linkHit);
  });

  it("creates click handlers that resolve and execute decisions", () => {
    const executor = createExecutor();
    const handler = createCanvasClickHandler({
      getColorPickerClickPending: () => false,
      getInteractionMode: () => "idle",
      canvasMode: "structured",
      tool: "text",
      executor,
    });
    const point = { x: 2, y: 3 };

    expect(
      handler({
        point,
        linkHit: null,
        shouldOpenLink: false,
        preventDefault: executor.preventDefault,
      })
    ).toBe(true);

    expect(executor.setTextCursor).toHaveBeenCalledWith(point);
    expect(executor.setCursor).toHaveBeenCalledWith("text");
  });

  it("creates click handlers that read pending color-picker clicks lazily", () => {
    const executor = createExecutor();
    let colorPickerClickPending = false;
    const handler = createCanvasClickHandler({
      getColorPickerClickPending: () => colorPickerClickPending,
      getInteractionMode: () => "idle",
      canvasMode: "freeform",
      tool: "select",
      executor,
    });

    colorPickerClickPending = true;

    expect(
      handler({
        point: null,
        linkHit: null,
        shouldOpenLink: false,
        preventDefault: executor.preventDefault,
      })
    ).toBe(true);

    expect(executor.clearColorPickerClick).toHaveBeenCalledTimes(1);
    expect(executor.preventDefault).toHaveBeenCalledTimes(1);
  });
});
