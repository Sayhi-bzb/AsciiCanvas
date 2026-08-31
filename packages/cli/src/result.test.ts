import type { ParsedCharDeskText } from "@chardesk/protocol";
import { describe, expect, it } from "vitest";
import { projectCharDeskResult } from "./result.js";

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

describe("plain text result projection", () => {
  it("projects protocol cells with absolute rulers and row coordinates", () => {
    const result = projectCharDeskResult(document(14, 3, [
      { x: 0, y: 0, width: 1, text: "A" },
      { x: 2, y: 0, width: 2, text: "界" },
      { x: 10, y: 2, width: 1, text: "Z" },
    ]));

    expect(result.text).toContain("0         10");
    expect(result.text).toContain("01234567890123");
    expect(result.text).toContain("0 │ A 界");
    expect(result.text).toContain("2 │           Z");
    expect(result.omitted).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(result.styleText).toBeUndefined();
  });

  it("uses a bounded default view and keeps a boundary-wide cell intact", () => {
    const result = projectCharDeskResult(document(120, 40, [
      { x: 95, y: 0, width: 2, text: "界" },
    ]));

    expect(result.view).toEqual({ x: 0, y: 0, columns: 97, rows: 32 });
    expect(result.omitted).toEqual({ left: 0, right: 23, top: 0, bottom: 8 });
    expect(result.text.split("\n")[2]).toContain("界");
  });

  it("clamps explicit regions and can omit rulers", () => {
    const result = projectCharDeskResult(document(8, 5, [
      { x: 6, y: 4, width: 1, text: "X" },
    ]), {
      region: { x: 5, y: 3, columns: 10, rows: 10 },
      ruler: false,
    });

    expect(result.view).toEqual({ x: 5, y: 3, columns: 3, rows: 2 });
    expect(result.text).toBe("\n X");
    expect(result.omitted).toEqual({ left: 5, right: 0, top: 3, bottom: 0 });
  });

  it("deduplicates styles and merges adjacent protocol-width cells", () => {
    const result = projectCharDeskResult(document(8, 2, [
      {
        x: 0,
        y: 0,
        width: 2,
        text: "界",
        color: "#0969da",
        attrs: { bold: true },
      },
      {
        x: 2,
        y: 0,
        width: 1,
        text: "A",
        color: "#0969da",
        attrs: { bold: true },
      },
      {
        x: 3,
        y: 0,
        width: 1,
        text: " ",
        bgColor: "#ffffff",
        attrs: { inverse: true },
        href: "https://chardesk.com/a b",
      },
      { x: 4, y: 0, width: 1, text: "P" },
      {
        x: 0,
        y: 1,
        width: 2,
        text: "界",
        color: "#0969da",
        attrs: { bold: true },
      },
      {
        x: 2,
        y: 1,
        width: 1,
        text: "B",
        color: "#0969da",
        attrs: { bold: true },
      },
    ]), { styles: true });

    expect(result.styleText).toBe([
      "styles:",
      "  0-1:0-2{fg:#0969da;bold}",
      "  0:3{bg:#ffffff;inverse;link:\"https://chardesk.com/a b\"}",
    ].join("\n"));
    expect(result.styleText).not.toMatch(/\b[xy]=|style-runs|\bs\d/);
  });

  it("bounds style evidence and asks callers to narrow the region", () => {
    const cells = Array.from({ length: 300 }, (_, x) => ({
      x,
      y: 0,
      width: 1 as const,
      text: "x",
      color: x % 2 === 0 ? "#000000" : "#ffffff",
    }));
    const result = projectCharDeskResult(document(300, 1, cells), {
      region: { x: 0, y: 0, columns: 300, rows: 1 },
      styles: true,
    });

    expect(result.styleText).toContain("styles:256/300 regions · narrow --region");
    expect(result.styleText).toContain("{fg:#000000}");
    expect(result.styleText).toContain("{fg:#ffffff}");
    expect(result.styleText).not.toContain("0:256{");
  });
});
