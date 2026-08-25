import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./fragments.js";
import { renderCharGraphText } from "./text.js";

describe("canonical CharGraph text renderer", () => {
  it("renders fenced JSON inside a two-dimensional layout", async () => {
    const rendered = await renderCharGraphText([
      "Input",
      "```json",
      '{"name":"CharDesk","ready":true}',
      "```",
      "|||",
      "Output",
    ].join("\n"));
    const output = getCharGraphText(rendered);

    expect(rendered.renderer).toBe("block-layout");
    expect(output).toContain("name");
    expect(output).toContain("CharDesk");
    expect(output).not.toContain("```json");
  });

  it("treats either standalone boundary as layout before Markdown", async () => {
    const rendered = await renderCharGraphText("Top\n---\nBottom");

    expect(rendered.renderer).toBe("block-layout");
    expect(getCharGraphText(rendered)).toBe("Top\n\nBottom");
  });

  it("keeps escaped boundaries literal and leaves alternate Markdown rules available", async () => {
    const escaped = await renderCharGraphText("A\n|||\n\\---\n\\|||\n---\nB");
    const rule = await renderCharGraphText("***");

    expect(getCharGraphText(escaped)).toContain("---");
    expect(getCharGraphText(escaped)).toContain("|||");
    expect(getCharGraphText(escaped)).not.toMatch(/\\(?:---|\|\|\|)/u);
    expect(rule.renderer).toBe("markdown");
    expect(getCharGraphText(rule)).toBe("———");
  });

  it("lets explicit ANSI colors win while Markdown attributes merge", async () => {
    const rendered = await renderCharGraphText("[31m**red**[0m");

    expect(rendered.pipeline).toEqual(["ansi", "markdown"]);
    expect(rendered.fragments.every((fragment) => fragment.color === "#800000"))
      .toBe(true);
    expect(rendered.fragments.every((fragment) => fragment.attrs?.bold)).toBe(true);
  });
});
