import {
  decodeCharDeskTextRuns,
} from "@chardesk/protocol";
import { renderCharGraph } from "@chardesk/chargraph";
import { spansFromRuns } from "./compositor";
import {
  createRegisteredMarkdownOptions,
  createRegisteredMarkdownRenderer,
} from "./features";
import type { TextRenderDiagnostic, TextRenderPlugin } from "./types";

const toDiagnostics = (
  diagnostics: ReturnType<typeof decodeCharDeskTextRuns>["diagnostics"]
): TextRenderDiagnostic[] => diagnostics.map((diagnostic) => ({ ...diagnostic }));

export const rawTextRenderPlugin: TextRenderPlugin = {
  id: "raw",
  phase: "transform",
  fallback: true,
  transform: (input) => ({
    kind: "plain",
    text: input.text,
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

const markdownRenderer = createRegisteredMarkdownRenderer();

export const createMarkdownTextRenderPlugin = (): TextRenderPlugin => {
  return {
    id: "markdown",
    phase: "transform",
    autoPriority: 50,
    transform: async (input, context) => {
      const options = createRegisteredMarkdownOptions(
        context.features,
        context.renderTheme,
        context.forced
      );
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
