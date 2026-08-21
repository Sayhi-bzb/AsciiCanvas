import type {
  MarkdownRenderRuleId,
  MarkdownRuleStyleBehavior,
  TextRenderTheme,
} from "./types";

export const DEFAULT_TEXT_RENDER_THEME: TextRenderTheme = {
  foreground: "#000000",
  background: "#ffffff",
  accent: "#2563eb",
  "accent-foreground": "#ffffff",
  info: "#0891b2",
  success: "#16a34a",
  muted: "#94a3b8",
  surface: "#e2e8f0",
  "surface-foreground": "#000000",
};

const inherit = { kind: "inherit" } as const;
const token = (value: keyof TextRenderTheme) => ({ kind: "token", token: value } as const);

export const MARKDOWN_RULE_STYLE_BEHAVIORS = {
  strong: {
    kind: "slots",
    slots: [{ id: "strong.foreground", default: inherit }],
  },
  emphasis: {
    kind: "slots",
    slots: [{ id: "emphasis.foreground", default: inherit }],
  },
  strikethrough: {
    kind: "slots",
    slots: [{ id: "strikethrough.foreground", default: inherit }],
  },
  link: {
    kind: "slots",
    slots: [{ id: "link.foreground", default: token("info") }],
  },
  heading: {
    kind: "slots",
    slots: [{ id: "heading.marker", default: token("accent") }],
  },
  "inline-code": {
    kind: "slots",
    slots: [
      { id: "inline-code.foreground", default: token("info") },
      { id: "inline-code.background", default: token("surface") },
    ],
  },
  blockquote: {
    kind: "slots",
    slots: [{ id: "blockquote.marker", default: token("success") }],
  },
  list: {
    kind: "slots",
    slots: [{
      id: "list.marker",
      default: { kind: "mixed", tokens: ["accent"], includesInherited: true },
    }],
  },
  "task-list": {
    kind: "slots",
    slots: [
      { id: "task-list.unchecked", default: token("muted") },
      { id: "task-list.checked", default: token("success") },
    ],
  },
  "thematic-break": {
    kind: "slots",
    slots: [{ id: "thematic-break.foreground", default: inherit }],
  },
  "code-block": { kind: "syntax" },
  mermaid: {
    kind: "slots",
    slots: [{ id: "mermaid.foreground", default: inherit }],
  },
  table: {
    kind: "slots",
    slots: [
      { id: "table.header.foreground", default: token("accent-foreground") },
      { id: "table.header.background", default: token("accent") },
      { id: "table.separator", default: token("muted") },
    ],
  },
} as const satisfies Record<MarkdownRenderRuleId, MarkdownRuleStyleBehavior>;
