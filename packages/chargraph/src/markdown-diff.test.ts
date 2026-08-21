import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./fragments.js";
import { markdownDiffExtension } from "./markdown-diff.js";
import { createMarkdownRenderer } from "./markdown.js";

const renderer = createMarkdownRenderer({ extensions: [markdownDiffExtension] });

const source = [
  "```diff",
  "diff --git a/demo.ts b/demo.ts",
  "--- a/demo.ts",
  "+++ b/demo.ts",
  "@@ -1,2 +1,2 @@",
  "-const oldValue = 1",
  "+const newValue = 2",
  " console.log(newValue)",
  "\\ No newline at end of file",
  "```",
].join("\n");

describe("markdownDiffExtension", () => {
  it("styles unified diff lines by semantic role", async () => {
    const rendered = await renderer.render(source, {
      extensionStyles: {
        "diff-added": { color: "#008000", bgColor: "#eeffee" },
        "diff-deleted": { color: "#800000", bgColor: "#ffeeee" },
        "diff-hunk": { color: "#000080" },
        "diff-metadata": { color: "#808080" },
      },
    });

    expect(getCharGraphText(rendered)).not.toContain("```");
    expect(rendered.fragments.find((item) => item.text.startsWith("+const"))).toMatchObject({
      color: "#008000",
      bgColor: "#eeffee",
    });
    expect(rendered.fragments.find((item) => item.text.startsWith("-const"))).toMatchObject({
      color: "#800000",
      bgColor: "#ffeeee",
    });
    expect(rendered.fragments.find((item) => item.text.startsWith("+++"))?.color).toBe("#808080");
    expect(rendered.fragments.find((item) => item.text.startsWith("@@"))?.color).toBe("#000080");
    expect(rendered.fragments.find((item) => item.text.startsWith("\\ No newline"))?.color)
      .toBe("#808080");
  });

  it("supports patch fences and partial diffs", async () => {
    const rendered = await renderer.render("```patch\n-old\n+新\n same\n```", {
      extensionStyles: { "diff-added": { color: "#008000" } },
    });
    expect(getCharGraphText(rendered)).toBe("-old\n+新\n same");
    expect(rendered.fragments.find((item) => item.text === "+新")?.origin).toBeDefined();
  });

  it("falls back to code rendering when disabled and raw source when code blocks are disabled", async () => {
    const disabled = await renderer.render("```diff\n-old\n+new\n```", {
      extensionRules: { diff: false },
    });
    expect(getCharGraphText(disabled)).toBe("-old\n+new");
    expect(disabled.fragments.every((item) => item.bgColor === undefined)).toBe(true);

    const raw = await renderer.render("```diff\n-old\n+new\n```", {
      rules: { "code-block": false },
    });
    expect(getCharGraphText(raw)).toBe("```diff\n-old\n+new\n```");
  });
});
