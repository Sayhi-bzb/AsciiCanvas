import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEMO_GRID,
  buildDefaultDemoGrid,
  extractAsciiCodeBlocks,
} from "@/domains/canvas/state/helpers/defaultDemo";
import { DEFAULT_SESSION_ID } from "@/domains/canvas/state/helpers/storeUtils";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { GridManager } from "@/shared/utils/grid";

describe("default demo canvas", () => {
  it("extracts only ascii fenced blocks from markdown", () => {
    expect(
      extractAsciiCodeBlocks(
        [
          "# Heading",
          "```ascii",
          "[38;2;255;0;0mA[0m",
          "```",
          "```text",
          "ignored",
          "```",
          "```ascii",
          "B",
          "```",
        ].join("\n")
      )
    ).toEqual(["[38;2;255;0;0mA[0m", "B"]);
  });

  it("builds a single freeform grid from ascii blocks with spacing between blocks", () => {
    const grid = buildDefaultDemoGrid(
      [
        "```ascii",
        "[38;2;255;0;0mA[0m",
        "```",
        "```ascii",
        "[1;38;2;0;255;0mB[0m",
        "```",
      ].join("\n")
    );

    expect(grid).toEqual([
      ["0,0", { char: "A", color: "#ff0000" }],
      ["0,2", { char: "B", color: "#00ff00", attrs: { bold: true } }],
    ]);
  });

  it("uses case/demo.md as the default first canvas", () => {
    const state = useCanvasStore.getState();
    const firstSession = state.canvasSessions.find(
      (session) => session.id === DEFAULT_SESSION_ID
    );

    expect(DEFAULT_DEMO_GRID.length).toBeGreaterThan(0);
    expect(firstSession?.grid).toEqual(DEFAULT_DEMO_GRID);
    expect(state.grid).toEqual(new Map(DEFAULT_DEMO_GRID));
    expect(state.grid.get(GridManager.toKey(1, 0))).toEqual({
      char: "█",
      color: "#f54954",
    });
    expect(state.grid.get(GridManager.toKey(5, 7))).toEqual({
      char: "N",
      color: "#2563eb",
      attrs: { bold: true },
    });
  });
});
