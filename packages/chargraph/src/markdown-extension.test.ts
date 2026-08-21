import type { Token } from "marked";
import { describe, expect, it } from "vitest";
import { createCharGraphFragment, getCharGraphText } from "./fragments.js";
import type { MarkdownSyntaxExtension } from "./markdown-extension.js";
import { createMarkdownRenderer } from "./markdown.js";

type HighlightToken = Token & { type: "highlight"; text: string };

const highlightExtension: MarkdownSyntaxExtension = {
  id: "highlight",
  marked: {
    extensions: [{
      name: "highlight",
      level: "inline",
      start: (source) => source.indexOf("=="),
      tokenizer(source) {
        const match = /^==([^=]+)==/.exec(source);
        if (!match) return undefined;
        return {
          type: "highlight",
          raw: match[0],
          text: match[1]!,
        };
      },
    }],
  },
  tokenTypes: ["highlight"],
  render(request) {
    if (request.kind !== "token") return null;
    const token = request.token as HighlightToken;
    return {
      fragments: [createCharGraphFragment(
        token.text,
        { attrs: { underline: true } },
        request.sourceOrigin
      )],
      recognized: true,
      diagnostics: [],
    };
  },
};

describe("MarkdownSyntaxExtension", () => {
  it("adds parser syntax and rendering without changing the core visitor", async () => {
    const renderer = createMarkdownRenderer({ extensions: [highlightExtension] });
    const rendered = await renderer.render("plain ==plugged== text");
    const highlighted = rendered.fragments.find((item) => item.attrs?.underline);

    expect(getCharGraphText(rendered)).toBe("plain plugged text");
    expect(rendered.recognized).toBe(true);
    expect(highlighted).toMatchObject({
      text: "plugged",
      origin: { from: 6, to: 17 },
    });
  });
});
