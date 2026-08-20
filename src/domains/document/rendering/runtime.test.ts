import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEXT_RENDER_PROFILE,
  TextRenderingRuntime,
} from "./runtime";
import type { TextRenderResult } from "./types";

const textFrom = (result: TextRenderResult) =>
  result.kind === "plain"
    ? result.text
    : result.cells.map((cell) => cell.char).join("");

const rowText = (result: TextRenderResult, y: number) =>
  result.kind === "styled"
    ? result.cells
        .filter((cell) => cell.y === y)
        .sort((left, right) => left.x - right.x)
        .map((cell) => cell.char)
        .join("")
    : result.text.split("\n")[y] ?? "";

describe("TextRenderingRuntime", () => {
  it("composes ANSI before Markdown in auto mode", async () => {
    const runtime = new TextRenderingRuntime();
    const result = await runtime.render("[1m**bold**[0m", "#fff");

    expect(result.renderer).toBe("markdown");
    expect(result.pipeline).toEqual(["ansi", "markdown"]);
    expect(textFrom(result)).toBe("bold");
    expect(result.kind === "styled" && result.cells[0]?.attrs?.bold).toBe(true);
  });

  it("does not let ambiguous ESC-less reset syntax steal Markdown links", async () => {
    const result = await new TextRenderingRuntime().render(
      "- [markdown.ts](/src/markdown.ts)",
      "#fff"
    );

    expect(result.renderer).toBe("markdown");
    expect(result.pipeline).toEqual(["markdown"]);
    expect(rowText(result, 0)).toBe("- markdown.ts");
    expect(
      result.kind === "styled" &&
        result.cells.find((cell) => cell.char === "m")?.href
    ).toBe("/src/markdown.ts");
  });

  it("composes explicit ANSI styles with Markdown structure", async () => {
    const result = await new TextRenderingRuntime().render(
      "[31m**red `code`**[0m",
      "#fff"
    );

    expect(result.pipeline).toEqual(["ansi", "markdown"]);
    expect(textFrom(result)).toBe("red code");
    if (result.kind !== "styled") throw new Error("Expected composed cells");
    expect(result.cells.every((cell) => cell.color === "#800000")).toBe(true);
    expect(result.cells.every((cell) => cell.attrs?.bold)).toBe(true);
  });

  it("keeps explicit OSC 8 links over Markdown link destinations", async () => {
    const result = await new TextRenderingRuntime().render(
      "]8;;https://ansi.example\\[label](https://markdown.example)]8;;\\",
      "#fff"
    );

    expect(result.pipeline).toEqual(["ansi", "markdown"]);
    expect(textFrom(result)).toBe("label");
    expect(
      result.kind === "styled" && result.cells.every(
        (cell) => cell.href === "https://ansi.example"
      )
    ).toBe(true);
  });

  it("keeps ambiguous [m literal in Auto and consumes it in forced ANSI", async () => {
    const runtime = new TextRenderingRuntime();
    expect(await runtime.render("[mplain", "#fff")).toMatchObject({
      renderer: "raw",
      text: "[mplain",
    });

    runtime.setProfile({ ...DEFAULT_TEXT_RENDER_PROFILE, mode: "ansi" });
    expect(textFrom(await runtime.render("[mplain", "#fff"))).toBe("plain");
  });

  it("uses remark-gfm to render supported inline Markdown", async () => {
    const runtime = new TextRenderingRuntime();
    const result = await runtime.render("**粗体** [link](https://example.com) ~~gone~~", "#fff");

    expect(result.renderer).toBe("markdown");
    expect(textFrom(result)).toBe("粗体 link gone");
    if (result.kind !== "styled") throw new Error("Expected styled Markdown cells");
    expect(result.cells.find((cell) => cell.char === "粗")?.attrs?.bold).toBe(true);
    expect(result.cells.find((cell) => cell.char === "l")?.href).toBe("https://example.com");
    expect(result.cells.find((cell) => cell.char === "g")?.attrs?.strike).toBe(true);
    expect(result.cells.find((cell) => cell.char === "体")?.x).toBe(2);
  });

  it("renders headings with Codex hierarchy", async () => {
    const runtime = new TextRenderingRuntime();
    const result = await runtime.render(
      "# H1\n## H2\n### H3\n#### H4",
      "#fff"
    );

    expect([0, 2, 4, 6].map((y) => rowText(result, y))).toEqual([
      "# H1",
      "## H2",
      "### H3",
      "#### H4",
    ]);
    if (result.kind !== "styled") throw new Error("Expected styled headings");
    expect(result.cells.find((cell) => cell.y === 0)?.attrs).toEqual({
      bold: true,
      underline: true,
    });
    expect(result.cells.find((cell) => cell.y === 2)?.attrs).toEqual({ bold: true });
    expect(result.cells.find((cell) => cell.y === 4)?.attrs).toEqual({
      bold: true,
      italic: true,
    });
    expect(result.cells.find((cell) => cell.y === 6)?.attrs).toEqual({ italic: true });
  });

  it("renders Codex inline code, compact links, quotes, lists, and rules", async () => {
    const runtime = new TextRenderingRuntime();
    const result = await runtime.render(
      "`code` [docs](https://example.com)\n\n> quote\n\n1. one\n2. two\n\n---",
      "#111111"
    );

    expect(rowText(result, 0)).toBe("code docs");
    expect(rowText(result, 2)).toBe("> quote");
    expect(rowText(result, 4)).toBe("1. one");
    expect(rowText(result, 5)).toBe("2. two");
    expect(rowText(result, 7)).toBe("———");
    if (result.kind !== "styled") throw new Error("Expected styled Markdown");
    expect(result.cells.find((cell) => cell.char === "c")).toMatchObject({
      color: "#0891b2",
    });
    expect(result.cells.find((cell) => cell.href === "https://example.com")).toMatchObject({
      color: "#0891b2",
      href: "https://example.com",
      attrs: { underline: true },
    });
    expect(result.cells.find((cell) => cell.y === 2)).toMatchObject({ color: "#16a34a" });
    expect(result.cells.find((cell) => cell.y === 4 && cell.char === "1")).toMatchObject({
      color: "#2563eb",
    });
  });

  it("applies independent colors to inline Markdown rules", async () => {
    const runtime = new TextRenderingRuntime();
    runtime.setProfile({
      ...DEFAULT_TEXT_RENDER_PROFILE,
      markdownColors: {
        strong: "#ff0000",
        emphasis: "#00ff00",
        strikethrough: "#0000ff",
        link: "#ffff00",
        "inline-code": "#ff00ff",
      },
    });
    const result = await runtime.render(
      "**B** *I* ~~S~~ [L](https://example.com) `C`",
      "#111111"
    );

    if (result.kind !== "styled") throw new Error("Expected styled Markdown");
    const colorOf = (char: string) => result.cells.find((cell) => cell.char === char)?.color;
    expect(colorOf("B")).toBe("#ff0000");
    expect(colorOf("I")).toBe("#00ff00");
    expect(colorOf("S")).toBe("#0000ff");
    expect(colorOf("L")).toBe("#ffff00");
    expect(colorOf("C")).toBe("#ff00ff");
  });

  it("colors block-owned content and decorations without recoloring list bodies", async () => {
    const runtime = new TextRenderingRuntime();
    runtime.setProfile({
      ...DEFAULT_TEXT_RENDER_PROFILE,
      markdownColors: {
        heading: "#aa0000",
        blockquote: "#00aa00",
        list: "#0000aa",
        "thematic-break": "#aaaa00",
      },
    });
    const result = await runtime.render(
      "# Head\n\n> Quote\n\n- Item\n\n---",
      "#111111"
    );

    if (result.kind !== "styled") throw new Error("Expected styled Markdown");
    expect(result.cells.find((cell) => cell.y === 0 && cell.char === "H")?.color).toBe("#aa0000");
    expect(result.cells.find((cell) => cell.y === 2 && cell.char === "Q")?.color).toBe("#00aa00");
    expect(result.cells.find((cell) => cell.y === 4 && cell.char === "-")?.color).toBe("#0000aa");
    expect(result.cells.find((cell) => cell.y === 4 && cell.char === "I")?.color).toBe("#111111");
    expect(result.cells.find((cell) => cell.y === 6)?.color).toBe("#aaaa00");
  });

  it("uses one table override for headers and separators while preserving body color", async () => {
    const runtime = new TextRenderingRuntime();
    runtime.setProfile({
      ...DEFAULT_TEXT_RENDER_PROFILE,
      markdownColors: { table: "#123456" },
    });
    const result = await runtime.render("| Head |\n| --- |\n| Body |", "#111111");

    if (result.kind !== "styled") throw new Error("Expected styled table");
    expect(result.cells.find((cell) => cell.y === 0 && cell.char === "H")?.color).toBe("#123456");
    expect(result.cells.find((cell) => cell.y === 1)?.color).toBe("#123456");
    expect(result.cells.find((cell) => cell.y === 2 && cell.char === "B")?.color).toBe("#111111");
  });

  it("keeps nested quote and list prefixes deterministic", async () => {
    const result = await new TextRenderingRuntime().render(
      "> outer\n> > inner\n\n- parent\n  - child",
      "#111111"
    );

    expect(rowText(result, 0)).toBe("> outer");
    expect(rowText(result, 1)).toBe("> > inner");
    expect(rowText(result, 3)).toBe("- parent");
    expect(rowText(result, 4)).toBe("    - child");
  });

  it("lays out GFM tables by natural cell width including CJK", async () => {
    const result = await new TextRenderingRuntime().render(
      "| 名 | Value |\n| :- | ----: |\n| 你 | 2 |",
      "#111111"
    );

    expect(rowText(result, 0)).toBe(" 名    Value ");
    expect(rowText(result, 1)).toBe("━━━━  ━━━━━━━");
    expect(rowText(result, 2)).toBe(" 你        2 ");
    if (result.kind !== "styled") throw new Error("Expected styled table");
    expect(result.cells.find((cell) => cell.char === "你")?.x).toBe(1);
    expect(result.cells.find((cell) => cell.char === "2")?.x).toBe(11);
  });

  it("uses Shiki for known code languages and falls back for unknown ones", async () => {
    const runtime = new TextRenderingRuntime();
    const highlighted = await runtime.render("```js\nconst value = 1\n```", "#111111");
    const fallback = await runtime.render("```not-a-language\nvalue\n```", "#111111");

    expect(rowText(highlighted, 0)).toBe("const value = 1");
    expect(
      highlighted.kind === "styled" &&
        highlighted.cells.some((cell) => cell.color !== "#111111")
    ).toBe(true);
    expect(rowText(fallback, 0)).toBe("value");
    expect(fallback.diagnostics[0]?.code).toBe("markdown-highlight-failed");
  });

  it("preserves disabled block rules as raw Markdown source", async () => {
    const runtime = new TextRenderingRuntime();
    runtime.setProfile({
      ...DEFAULT_TEXT_RENDER_PROFILE,
      markdownRules: {
        ...DEFAULT_TEXT_RENDER_PROFILE.markdownRules,
        heading: false,
        table: false,
      },
    });

    const heading = await runtime.render("# **raw heading**", "#fff");
    const table = await runtime.render("| A |\n| - |\n| B |", "#fff");
    expect(rowText(heading, 0)).toBe("# **raw heading**");
    expect([0, 1, 2].map((y) => rowText(table, y))).toEqual([
      "| A |",
      "| - |",
      "| B |",
    ]);
  });

  it("consumes disabled inline syntax without applying its style", async () => {
    const runtime = new TextRenderingRuntime();
    runtime.setProfile({
      ...DEFAULT_TEXT_RENDER_PROFILE,
      markdownRules: {
        ...DEFAULT_TEXT_RENDER_PROFILE.markdownRules,
        strong: false,
      },
    });
    const result = await runtime.render("**plain**", "#fff");

    expect(textFrom(result)).toBe("plain");
    expect(result.kind === "styled" && result.cells[0]?.attrs?.bold).toBeFalsy();
  });

  it("keeps source syntax literal in raw mode", async () => {
    const runtime = new TextRenderingRuntime();
    runtime.setProfile({ ...DEFAULT_TEXT_RENDER_PROFILE, mode: "raw" });

    expect(await runtime.render("**raw**", "#fff")).toMatchObject({
      kind: "plain",
      renderer: "raw",
      text: "**raw**",
    });
  });

  it("persists and restores a validated profile", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const runtime = new TextRenderingRuntime({ storage });
    runtime.setProfile({
      ...DEFAULT_TEXT_RENDER_PROFILE,
      mode: "markdown",
      markdownColors: {
        strong: "#AABBCC",
        link: "invalid",
        ...({ "code-block": "#ff0000" } as Record<string, string>),
      },
    });

    expect(new TextRenderingRuntime({ storage }).getProfile()).toMatchObject({
      mode: "markdown",
      markdownColors: { strong: "#aabbcc" },
    });
  });

  it("loads profiles saved before Markdown color overrides existed", () => {
    const storage = {
      getItem: () => JSON.stringify({
        mode: "markdown",
        markdownRules: DEFAULT_TEXT_RENDER_PROFILE.markdownRules,
      }),
      setItem: () => undefined,
    };

    expect(new TextRenderingRuntime({ storage }).getProfile()).toMatchObject({
      mode: "markdown",
      markdownColors: {},
    });
  });

  it("registers an extensible renderer in auto and explicit modes", async () => {
    const runtime = new TextRenderingRuntime({
      plugins: [
        {
          id: "mention",
          phase: "transform",
          autoPriority: 75,
          transform: (input) =>
            input.text.startsWith("@")
              ? {
                  fragments: [{
                    text: input.text.slice(1),
                    origin: { from: 1, to: input.text.length },
                  }],
                  diagnostics: [],
                  recognized: true,
                }
              : null,
        },
        {
          id: "raw",
          phase: "transform",
          transform: (input) => ({
            fragments: [{ text: input.text, origin: { from: 0, to: input.text.length } }],
            diagnostics: [],
            recognized: true,
          }),
        },
      ],
    });

    const automatic = await runtime.render("@Ada", "#fff");
    expect(automatic.renderer).toBe("mention");
    expect(textFrom(automatic)).toBe("Ada");
    runtime.setProfile({ ...DEFAULT_TEXT_RENDER_PROFILE, mode: "mention" });
    expect(runtime.getProfile().mode).toBe("mention");
    const explicit = await runtime.render("@Ada", "#fff");
    expect(explicit.renderer).toBe("mention");
    expect(textFrom(explicit)).toBe("Ada");
  });
});
