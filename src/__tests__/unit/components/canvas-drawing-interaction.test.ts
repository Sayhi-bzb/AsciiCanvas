import { describe, expect, it, vi } from "vitest";
import {
  createDrawingUpdateHandler,
  resolveDrawingUpdateDecision,
} from "@/domains/canvas/components/AsciiCanvas/hooks/interaction/gestures/drawingInteraction";
import type { Point } from "@/shared/types";

describe("drawing interaction updates", () => {
  it("does nothing without a previous grid point", () => {
    expect(
      resolveDrawingUpdateDecision({
        tool: "brush",
        brushChar: "A",
        lastGrid: null,
        currentGrid: { x: 1, y: 1 },
        lastPlacedGrid: null,
      })
    ).toEqual({ type: "none" });
  });

  it("does nothing when the grid point has not changed", () => {
    expect(
      resolveDrawingUpdateDecision({
        tool: "eraser",
        brushChar: "A",
        lastGrid: { x: 1, y: 1 },
        currentGrid: { x: 1, y: 1 },
        lastPlacedGrid: null,
      })
    ).toEqual({ type: "none" });
  });

  it("creates scratch points for single-width brush drawing", () => {
    expect(
      resolveDrawingUpdateDecision({
        tool: "brush",
        brushChar: "A",
        lastGrid: { x: 0, y: 0 },
        currentGrid: { x: 2, y: 0 },
        lastPlacedGrid: null,
      })
    ).toEqual({
      type: "scratch",
      points: [
        { x: 0, y: 0, char: "A" },
        { x: 1, y: 0, char: "A" },
        { x: 2, y: 0, char: "A" },
      ],
      nextLastGrid: { x: 2, y: 0 },
      nextLastPlacedGrid: null,
    });
  });

  it("filters wide brush points by character occupancy", () => {
    expect(
      resolveDrawingUpdateDecision({
        tool: "brush",
        brushChar: "界",
        lastGrid: { x: 0, y: 0 },
        currentGrid: { x: 3, y: 0 },
        lastPlacedGrid: null,
      })
    ).toEqual({
      type: "scratch",
      points: [
        { x: 0, y: 0, char: "界" },
        { x: 2, y: 0, char: "界" },
      ],
      nextLastGrid: { x: 3, y: 0 },
      nextLastPlacedGrid: { x: 2, y: 0 },
    });
  });

  it("continues wide brush filtering from the previous placed point", () => {
    expect(
      resolveDrawingUpdateDecision({
        tool: "brush",
        brushChar: "界",
        lastGrid: { x: 2, y: 0 },
        currentGrid: { x: 4, y: 0 },
        lastPlacedGrid: { x: 2, y: 0 },
      })
    ).toMatchObject({
      type: "scratch",
      points: [{ x: 4, y: 0, char: "界" }],
      nextLastPlacedGrid: { x: 4, y: 0 },
    });
  });

  it("creates erase points for eraser drawing", () => {
    expect(
      resolveDrawingUpdateDecision({
        tool: "eraser",
        brushChar: "A",
        lastGrid: { x: 0, y: 0 },
        currentGrid: { x: 2, y: 0 },
        lastPlacedGrid: { x: 0, y: 0 },
      })
    ).toEqual({
      type: "erase",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      nextLastGrid: { x: 2, y: 0 },
      nextLastPlacedGrid: { x: 0, y: 0 },
    });
  });
  it("executes scratch updates and advances drawing refs", () => {
    const addScratchPoints = vi.fn();
    const erasePoints = vi.fn();
    const lastGrid: { current: Point | null } = { current: { x: 0, y: 0 } };
    const lastPlacedGrid: { current: Point | null } = { current: null };
    const handleDrawing = createDrawingUpdateHandler({
      getTool: () => "brush",
      getBrushChar: () => "A",
      lastGrid,
      lastPlacedGrid,
      executor: { addScratchPoints, erasePoints },
    });

    handleDrawing({ x: 2, y: 0 });

    expect(addScratchPoints).toHaveBeenCalledWith([
      { x: 0, y: 0, char: "A" },
      { x: 1, y: 0, char: "A" },
      { x: 2, y: 0, char: "A" },
    ]);
    expect(erasePoints).not.toHaveBeenCalled();
    expect(lastGrid.current).toEqual({ x: 2, y: 0 });
    expect(lastPlacedGrid.current).toBeNull();
  });

  it("executes erase updates and preserves placement refs", () => {
    const addScratchPoints = vi.fn();
    const erasePoints = vi.fn();
    const lastGrid: { current: Point | null } = { current: { x: 0, y: 0 } };
    const lastPlacedGrid: { current: Point | null } = {
      current: { x: 0, y: 0 },
    };
    const handleDrawing = createDrawingUpdateHandler({
      getTool: () => "eraser",
      getBrushChar: () => "A",
      lastGrid,
      lastPlacedGrid,
      executor: { addScratchPoints, erasePoints },
    });

    handleDrawing({ x: 0, y: 2 });

    expect(addScratchPoints).not.toHaveBeenCalled();
    expect(erasePoints).toHaveBeenCalledWith([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
    expect(lastGrid.current).toEqual({ x: 0, y: 2 });
    expect(lastPlacedGrid.current).toEqual({ x: 0, y: 0 });
  });

  it("skips drawing side effects when no update decision is produced", () => {
    const addScratchPoints = vi.fn();
    const erasePoints = vi.fn();
    const lastGrid: { current: Point | null } = { current: null };
    const lastPlacedGrid: { current: Point | null } = { current: null };
    const handleDrawing = createDrawingUpdateHandler({
      getTool: () => "brush",
      getBrushChar: () => "A",
      lastGrid,
      lastPlacedGrid,
      executor: { addScratchPoints, erasePoints },
    });

    handleDrawing({ x: 2, y: 0 });

    expect(addScratchPoints).not.toHaveBeenCalled();
    expect(erasePoints).not.toHaveBeenCalled();
    expect(lastGrid.current).toBeNull();
    expect(lastPlacedGrid.current).toBeNull();
  });
});
