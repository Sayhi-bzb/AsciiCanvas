import { describe, expect, it } from "vitest";
import {
  BoxConnection,
  getBoxGlyphTopology,
  glyphForBoxCorner,
  glyphForBoxConnections,
  mergeBoxDrawingGlyphs,
} from "./box-drawing.js";

const LIGHT_GLYPHS = [
  "╵",
  "╶",
  "└",
  "╷",
  "│",
  "┌",
  "├",
  "╴",
  "┘",
  "─",
  "┴",
  "┐",
  "┤",
  "┬",
  "┼",
] as const;

const merge = (first: string, second: string) => {
  const merged = mergeBoxDrawingGlyphs(first, second);
  expect(merged).not.toBeNull();
  return merged!;
};

describe("box-drawing topology", () => {
  it("defaults outer corners to rounded with an explicit square opt-out", () => {
    const mask = BoxConnection.right | BoxConnection.down;
    expect(glyphForBoxCorner(mask)).toBe("╭");
    expect(glyphForBoxCorner(mask, { rounded: false })).toBe("┌");
    expect(glyphForBoxCorner(mask, { useAscii: true })).toBe("+");
  });

  it("merges every light glyph pair from their connection union", () => {
    for (const first of LIGHT_GLYPHS) {
      for (const second of LIGHT_GLYPHS) {
        const firstMask = getBoxGlyphTopology(first)!.mask;
        const secondMask = getBoxGlyphTopology(second)!.mask;

        expect(merge(first, second)).toBe(glyphForBoxConnections(firstMask | secondMask));
      }
    }
  });

  it("is commutative, associative, and idempotent", () => {
    for (const first of LIGHT_GLYPHS) {
      expect(merge(first, first)).toBe(first);
      for (const second of LIGHT_GLYPHS) {
        expect(merge(first, second)).toBe(merge(second, first));
        for (const third of LIGHT_GLYPHS) {
          expect(merge(merge(first, second), third)).toBe(
            merge(first, merge(second, third))
          );
        }
      }
    }
  });

  it("preserves rounded corners until another arm creates a junction", () => {
    expect(merge("╭", "╶")).toBe("╭");
    expect(merge("╭", "┌")).toBe("┌");
    expect(merge("╭", "╴")).toBe("┬");
    expect(merge("╭", "│")).toBe("├");
  });

  it("composes split-box layers independently of drawing order", () => {
    const width = 11;
    const height = 5;
    const blank = () => Array.from({ length: height }, () => Array(width).fill(" "));
    const outer = blank();
    const horizontal = blank();
    const vertical = blank();

    outer[0] = [..."╭─────────╮"];
    outer[4] = [..."╰─────────╯"];
    for (let y = 1; y < 4; y++) {
      outer[y]![0] = "│";
      outer[y]![10] = "│";
    }
    for (const y of [1, 3]) {
      horizontal[y]![0] = "╶";
      horizontal[y]![10] = "╴";
      for (let x = 1; x < 10; x++) horizontal[y]![x] = "─";
    }
    vertical[1]![4] = "╷";
    vertical[2]![4] = "│";
    vertical[3]![4] = "╵";

    const compose = (layers: string[][][]) => {
      const result = blank();
      for (const layer of layers) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const next = layer[y]![x]!;
            if (next === " ") continue;
            const current = result[y]![x]!;
            result[y]![x] = current === " " ? next : merge(current, next);
          }
        }
      }
      return result.map((row) => row.join(""));
    };
    const expected = [
      "╭─────────╮",
      "├───┬─────┤",
      "│   │     │",
      "├───┴─────┤",
      "╰─────────╯",
    ];

    expect(compose([outer, horizontal, vertical])).toEqual(expected);
    expect(compose([vertical, outer, horizontal])).toEqual(expected);
  });
});
