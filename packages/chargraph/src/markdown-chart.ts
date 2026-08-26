import { createCharGraphFragment } from "./fragments.js";
import type { MarkdownSyntaxExtension } from "./markdown-extension.js";
import { renderCartesianChart } from "./cartesian-chart.js";
import { MERMAID_STYLE_ROLES } from "./mermaid-style.js";
import { parseVegaLiteChart } from "./vega-lite-chart.js";

export const MARKDOWN_CHART_STYLE_ROLES = MERMAID_STYLE_ROLES.map(
  (role) => `chart.${role}` as const
);
type MarkdownChartStyleRole = typeof MARKDOWN_CHART_STYLE_ROLES[number];

const fallback = (
  rawSource: string,
  origin: { from: number; to: number },
  message: string
) => ({
  fragments: [createCharGraphFragment(rawSource.replace(/\n$/u, ""), {}, origin)],
  recognized: true,
  diagnostics: [{
    code: "markdown-chart-render-failed",
    message: `Could not render chart: ${message}`,
    offset: origin.from,
    length: origin.to - origin.from,
  }],
});

export const markdownChartExtension: MarkdownSyntaxExtension<
  MarkdownChartStyleRole
> = {
  id: "chart",
  fencedLanguages: ["vega-lite", "vegalite"],
  render(request, context) {
    if (request.kind !== "fenced-code") return null;
    if (!context.enabled("chart")) {
      return {
        fragments: [createCharGraphFragment(request.source, {}, request.sourceOrigin)],
        recognized: true,
        diagnostics: [],
      };
    }
    try {
      const rendered = renderCartesianChart(parseVegaLiteChart(request.source), {
        source: request.source,
        styles: Object.fromEntries(MERMAID_STYLE_ROLES.flatMap((role) => {
          const style = context.style(`chart.${role}`);
          return style ? [[role, style]] : [];
        })),
      });
      return {
        ...rendered,
        fragments: rendered.fragments.map((fragment) => ({
          ...fragment,
          origin: request.sourceOrigin,
        })),
      };
    } catch (error) {
      return fallback(
        request.rawSource,
        request.rawOrigin,
        error instanceof Error ? error.message : "Invalid Vega-Lite source."
      );
    }
  },
};
