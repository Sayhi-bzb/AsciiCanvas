import type { CharDeskTextStyle } from "@chardesk/protocol";
import {
  CHARDESK_LIGHT_RENDER_THEME,
  resolveCharDeskRenderColor,
  type CharDeskRenderColorDefault,
  type CharDeskRenderTheme,
  type CharDeskRenderThemeToken,
} from "./render-theme.js";

/** Public semantic style contract shared by Mermaid renderers and hosts. */
export const MERMAID_STYLE_ROLES = [
  "title",
  "node.text",
  "node.border",
  "node.background",
  "edge.line",
  "edge.label",
  "edge.arrow",
  "container.border",
  "container.title",
  "chart.axis",
  "chart.grid",
  "chart.label",
  "series.1",
  "series.2",
  "series.3",
  "series.4",
  "series.5",
] as const;

export type MermaidStyleRole = typeof MERMAID_STYLE_ROLES[number];

export type MermaidStyleMap = Partial<
  Record<MermaidStyleRole, CharDeskTextStyle>
>;

export type CharDeskMermaidStyles = Readonly<
  Record<MermaidStyleRole, CharDeskTextStyle>
>;

const inherit = Object.freeze({ kind: "inherit" } as const);
const token = (value: CharDeskRenderThemeToken) => Object.freeze({
  kind: "token",
  token: value,
} as const);

export const CHARDESK_MERMAID_COLOR_DEFAULTS = Object.freeze({
  title: token("accent"),
  "node.text": token("foreground"),
  "node.border": token("accent"),
  "node.background": inherit,
  "edge.line": token("accent"),
  "edge.label": token("foreground"),
  "edge.arrow": token("accent"),
  "container.border": token("muted"),
  "container.title": token("accent"),
  "chart.axis": token("foreground"),
  "chart.grid": token("muted"),
  "chart.label": token("foreground"),
  "series.1": token("accent"),
  "series.2": token("info"),
  "series.3": token("success"),
  "series.4": token("warning"),
  "series.5": token("danger"),
} as const satisfies Readonly<
  Record<MermaidStyleRole, CharDeskRenderColorDefault>
>);

export const createCharDeskMermaidStyles = ({
  theme = CHARDESK_LIGHT_RENDER_THEME,
  colors = {},
}: {
  theme?: CharDeskRenderTheme;
  colors?: Partial<Record<MermaidStyleRole, string>>;
} = {}): CharDeskMermaidStyles => {
  const color = (role: MermaidStyleRole) => colors[role]
    ?? resolveCharDeskRenderColor(CHARDESK_MERMAID_COLOR_DEFAULTS[role], theme);
  const nodeBackground = color("node.background");

  return {
    title: { color: color("title"), attrs: { bold: true } },
    "node.text": {
      color: color("node.text"),
      bgColor: nodeBackground,
    },
    "node.border": { color: color("node.border") },
    "node.background": { bgColor: nodeBackground },
    "edge.line": { color: color("edge.line") },
    "edge.label": {
      color: color("edge.label"),
      attrs: { italic: true },
    },
    "edge.arrow": { color: color("edge.arrow") },
    "container.border": { color: color("container.border") },
    "container.title": {
      color: color("container.title"),
      attrs: { bold: true },
    },
    "chart.axis": { color: color("chart.axis") },
    "chart.grid": { color: color("chart.grid") },
    "chart.label": { color: color("chart.label") },
    "series.1": { color: color("series.1") },
    "series.2": { color: color("series.2") },
    "series.3": { color: color("series.3") },
    "series.4": { color: color("series.4") },
    "series.5": { color: color("series.5") },
  };
};
