import { describe, expect, it } from "vitest";
import boxDrawing from "../../../../public/data/box_drawing.json";
import emojis from "../../../../public/data/emojis_enriched.json";
import unicodeBlocks from "../../../../public/data/unicode_blocks.json";

describe("generated character data", () => {
  const isControlCharacter = (char: string) => {
    const codePoint = char.codePointAt(0);
    return (
      codePoint !== undefined &&
      ((codePoint >= 0x00 && codePoint <= 0x1f) ||
        (codePoint >= 0x7f && codePoint <= 0x9f))
    );
  };

  it("contains Box Drawing characters from the Unicode block", async () => {
    expect(boxDrawing["Box Drawing"]).toEqual(
      expect.arrayContaining(["─", "│", "┌", "┼", "╬"])
    );
  });

  it("contains Unicode blocks without control or surrogate code points", async () => {
    const chars = Object.values(unicodeBlocks).flat();

    expect(unicodeBlocks["Basic Latin"]).toEqual(expect.arrayContaining(["A", "z"]));
    expect(unicodeBlocks["Box Drawing"]).toEqual(
      expect.arrayContaining(["─", "╬"])
    );
    expect(chars.some(isControlCharacter)).toBe(false);
    expect(
      chars.some((char) => {
        const codePoint = char.codePointAt(0);
        return codePoint !== undefined && codePoint >= 0xd800 && codePoint <= 0xdfff;
      })
    ).toBe(false);
  });

  it("keeps emoji grouped by Unicode emoji-test group and subgroup", async () => {
    expect(emojis["Smileys & Emotion"]["face-smiling"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "grinning face", char: "😀" }),
      ])
    );
  });
});
