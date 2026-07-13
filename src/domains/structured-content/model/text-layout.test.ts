import { describe, expect, it } from "vitest";
import {
  createTextLayout,
  getTextLayoutCaretPoint,
  getTextLayoutOffsetAtPoint,
  getTextLayoutSelectionRects,
  getTextLayoutSurfaceCells,
} from "@/domains/structured-content/public";

describe("textLayout", () => {
  it("maps ASCII offsets and points", () => {
    const layout = createTextLayout("Edit", { x: 2, y: 3 });

    expect(getTextLayoutCaretPoint(layout, 0)).toEqual({ x: 2, y: 3 });
    expect(getTextLayoutCaretPoint(layout, 4)).toEqual({ x: 6, y: 3 });
    expect(getTextLayoutOffsetAtPoint(layout, { x: 4, y: 3 })).toBe(2);
    expect(getTextLayoutOffsetAtPoint(layout, { x: 7, y: 3 })).toBe(4);
  });

  it("moves caret by display width for CJK and emoji", () => {
    const layout = createTextLayout("你👋A", { x: 0, y: 0 });

    expect(getTextLayoutCaretPoint(layout, 1)).toEqual({ x: 2, y: 0 });
    expect(getTextLayoutCaretPoint(layout, 2)).toEqual({ x: 4, y: 0 });
    expect(getTextLayoutCaretPoint(layout, 3)).toEqual({ x: 5, y: 0 });
    expect(getTextLayoutOffsetAtPoint(layout, { x: 4, y: 0 })).toBe(2);
  });

  it("keeps newline offsets on their next line", () => {
    const layout = createTextLayout("AB\nCD", { x: 1, y: 2 });

    expect(getTextLayoutCaretPoint(layout, 3)).toEqual({ x: 1, y: 3 });
    expect(getTextLayoutOffsetAtPoint(layout, { x: 2, y: 3 })).toBe(4);
  });

  it("maps line-end and empty-line clicks to editable offsets", () => {
    const layout = createTextLayout("AB\n\nCD", { x: 1, y: 2 });

    expect(getTextLayoutOffsetAtPoint(layout, { x: 3, y: 2 })).toBe(2);
    expect(getTextLayoutOffsetAtPoint(layout, { x: 1, y: 3 })).toBe(3);
    expect(getTextLayoutCaretPoint(layout, 3)).toEqual({ x: 1, y: 3 });
  });

  it("creates selection rects from grapheme runs", () => {
    const layout = createTextLayout("A你B", { x: 0, y: 0 });

    expect(getTextLayoutSelectionRects(layout, 1, 2)).toEqual([
      { point: { x: 1, y: 0 }, width: 2 },
    ]);
  });

  it("marks wide-character follower surface cells", () => {
    const layout = createTextLayout("你A", { x: 3, y: 4 });
    const cells = getTextLayoutSurfaceCells(layout, () => ({ color: "#ffffff" }));

    expect(cells).toMatchObject([
      { x: 3, y: 4, char: "你", offset: 0 },
      { x: 4, y: 4, char: " ", offset: 0, follower: true },
      { x: 5, y: 4, char: "A", offset: 1 },
    ]);
  });
});
