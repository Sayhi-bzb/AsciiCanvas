import { describe, expect, it } from "vitest";
import {
  buildCharDeskExportDocument,
  exportSelectionToString,
  exportToAnsi,
} from "@/domains/export/public";

describe("export formats", () => {
  it("builds a freeform project document", () => {
    const document = buildCharDeskExportDocument({
      canvasMode: "freeform",
      grid: new Map([["0,0", { char: "A", color: "#ffffff" }]]),
      structuredScene: [],
      structuredComponents: [],
    });
    expect(document.mode).toBe("freeform");
  });

  it("exports static text selections and ANSI text", () => {
    const grid = new Map([["0,0", { char: "A", color: "#ffffff" }]]);
    expect(exportSelectionToString(grid, [{ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }])).toBe("A");
    expect(exportToAnsi(grid)).toContain("A");
  });
});
