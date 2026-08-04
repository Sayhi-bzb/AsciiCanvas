import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ASCII_CANVAS_TEXT_PROTOCOL_VERSION,
  getGraphemeCellWidth,
  parseAsciiCanvasText,
  splitGraphemes,
  stripAsciiCanvasAnsi,
  UNICODE_DATA_VERSION,
} from "./index.js";
import type {
  ParseAsciiCanvasTextOptions,
  ParsedAsciiCanvasText,
} from "./index.js";

type Fixture = {
  name: string;
  source: string;
  options?: ParseAsciiCanvasTextOptions;
  expected: Partial<ParsedAsciiCanvasText>;
};

const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/v1.json", import.meta.url)),
    "utf8"
  )
) as Fixture[];

describe("AsciiCanvas Text Protocol v1 conformance", () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const parsed = parseAsciiCanvasText(fixture.source, fixture.options);
      expect(parsed).toMatchObject(fixture.expected);
    });
  }

  it("publishes pinned protocol and Unicode versions", () => {
    expect(ASCII_CANVAS_TEXT_PROTOCOL_VERSION).toBe(1);
    expect(UNICODE_DATA_VERSION).toBe("17.0.0");
  });

  it("supports standard and shorthand SGR color forms", () => {
    const parsed = parseAsciiCanvasText(
      "\u001b[31mA\u001b[48;5;21mB[38;2;1;2;3mC[0mD",
      { defaultStyle: { color: "#abcdef" } }
    );

    expect(parsed.cells).toMatchObject([
      { text: "A", color: "#800000" },
      { text: "B", color: "#800000", bgColor: "#0000ff" },
      { text: "C", color: "#010203", bgColor: "#0000ff" },
      { text: "D", color: "#abcdef" },
    ]);
  });

  it("keeps ordinary and unknown bracket text literal in auto mode", () => {
    const parsed = parseAsciiCanvasText("hello [world] [999mA");

    expect(parsed.plainText).toBe("hello [world] [999mA");
    expect(parsed.hasAnsi).toBe(false);
  });

  it("consumes unknown SGR in ansi mode and reports it", () => {
    const parsed = parseAsciiCanvasText("[999mA", { syntax: "ansi" });

    expect(parsed.plainText).toBe("A");
    expect(parsed.hasAnsi).toBe(true);
    expect(parsed.diagnostics).toMatchObject([
      { code: "unsupported-sgr", offset: 0, length: 5 },
    ]);
  });

  it("supports shorthand OSC 8 links adjacent to SGR", () => {
    const parsed = parseAsciiCanvasText(
      "]8;;https://example.com[1;38;2;255;255;255m Link ]8;;[0m"
    );

    expect(parsed.plainText).toBe(" Link ");
    expect(parsed.cells.every((cell) => cell.href === "https://example.com")).toBe(
      true
    );
    expect(parsed.cells[0]).toMatchObject({
      color: "#ffffff",
      attrs: { bold: true },
    });
  });

  it("resolves inverse as an attribute without rewriting stored colors", () => {
    const [cell] = parseAsciiCanvasText(
      "[7;38;2;10;20;30;48;2;40;50;60mA"
    ).cells;

    expect(cell).toMatchObject({
      color: "#0a141e",
      bgColor: "#28323c",
      attrs: { inverse: true },
    });
  });

  it("normalizes line endings, expands tabs, and preserves a trailing line", () => {
    const parsed = parseAsciiCanvasText("A\tB\rC\r\n", { tabSize: 4 });

    expect(parsed.plainText).toBe("A   B\nC\n");
    expect(parsed).toMatchObject({ width: 5, height: 3 });
  });

  it("returns a zero-sized document for empty or control-only input", () => {
    expect(parseAsciiCanvasText("")).toMatchObject({
      width: 0,
      height: 0,
      cells: [],
    });
    expect(parseAsciiCanvasText("\u0001")).toMatchObject({
      width: 0,
      height: 0,
      cells: [],
      diagnostics: [{ code: "unsupported-control" }],
    });
  });

  it("strips style and link controls without losing visible text", () => {
    expect(
      stripAsciiCanvasAnsi(
        "[31mA[0m ]8;;https://example.com\\B]8;;\\"
      )
    ).toBe("A B");
  });

  it("segments grapheme clusters and applies deterministic cell widths", () => {
    expect(splitGraphemes("é👩🏽‍💻🇨🇳")).toEqual(["é", "👩🏽‍💻", "🇨🇳"]);
    expect(getGraphemeCellWidth("é")).toBe(1);
    expect(getGraphemeCellWidth("界")).toBe(2);
    expect(getGraphemeCellWidth("👩🏽‍💻")).toBe(2);
  });

  it("rejects invalid tab sizes", () => {
    expect(() => parseAsciiCanvasText("A", { tabSize: 0 })).toThrow(RangeError);
  });
});
