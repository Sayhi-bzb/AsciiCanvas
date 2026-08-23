import type { Alert } from "marked-alert";
import markedAlert from "marked-alert";
import {
  createCharGraphFragment,
  joinCharGraphLines,
  splitCharGraphLines,
} from "./fragments.js";
import {
  type MarkdownSyntaxExtension,
} from "./markdown-extension.js";

export const MARKDOWN_ALERT_STYLE_ROLES = [
  "alert-note",
  "alert-tip",
  "alert-important",
  "alert-warning",
  "alert-caution",
] as const;
type MarkdownAlertStyleRole =
  typeof MARKDOWN_ALERT_STYLE_ROLES[number];

const alertRole = (
  variant: string
): MarkdownAlertStyleRole | undefined => {
  switch (variant.toLowerCase()) {
    case "note": return "alert-note";
    case "tip": return "alert-tip";
    case "important": return "alert-important";
    case "warning": return "alert-warning";
    case "caution": return "alert-caution";
    default: return undefined;
  }
};

export const markdownAlertExtension: MarkdownSyntaxExtension<
  MarkdownAlertStyleRole
> = {
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
    const role = alertRole(token.meta.variant);
    const style = role ? context.style(role) : undefined;
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
