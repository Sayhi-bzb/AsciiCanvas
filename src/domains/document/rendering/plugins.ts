import {
  decodeCharDeskTextRuns,
} from "@chardesk/protocol";
import type { Root } from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import { renderCodexMarkdownRuns } from "./markdown";
import { spansFromRuns } from "./compositor";
import type {
  MarkdownRenderRule,
  TextRenderDiagnostic,
  TextRenderPlugin,
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

const markdownProcessor = remark().use(remarkGfm);

const createBuiltInMarkdownRules = (): MarkdownRenderRule[] => [
  {
    id: "strong",
    nodeTypes: ["strong"],
    decorate: () => ({ attrs: { bold: true } }),
  },
  {
    id: "emphasis",
    nodeTypes: ["emphasis"],
    decorate: () => ({ attrs: { italic: true } }),
  },
  {
    id: "strikethrough",
    nodeTypes: ["delete"],
    decorate: () => ({ attrs: { strike: true } }),
  },
  {
    id: "link",
    nodeTypes: ["link"],
    decorate: (node) => ({ href: (node as { url?: string }).url }),
  },
];

export const createMarkdownTextRenderPlugin = (
  rules: readonly MarkdownRenderRule[] = createBuiltInMarkdownRules()
): TextRenderPlugin => {
  return {
    id: "markdown",
    phase: "transform",
    autoPriority: 50,
    transform: async (input, context) => {
      const root = markdownProcessor.parse(input.text) as Root;
      const rendered = await renderCodexMarkdownRuns(
        input.text,
        root,
        context.markdownRules,
        context.markdownColors,
        rules
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
