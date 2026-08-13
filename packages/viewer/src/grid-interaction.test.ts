import { describe, expect, it } from "vitest";
import { parseCharDeskText } from "@chardesk/protocol";
import {
  createCharDeskGridIndex,
  createCharDeskGridSelection,
  getCharDeskGridSelectionText,
  hitTestCharDeskGridPoint,
  moveCharDeskGridPoint,
  normalizeCharDeskGridPoint,
} from "./grid-interaction.js";

const setup = (source: string) =>
  createCharDeskGridIndex(parseCharDeskText(source));

describe("grid interaction model", () => {
  it("clamps points to the document", () => {
    const index = setup("abc\ndef");
    expect(normalizeCharDeskGridPoint(index, { x: 99, y: -1 })).toEqual({
      x: 2,
      y: 0,
    });
  });

  it("rejects pointer hits outside the document grid", () => {
    const index = setup("abc\ndef");
    expect(hitTestCharDeskGridPoint(index, { x: -0.1, y: 0 })).toBeNull();
    expect(hitTestCharDeskGridPoint(index, { x: 0, y: -0.1 })).toBeNull();
    expect(hitTestCharDeskGridPoint(index, { x: 3, y: 0 })).toBeNull();
    expect(hitTestCharDeskGridPoint(index, { x: 0, y: 2 })).toBeNull();
  });

  it("hits empty cells inside the document grid", () => {
    const index = setup("A\n  C");
    expect(hitTestCharDeskGridPoint(index, { x: 1, y: 0 })).toEqual({
      x: 1,
      y: 0,
    });
  });

  it("normalizes and navigates across wide characters", () => {
    const index = setup("A界B");
    expect(normalizeCharDeskGridPoint(index, { x: 2, y: 0 })).toEqual({
      x: 1,
      y: 0,
    });
    expect(hitTestCharDeskGridPoint(index, { x: 2, y: 0 })).toEqual({
      x: 1,
      y: 0,
    });
    expect(moveCharDeskGridPoint(index, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual({
      x: 3,
      y: 0,
    });
    expect(moveCharDeskGridPoint(index, { x: 3, y: 0 }, { x: -1, y: 0 })).toEqual({
      x: 1,
      y: 0,
    });
  });

  it("expands a rectangle to include complete wide characters", () => {
    const index = setup("A界B\n1234");
    const selection = createCharDeskGridSelection(
      index,
      { x: 2, y: 0 },
      { x: 2, y: 1 }
    );
    expect(selection?.rect).toEqual({ left: 1, top: 0, right: 2, bottom: 1 });
    expect(getCharDeskGridSelectionText(index, selection!)).toBe("界\n23");
  });

  it("preserves empty columns and trailing spaces in rectangular copies", () => {
    const index = setup("A\n  C");
    const selection = createCharDeskGridSelection(
      index,
      { x: 0, y: 0 },
      { x: 2, y: 1 }
    );
    expect(getCharDeskGridSelectionText(index, selection!)).toBe("A  \n  C");
  });
});
