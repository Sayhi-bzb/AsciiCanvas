import { describe, expect, it } from "vitest";
import { getCharGraphText } from "./fragments.js";
import { markdownAlertExtension } from "./markdown-alert.js";
import { createMarkdownRenderer } from "./markdown.js";

const renderer = createMarkdownRenderer({ extensions: [markdownAlertExtension] });

describe("markdownAlertExtension", () => {
  it("renders GitHub alerts with a colored rail and nested Markdown", async () => {
    const source = [
      "> [!NOTE]",
      "> Read **bold** [docs](https://example.com).",
      ">",
      "> - first",
      "> - second",
    ].join("\n");
    const rendered = await renderer.render(source, {
      styles: {
        strong: { attrs: { bold: true } },
        link: { attrs: { underline: true } },
      },
      extensionStyles: { "alert-note": { color: "#123456" } },
    });

    expect(getCharGraphText(rendered)).toBe([
      "│ NOTE",
      "│ Read bold docs.",
      "│ ",
      "│ - first",
      "│ - second",
    ].join("\n"));
    expect(rendered.fragments.filter((item) => item.text === "│ ").every(
      (item) => item.color === "#123456"
    )).toBe(true);
    expect(rendered.fragments.find((item) => item.text === "NOTE")?.attrs?.bold).toBe(true);
    expect(rendered.fragments.find((item) => item.text === "bold")?.attrs?.bold).toBe(true);
    expect(rendered.fragments.find((item) => item.text === "docs")?.href).toBe(
      "https://example.com"
    );
  });

  it("supports every GitHub variant", async () => {
    const rendered = await renderer.render([
      "> [!NOTE]\n> note",
      "> [!TIP]\n> tip",
      "> [!IMPORTANT]\n> important",
      "> [!WARNING]\n> warning",
      "> [!CAUTION]\n> caution",
    ].join("\n\n"));

    expect(getCharGraphText(rendered)).toContain("│ NOTE");
    expect(getCharGraphText(rendered)).toContain("│ TIP");
    expect(getCharGraphText(rendered)).toContain("│ IMPORTANT");
    expect(getCharGraphText(rendered)).toContain("│ WARNING");
    expect(getCharGraphText(rendered)).toContain("│ CAUTION");
  });

  it("preserves disabled alerts and leaves ordinary quotes unchanged", async () => {
    const alert = "> [!WARNING]\n> raw **source**";
    expect(getCharGraphText(await renderer.render(alert, {
      extensionRules: { "github-alert": false },
    }))).toBe(alert);
    expect(getCharGraphText(await renderer.render("> ordinary"))).toBe("│ ordinary");
  });
});
