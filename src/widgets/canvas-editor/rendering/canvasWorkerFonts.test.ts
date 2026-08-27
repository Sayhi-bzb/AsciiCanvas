import { describe, expect, it } from "vitest";
import {
  canvasWorkerFontFaceCovers,
  getCanvasWorkerFontRevision,
  parseCanvasWorkerFontRanges,
} from "./canvasWorkerFonts";

describe("canvas worker fonts", () => {
  it("parses individual and ranged CSS unicode descriptors", () => {
    expect(parseCanvasWorkerFontRanges("U+20-7E, U+4E00-9FFF")).toEqual([
      { from: 0x20, to: 0x7e },
      { from: 0x4e00, to: 0x9fff },
    ]);
  });

  it("matches a face when any grapheme code point is covered", () => {
    const face = { unicodeRange: "U+20-7E" };
    expect(canvasWorkerFontFaceCovers(face, [0x41])).toBe(true);
    expect(canvasWorkerFontFaceCovers(face, [0xd55c])).toBe(false);
  });

  it("changes the revision when a font asset changes", () => {
    const face = {
      id: "regular",
      family: "Maple Mono NF CN",
      sourceUrl: "https://example.test/regular.woff2",
      weight: "400",
      style: "normal",
    };
    expect(getCanvasWorkerFontRevision([face])).not.toBe(
      getCanvasWorkerFontRevision([{ ...face, id: "updated" }])
    );
  });
});
