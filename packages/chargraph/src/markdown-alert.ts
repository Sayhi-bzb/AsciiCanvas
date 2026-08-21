import type { Alert } from "marked-alert";
import markedAlert from "marked-alert";
import {
  createCharGraphFragment,
  joinCharGraphLines,
  splitCharGraphLines,
} from "./fragments.js";
import type { MarkdownSyntaxExtension } from "./markdown-extension.js";

const alertRole = (variant: string) => `alert-${variant}`;

export const markdownAlertExtension: MarkdownSyntaxExtension = {
  id: "github-alert",
  marked: markedAlert(),
  tokenTypes: ["alert"],
  async render(request, context) {
    if (request.kind !== "token") return null;
    if (!context.enabled("github-alert")) {
      const source = request.source.replace(/\n$/, "");
      return {
        fragments: [createCharGraphFragment(source, {}, {
          from: request.sourceOrigin.from,
          to: request.sourceOrigin.from + source.length,
        })],
        recognized: true,
        diagnostics: [],
      };
    }

    const token = request.token as Alert;
    const style = context.style(alertRole(token.meta.variant));
    const content = await context.renderBlocks(token.tokens, request.sourceOrigin);
    const markerOrigins = [...request.source.matchAll(/^ {0,3}>[ \t]?/gm)].map((match) => ({
      from: request.sourceOrigin.from + (match.index ?? 0),
      to: request.sourceOrigin.from + (match.index ?? 0) + match[0].length,
    }));
    const titleOrigin = markerOrigins[0] ?? request.sourceOrigin;
    const lines = [
      [
        createCharGraphFragment("│ ", style, titleOrigin),
        createCharGraphFragment(
          token.meta.title.toUpperCase(),
          { ...style, attrs: { ...style?.attrs, bold: true } },
          titleOrigin
        ),
      ],
      ...splitCharGraphLines(content).map((line, index) => [
        createCharGraphFragment(
          "│ ",
          style,
          markerOrigins[index + 1] ?? markerOrigins.at(-1) ?? request.sourceOrigin
        ),
        ...line,
      ]),
    ];
    return {
      fragments: joinCharGraphLines(lines, request.sourceOrigin),
      recognized: true,
      diagnostics: [],
    };
  },
};
