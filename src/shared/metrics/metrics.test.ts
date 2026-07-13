import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawCellBackground,
  drawCellText,
  getCellOccupancy,
  getTextCellWidth,
  gridCellRect,
  gridToScreen,
  isWideCell,
  screenToGrid,
  splitGraphemes,
} from "@/shared/metrics";

describe("metrics", () => {
  describe("splitGraphemes", () => {
    it("keeps combining marks and emoji modifiers together", () => {
      expect(splitGraphemes("e\u0301x")).toEqual(["e\u0301", "x"]);
      expect(splitGraphemes("👋🏽x")).toEqual(["👋🏽", "x"]);
    });

    it("keeps zwj emoji clusters together when Intl.Segmenter supports them", () => {
      expect(splitGraphemes("👨‍👩‍👧‍👦x")[0]).toBe("👨‍👩‍👧‍👦");
    });
  });

  describe("cell occupancy", () => {
    it("treats ASCII as one cell", () => {
      expect(getCellOccupancy("A")).toBe(1);
      expect(getTextCellWidth("abc")).toBe(3);
    });

    it("treats CJK and emoji as wide cells, and private-use glyphs as narrow cells", () => {
      expect(getCellOccupancy("你")).toBe(2);
      expect(getCellOccupancy("👋")).toBe(2);
      expect(getCellOccupancy("\ue0b0")).toBe(1);
      expect(isWideCell("你")).toBe(true);
      expect(isWideCell("\ue0b0")).toBe(false);
    });

    it("sums mixed text by grapheme occupancy", () => {
      expect(getTextCellWidth("A你👋")).toBe(5);
    });
  });

  describe("viewport conversion", () => {
    it("converts grid and screen coordinates through shared metrics", () => {
      const viewport = { offset: { x: 10, y: 20 }, zoom: 2 };
      const screen = gridToScreen(3, 4, viewport);
      expect(screen).toEqual({
        x: 10 + 3 * DEFAULT_GRID_RENDER_METRICS.cellWidth * 2,
        y: 20 + 4 * DEFAULT_GRID_RENDER_METRICS.cellHeight * 2,
      });
      expect(screenToGrid(screen.x, screen.y, viewport)).toEqual({ x: 3, y: 4 });
    });

    it("returns cell rects from the same viewport model", () => {
      const rect = gridCellRect(
        { x: 2, y: 3 },
        { offset: { x: 5, y: 7 }, zoom: 1.5 }
      );
      expect(rect).toEqual({
        x: 5 + 2 * DEFAULT_GRID_RENDER_METRICS.cellWidth * 1.5,
        y: 7 + 3 * DEFAULT_GRID_RENDER_METRICS.cellHeight * 1.5,
        width: DEFAULT_GRID_RENDER_METRICS.cellWidth * 1.5,
        height: DEFAULT_GRID_RENDER_METRICS.cellHeight * 1.5,
      });
    });
  });

  describe("cell rendering passes", () => {
    const createContext = () =>
      ({
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        set fillStyle(_value: string) {},
        set font(_value: string) {},
        set textBaseline(_value: CanvasTextBaseline) {},
        set textAlign(_value: CanvasTextAlign) {},
        set strokeStyle(_value: string) {},
        set lineWidth(_value: number) {},
      }) as unknown as CanvasRenderingContext2D;

    it("keeps background drawing separate from glyph drawing", () => {
      const ctx = createContext();
      const cell = { char: "\ue0b0", color: "#111111", bgColor: "#eeeeee" };

      drawCellBackground(ctx, cell, 0, 0);
      drawCellText(ctx, cell, 0, 0);

      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
      expect(ctx.fillText).toHaveBeenCalledTimes(1);
      expect(ctx.fillRect).toHaveBeenCalledWith(
        0,
        0,
        DEFAULT_GRID_RENDER_METRICS.cellWidth,
        DEFAULT_GRID_RENDER_METRICS.cellHeight
      );
    });

    it("draws text decorations in the text pass without repainting background", () => {
      const ctx = createContext();
      const cell = {
        char: "A",
        color: "#111111",
        bgColor: "#eeeeee",
        attrs: { underline: true, strike: true } as const,
      };

      drawCellText(ctx, cell, 0, 0);

      expect(ctx.fillRect).not.toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledTimes(1);
      expect(ctx.stroke).toHaveBeenCalledTimes(2);
    });
  });
});
