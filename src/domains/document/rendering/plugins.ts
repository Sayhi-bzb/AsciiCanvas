import {
  decodeCharDeskTextRuns,
} from "@chardesk/protocol";
import { renderCharGraph } from "@chardesk/chargraph";
import {
  markdownRenderer,
  type MarkdownTextStyles,
} from "@chardesk/chargraph/markdown";
import { spansFromRuns } from "./compositor";
import type {
  MarkdownColorSlotId,
  TextRenderDiagnostic,
  TextRenderPlugin,
  TextRenderTheme,
} from "./types";

const toDiagnostics = (
  diagnostics: ReturnType<typeof decodeCharDeskTextRuns>["diagnostics"]
): TextRenderDiagnostic[] => diagnostics.map((diagnostic) => ({ ...diagnostic }));

export const rawTextRenderPlugin: TextRenderPlugin = {
  id: "raw",
  phase: "transform",
  transform: (input) => ({
    fragments: [{ text: input.text, origin: { from: 0, to: input.text.length } }],
    diagnostics: [],
    recognized: true,
  }),
};

export const ansiTextRenderPlugin: TextRenderPlugin = {
  id: "ansi",
  phase: "decode",
  autoPriority: 100,
  decode: (source, context) => {
    const decoded = decodeCharDeskTextRuns(source, {
      syntax: context.forced ? "ansi" : "auto",
    });
    if (!decoded.hasAnsi) return null;
    if (!context.forced && decoded.ansiEvidence !== "explicit") return null;
    return {
      text: decoded.text,
      spans: spansFromRuns(decoded.runs),
      evidence: decoded.ansiEvidence,
      diagnostics: toDiagnostics(decoded.diagnostics),
    };
  },
};

const markdownStyles = (
  colors: Partial<Record<MarkdownColorSlotId, string>>,
  theme: TextRenderTheme
): MarkdownTextStyles => {
  const color = (slot: MarkdownColorSlotId, fallback?: keyof typeof theme) =>
    colors[slot] ?? (fallback ? theme[fallback] : undefined);
  const listColor = color("list.marker");
  return {
    strong: { attrs: { bold: true }, ...(color("strong.foreground") ? { color: color("strong.foreground") } : {}) },
    emphasis: { attrs: { italic: true }, ...(color("emphasis.foreground") ? { color: color("emphasis.foreground") } : {}) },
    strikethrough: { attrs: { strike: true }, ...(color("strikethrough.foreground") ? { color: color("strikethrough.foreground") } : {}) },
    link: { color: color("link.foreground", "info"), attrs: { underline: true } },
    "heading-marker": { color: color("heading.marker", "accent") },
    "heading-1": { attrs: { bold: true, underline: true } },
    "heading-2": { attrs: { bold: true } },
    "heading-3": { attrs: { bold: true, italic: true } },
    "heading-4": { attrs: { italic: true } },
    "inline-code": {
      color: color("inline-code.foreground", "info"),
      bgColor: color("inline-code.background", "surface"),
    },
    "blockquote-marker": { color: color("blockquote.marker", "success") },
    ...(listColor ? { "list-marker": { color: listColor } } : {}),
    "ordered-list-marker": { color: listColor ?? theme.accent },
    "task-unchecked": { color: color("task-list.unchecked", "muted") },
    "task-checked": { color: color("task-list.checked", "success") },
    ...(color("thematic-break.foreground")
      ? { "thematic-break": { color: color("thematic-break.foreground") } }
      : {}),
    "table-header": {
      color: color("table.header.foreground", "accent-foreground"),
      bgColor: color("table.header.background", "accent"),
      attrs: { bold: true },
    },
    "table-separator": { color: color("table.separator", "muted") },
  };
};

export const createMarkdownTextRenderPlugin = (): TextRenderPlugin => {
  return {
    id: "markdown",
    phase: "transform",
    autoPriority: 50,
    transform: async (input, context) => {
      const options = {
        forced: context.forced,
        rules: context.markdownRules,
        extensionRules: context.markdownRules,
        styles: markdownStyles(context.markdownColors, context.renderTheme),
        extensionStyles: {
          ...(context.markdownColors["mermaid.foreground"]
            ? {
                mermaid: {
                  color: context.markdownColors["mermaid.foreground"],
                },
              }
            : {}),
        },
      };
      const rendered = await renderCharGraph(
        input.text,
        markdownRenderer,
        options
      );
      if (!rendered.recognized) return null;
      return {
        fragments: rendered.fragments,
        diagnostics: rendered.diagnostics,
        recognized: true,
      };
    },
  };
};
