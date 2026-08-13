import { describe, expect, it } from "vitest";
import { createCharDeskRenderModel } from "./render-model.js";

describe("createCharDeskRenderModel", () => {
  it("preserves Unicode layout and cell widths", () => {
    const model = createCharDeskRenderModel("A界🙂\n└─┘");

    expect(model.document).toMatchObject({ width: 5, height: 2 });
    expect(model.document.cells.map(({ text, width }) => ({ text, width }))).toEqual([
      { text: "A", width: 1 },
      { text: "界", width: 2 },
      { text: "🙂", width: 2 },
      { text: "└", width: 1 },
      { text: "─", width: 1 },
      { text: "┘", width: 1 },
    ]);
  });

  it("coalesces adjacent cells with the same presentation", () => {
    const model = createCharDeskRenderModel(
      "[31mRED[1m![0m plain",
      { syntax: "ansi" }
    );

    expect(model.rows[0]?.runs).toEqual([
      { text: "RED", color: "#800000" },
      {
        text: "!",
        color: "#800000",
        attrs: { bold: true },
      },
      { text: " plain" },
    ]);
    expect(model.rows[0]?.runs).toHaveLength(3);
  });

  it("retains empty rows and expands tabs through the protocol", () => {
    const model = createCharDeskRenderModel("A\n\n\tB");

    expect(model.rows).toHaveLength(3);
    expect(model.rows[1]?.runs).toEqual([]);
    expect(model.rows[2]?.runs.map((run) => run.text).join(""))
      .toBe("    B");
    expect(model.document.plainText).toBe("A\n\n    B");
  });
});
