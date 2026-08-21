import {
  createCharGraphFragment,
  styleCharGraphFragments,
} from "./fragments.js";
import type { MarkdownSyntaxExtension } from "./markdown-extension.js";
import { renderMermaid } from "./mermaid.js";

const MAX_SOURCE_LENGTH = 20_000;
const MAX_SOURCE_LINES = 400;

const fallback = (
  rawSource: string,
  rawOrigin: { from: number; to: number },
  message: string
) => {
  const text = rawSource.replace(/\n$/, "");
  return {
    fragments: [createCharGraphFragment(text, {}, {
      from: rawOrigin.from,
      to: rawOrigin.from + text.length,
    })],
    recognized: true,
    diagnostics: [{
      code: "markdown-mermaid-render-failed",
      message,
      offset: rawOrigin.from,
      length: rawOrigin.to - rawOrigin.from,
    }],
  };
};

export const markdownMermaidExtension: MarkdownSyntaxExtension = {
  id: "mermaid",
  fencedLanguages: ["mermaid"],
  async render(request, context) {
    if (request.kind !== "fenced-code") return null;
    if (!context.enabled("mermaid")) {
      return {
        fragments: [createCharGraphFragment(
          request.source,
          {},
          request.sourceOrigin
        )],
        recognized: true,
        diagnostics: [],
      };
    }
    const lineCount = request.source === ""
      ? 0
      : request.source.split("\n").length;
    if (
      request.source.length > MAX_SOURCE_LENGTH ||
      lineCount > MAX_SOURCE_LINES
    ) {
      return fallback(
        request.rawSource,
        request.rawOrigin,
        "Could not render Mermaid diagram: diagram exceeds the 20000-character or 400-line limit."
      );
    }
    const diagram = await renderMermaid(request.source);
    if (diagram.diagnostics[0]) {
      return fallback(
        request.rawSource,
        request.rawOrigin,
        diagram.diagnostics[0].message
      );
    }
    return {
      fragments: styleCharGraphFragments(
        diagram.fragments.map((fragment) => ({
          ...fragment,
          origin: request.sourceOrigin,
        })),
        context.style("mermaid")
      ),
      recognized: true,
      diagnostics: [],
    };
  },
};
