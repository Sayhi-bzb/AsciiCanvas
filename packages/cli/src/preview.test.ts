import type { ParsedCharDeskText } from "@chardesk/protocol";
import { describe, expect, it } from "vitest";
import { projectCharDeskPreview } from "./preview.js";

const document = (
  width: number,
  height: number,
  cells: ParsedCharDeskText["cells"],
): ParsedCharDeskText => ({
  version: 1,
  source: "",
  plainText: "",
  width,
  height,
  cells,
  hasAnsi: false,
  ansiEvidence: "none",
  diagnostics: [],
});

describe("terminal preview projection", () => {
  it("preserves the full plain grid including trailing and empty cells", () => {
    const result = projectCharDeskPreview(document(4, 2, [
      { x: 0, y: 0, width: 1, text: "A" },
      { x: 1, y: 0, width: 2, text: "界" },
    ]), {
      maximumColumns: 4,
      maximumRows: 2,
      color: false,
    });

    expect(result.text).toBe("A界 \n    ");
    expect(result.view).toEqual({ x: 0, y: 0, columns: 4, rows: 2 });
    expect(result.omitted).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });

  it("inherits terminal colors while preserving explicit styles and links", () => {
    const result = projectCharDeskPreview(document(3, 1, [
      {
        x: 0,
        y: 0,
        width: 1,
        text: "A",
        color: "#800000",
        attrs: { bold: true, underline: true },
        href: "https://chardesk.com",
      },
    ]), {
      maximumColumns: 3,
      maximumRows: 1,
      color: true,
    });

    expect(result.text).toContain("\u001b[1;4;38;2;128;0;0m");
    expect(result.text).toContain("\u001b]8;;https://chardesk.com\u001b\\A");
    expect(result.text).not.toContain("48;2;255;255;255");
    expect(result.text).not.toContain("38;2;31;35;40");
    expect(result.text).toContain("\u001b[0m");
    expect(result.text.endsWith("  ")).toBe(true);
  });

  it("normalizes Canvas defaults but keeps authored backgrounds", () => {
    const result = projectCharDeskPreview(document(3, 1, [
      {
        x: 0,
        y: 0,
        width: 1,
        text: "A",
        color: "#1f2328",
        bgColor: "#ffffff",
      },
      {
        x: 1,
        y: 0,
        width: 1,
        text: "B",
        bgColor: "#001122",
      },
    ]), {
      maximumColumns: 3,
      maximumRows: 1,
      color: true,
    });

    expect(result.text).not.toContain("48;2;255;255;255");
    expect(result.text).not.toContain("38;2;31;35;40");
    expect(result.text).toContain("48;2;0;17;34");
  });

  it("shrinks the right edge rather than splitting a wide cell", () => {
    const board = document(5, 1, [
      { x: 0, y: 0, width: 1, text: "A" },
      { x: 1, y: 0, width: 1, text: "B" },
      { x: 2, y: 0, width: 2, text: "界" },
      { x: 4, y: 0, width: 1, text: "Z" },
    ]);
    const cropped = projectCharDeskPreview(board, {
      maximumColumns: 3,
      maximumRows: 1,
      color: false,
    });
    expect(cropped.text).toBe("AB");
    expect(cropped.view).toEqual({ x: 0, y: 0, columns: 2, rows: 1 });
    expect(cropped.omitted.right).toBe(3);

    const fromInside = projectCharDeskPreview(board, {
      region: { x: 3, y: 0, columns: 2, rows: 1 },
      maximumColumns: 2,
      maximumRows: 1,
      color: false,
    });
    expect(fromInside.text).toBe("界");
    expect(fromInside.view).toEqual({ x: 2, y: 0, columns: 2, rows: 1 });
  });
});
