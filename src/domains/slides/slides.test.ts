import { describe, expect, it } from "vitest";
import type { GridCell } from "@/shared/types";
import {
  DEFAULT_SLIDE_SIZE,
  SLIDE_SIZE_PRESETS,
  activateSlide,
  addSlide,
  createSlideDeck,
  duplicateSlide,
  isSlideCellInBounds,
  isSlidePointInBounds,
  moveSlide,
  normalizeSlideGridEntries,
  removeSlide,
  renameSlide,
  resolveNextSlideName,
  updateSlideGrid,
} from "./public";

const createDeck = () => createSlideDeck({ initialSlideId: "slide-1" });

describe("slide deck model", () => {
  it("creates one active widescreen slide by default", () => {
    const deck = createDeck();

    expect(deck).toEqual({
      size: { columns: 100, rows: 27 },
      slides: [{ id: "slide-1", name: "Slide 1", grid: [] }],
      activeSlideId: "slide-1",
    });
    expect(deck.size).not.toBe(DEFAULT_SLIDE_SIZE);
    expect(SLIDE_SIZE_PRESETS.classic).toEqual({ columns: 80, rows: 24 });
  });

  it("rejects invalid initial identity and dimensions", () => {
    expect(() => createSlideDeck({ initialSlideId: " " })).toThrow(
      "non-empty initial slide ID"
    );
    expect(() =>
      createSlideDeck({
        initialSlideId: "slide-1",
        size: { columns: 0, rows: 24 },
      })
    ).toThrow("positive integer columns and rows");
  });

  it("adds after the active slide, activates it, and resolves names", () => {
    const first = createDeck();
    const second = addSlide(first, { id: "slide-2" });
    const third = addSlide(second, {
      id: "slide-3",
      name: "  Closing  ",
      afterSlideId: "slide-1",
    });

    expect(first.slides).toHaveLength(1);
    expect(second.slides.map((slide) => slide.name)).toEqual([
      "Slide 1",
      "Slide 2",
    ]);
    expect(third.slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-3",
      "slide-2",
    ]);
    expect(third.slides[1].name).toBe("Closing");
    expect(third.activeSlideId).toBe("slide-3");
    expect(resolveNextSlideName(third.slides)).toBe("Slide 3");
  });

  it("does not add duplicate IDs or target an unknown insertion point", () => {
    const deck = createDeck();

    expect(addSlide(deck, { id: "slide-1" })).toBe(deck);
    expect(
      addSlide(deck, { id: "slide-2", afterSlideId: "missing" })
    ).toBe(deck);
  });

  it("duplicates a slide after its source with a deep-cloned grid", () => {
    const attrs = { bold: true as const };
    const source = createSlideDeck({
      initialSlideId: "slide-1",
      initialGrid: [["2,3", { char: "A", color: "#fff", attrs }]],
    });
    const duplicated = duplicateSlide(source, {
      sourceSlideId: "slide-1",
      id: "slide-2",
    });

    expect(duplicated.slides.map((slide) => slide.name)).toEqual([
      "Slide 1",
      "Slide 2",
    ]);
    expect(duplicated.activeSlideId).toBe("slide-2");
    expect(duplicated.slides[1].grid).toEqual(duplicated.slides[0].grid);
    expect(duplicated.slides[1].grid).not.toBe(duplicated.slides[0].grid);
    expect(duplicated.slides[1].grid[0][1]).not.toBe(
      duplicated.slides[0].grid[0][1]
    );
    expect(duplicated.slides[1].grid[0][1].attrs).not.toBe(attrs);
  });

  it("keeps at least one slide and chooses the prior active neighbor", () => {
    const one = createDeck();
    const two = addSlide(one, { id: "slide-2" });
    const three = addSlide(two, { id: "slide-3" });

    const removedLast = removeSlide(three, "slide-3");
    expect(removedLast.slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-2",
    ]);
    expect(removedLast.activeSlideId).toBe("slide-2");

    const firstActive = activateSlide(removedLast, "slide-1");
    const removedFirst = removeSlide(firstActive, "slide-1");
    expect(removedFirst.activeSlideId).toBe("slide-2");
    expect(removeSlide(removedFirst, "slide-2")).toBe(removedFirst);
  });

  it("renames, activates, and moves slides without changing invalid targets", () => {
    const deck = addSlide(createDeck(), { id: "slide-2" });
    const renamed = renameSlide(deck, "slide-1", "  Intro  ");
    const moved = moveSlide(renamed, "slide-2", -10);

    expect(renamed.slides[0].name).toBe("Intro");
    expect(moved.slides.map((slide) => slide.id)).toEqual([
      "slide-2",
      "slide-1",
    ]);
    expect(activateSlide(moved, "missing")).toBe(moved);
    expect(renameSlide(moved, "slide-1", " ")).toBe(moved);
    expect(moveSlide(moved, "missing", 1)).toBe(moved);
    expect(moveSlide(moved, "slide-1", Number.NaN)).toBe(moved);
  });
});

describe("slide grid boundaries", () => {
  const size = { columns: 100, rows: 27 };

  it("checks points and wide-cell occupancy against finite bounds", () => {
    expect(isSlidePointInBounds({ x: 0, y: 0 }, size)).toBe(true);
    expect(isSlidePointInBounds({ x: -1, y: 0 }, size)).toBe(false);
    expect(isSlidePointInBounds({ x: 100, y: 0 }, size)).toBe(false);
    expect(
      isSlideCellInBounds({ x: 98, y: 26 }, { char: "界" }, size)
    ).toBe(true);
    expect(
      isSlideCellInBounds({ x: 99, y: 26 }, { char: "界" }, size)
    ).toBe(false);
  });

  it("filters overflow, canonicalizes keys, deduplicates, and sorts", () => {
    const entries: Array<[string, GridCell]> = [
      ["3,2", { char: "A", color: "#111" }],
      ["01,0", { char: "B", color: "#222" }],
      ["1,0", { char: "C", color: "#333" }],
      ["-1,0", { char: "D", color: "#444" }],
      ["0,27", { char: "E", color: "#555" }],
      ["99,0", { char: "界", color: "#666" }],
      ["not-a-key", { char: "F", color: "#777" }],
      ["2,1,9", { char: "G", color: "#888" }],
    ];

    expect(normalizeSlideGridEntries(entries, size)).toEqual([
      ["1,0", { char: "C", color: "#333" }],
      ["3,2", { char: "A", color: "#111" }],
    ]);
  });

  it("updates only the target slide with normalized cloned cells", () => {
    const deck = addSlide(createDeck(), { id: "slide-2" });
    const attrs = { italic: true as const };
    const cell: GridCell = { char: "Z", color: "#abc", attrs };
    const updated = updateSlideGrid(deck, "slide-1", [
      ["4,5", cell],
      ["100,5", { char: "X", color: "#000" }],
    ]);

    expect(updated.slides[0].grid).toEqual([["4,5", cell]]);
    expect(updated.slides[0].grid[0][1]).not.toBe(cell);
    expect(updated.slides[0].grid[0][1].attrs).not.toBe(attrs);
    expect(updated.slides[1]).toBe(deck.slides[1]);
    expect(updateSlideGrid(deck, "missing", [])).toBe(deck);
  });
});
