import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/domains/canvas/public";
import { GridManager } from "@/shared/utils/grid";
import { runCanvasTransaction, undoManager, yMainGrid } from "./yjs";

const initialState = useEditorStore.getState();

describe("slideSlice", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("keeps each slide grid isolated while switching pages", () => {
    useEditorStore.getState().createCanvasSession("slide", {
      slideSize: { columns: 3, rows: 2 },
    });
    const firstSlideId = useEditorStore.getState().slideDeck?.activeSlideId;
    expect(firstSlideId).toBeTruthy();

    runCanvasTransaction(() => {
      yMainGrid.set(GridManager.toKey(0, 0), { char: "A", color: "#000" });
    });
    useEditorStore.getState().addSlide();
    const secondSlideId = useEditorStore.getState().slideDeck?.activeSlideId;
    expect(secondSlideId).toBeTruthy();
    expect(secondSlideId).not.toBe(firstSlideId);

    runCanvasTransaction(() => {
      yMainGrid.set(GridManager.toKey(1, 0), { char: "B", color: "#000" });
    });

    useEditorStore.getState().activateSlide(firstSlideId!);
    expect(useEditorStore.getState().grid.get("0,0")?.char).toBe("A");
    expect(useEditorStore.getState().grid.has("1,0")).toBe(false);

    useEditorStore.getState().activateSlide(secondSlideId!);
    expect(useEditorStore.getState().grid.get("1,0")?.char).toBe("B");
    expect(useEditorStore.getState().grid.has("0,0")).toBe(false);
  });

  it("normalizes edits outside the finite slide page", () => {
    useEditorStore.getState().createCanvasSession("slide", {
      slideSize: { columns: 2, rows: 1 },
    });
    runCanvasTransaction(() => {
      yMainGrid.set("1,0", { char: "A", color: "#000" });
      yMainGrid.set("2,0", { char: "B", color: "#000" });
    });

    expect(Array.from(useEditorStore.getState().grid.keys())).toEqual(["1,0"]);
    expect(useEditorStore.getState().slideDeck?.slides[0].grid).toHaveLength(1);
  });

  it("keeps deck metadata changes outside the active slide history", () => {
    useEditorStore.getState().createCanvasSession("slide", {
      slideSize: { columns: 3, rows: 2 },
    });
    useEditorStore.getState().addSlide();
    const activeSlideId = useEditorStore.getState().slideDeck?.activeSlideId;
    expect(activeSlideId).toBeTruthy();

    runCanvasTransaction(() => {
      yMainGrid.set("0,0", { char: "A", color: "#000" });
    });
    expect(useEditorStore.getState().canUndo).toBe(true);
    expect(useEditorStore.getState().canRedo).toBe(false);

    useEditorStore.getState().renameSlide(activeSlideId!, "Renamed");
    useEditorStore.getState().moveSlide(activeSlideId!, 0);

    expect(useEditorStore.getState().canUndo).toBe(true);
    expect(useEditorStore.getState().canRedo).toBe(false);
    expect(undoManager.undo()).toBe(true);
    expect(useEditorStore.getState().grid.has("0,0")).toBe(false);
    expect(
      useEditorStore.getState().slideDeck?.slides.find((slide) => slide.id === activeSlideId)?.name
    ).toBe("Renamed");
    expect(useEditorStore.getState().slideDeck?.slides[0].id).toBe(activeSlideId);
  });

  it("resizes one slide and clears history only when content is cropped", () => {
    useEditorStore.getState().createCanvasSession("slide", {
      slideSize: { columns: 4, rows: 2 },
    });
    const firstSlideId = useEditorStore.getState().slideDeck!.activeSlideId;
    runCanvasTransaction(() => {
      yMainGrid.set("0,0", { char: "A", color: "#000" });
      yMainGrid.set("3,1", { char: "B", color: "#000" });
    });

    useEditorStore.getState().resizeSlide(firstSlideId, {
      columns: 6,
      rows: 3,
    });
    expect(useEditorStore.getState().canUndo).toBe(true);
    expect(useEditorStore.getState().slideDeck?.slides[0].size).toEqual({
      columns: 6,
      rows: 3,
    });

    useEditorStore.getState().resizeSlide(firstSlideId, {
      columns: 3,
      rows: 2,
    });
    expect(useEditorStore.getState().grid.has("3,1")).toBe(false);
    expect(useEditorStore.getState().grid.get("0,0")?.char).toBe("A");
    expect(useEditorStore.getState().canUndo).toBe(false);
  });

  it("crops an inactive slide without changing the active page size", () => {
    useEditorStore.getState().createCanvasSession("slide", {
      slideSize: { columns: 4, rows: 2 },
    });
    const firstSlideId = useEditorStore.getState().slideDeck!.activeSlideId;
    runCanvasTransaction(() => {
      yMainGrid.set("3,1", { char: "A", color: "#000" });
    });
    useEditorStore.getState().addSlide();
    const secondSlideId = useEditorStore.getState().slideDeck!.activeSlideId;

    useEditorStore.getState().resizeSlide(firstSlideId, {
      columns: 3,
      rows: 2,
    });
    expect(
      useEditorStore.getState().slideDeck?.slides.find(
        (slide) => slide.id === secondSlideId
      )?.size
    ).toEqual({ columns: 4, rows: 2 });

    useEditorStore.getState().activateSlide(firstSlideId);
    expect(useEditorStore.getState().grid.has("3,1")).toBe(false);
  });
});
