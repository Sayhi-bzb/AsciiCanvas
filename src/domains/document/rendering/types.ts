import type { CharGraphFragment } from "@chardesk/chargraph";
import type { CharDeskTextStyle } from "@chardesk/protocol";
import type { GridCell } from "@/shared/types";

export type BuiltInTextRendererId = "raw" | "ansi" | "markdown";
export type TextRendererId = string;
export type TextRendererMode = "auto" | TextRendererId;
export type MarkdownRenderRuleId =
  | "strong"
  | "emphasis"
  | "strikethrough"
  | "link"
  | "heading"
  | "inline-code"
  | "blockquote"
  | "list"
  | "task-list"
  | "thematic-break"
  | "code-block"
  | "mermaid"
  | "table";

export type MarkdownRenderRules = Record<MarkdownRenderRuleId, boolean>;
export type MarkdownColorSlotId =
  | "strong.foreground"
  | "emphasis.foreground"
  | "strikethrough.foreground"
  | "link.foreground"
  | "heading.marker"
  | "inline-code.foreground"
  | "inline-code.background"
  | "blockquote.marker"
  | "list.marker"
  | "task-list.unchecked"
  | "task-list.checked"
  | "thematic-break.foreground"
  | "mermaid.foreground"
  | "table.header.foreground"
  | "table.header.background"
  | "table.separator";
export type MarkdownRenderColors = Partial<Record<MarkdownColorSlotId, string>>;
export type TextRenderThemeTokenId =
  | "foreground"
  | "background"
  | "accent"
  | "accent-foreground"
  | "info"
  | "success"
  | "muted"
  | "surface"
  | "surface-foreground";
export type TextRenderTheme = Record<TextRenderThemeTokenId, string>;
export type TextRenderThemeOverrides = Partial<TextRenderTheme>;
export type MarkdownColorDefault =
  | { readonly kind: "inherit" }
  | { readonly kind: "token"; readonly token: TextRenderThemeTokenId }
  | {
      readonly kind: "mixed";
      readonly tokens: readonly TextRenderThemeTokenId[];
      readonly includesInherited?: boolean;
    };
export type MarkdownRuleStyleBehavior =
  | { readonly kind: "syntax" }
  | {
      readonly kind: "slots";
      readonly slots: readonly {
        readonly id: MarkdownColorSlotId;
        readonly default: MarkdownColorDefault;
      }[];
    };

export type TextRenderProfile = {
  mode: TextRendererMode;
  renderTheme: TextRenderThemeOverrides;
  markdownRules: MarkdownRenderRules;
  markdownColors: MarkdownRenderColors;
};

export type RenderedTextCell = GridCell & { x: number; y: number };

export type TextRenderDiagnostic = {
  code: string;
  message: string;
  offset?: number;
  length?: number;
};

export type TextRenderResult =
  | {
      kind: "plain";
      renderer: TextRendererId;
      pipeline: readonly TextRendererId[];
      text: string;
      diagnostics: TextRenderDiagnostic[];
    }
  | {
      kind: "styled";
      renderer: TextRendererId;
      pipeline: readonly TextRendererId[];
      cells: RenderedTextCell[];
      diagnostics: TextRenderDiagnostic[];
    };

export type TextStyle = CharDeskTextStyle & { href?: string };

export type TextStyleSpan = TextStyle & {
  from: number;
  to: number;
};

export type AttributedText = {
  text: string;
  spans: TextStyleSpan[];
  diagnostics: TextRenderDiagnostic[];
};

export type TextRenderFragment = CharGraphFragment;

export type TextDecodeResult = AttributedText & {
  evidence: "none" | "ambiguous" | "explicit";
};

export type TextTransformResult = {
  fragments: TextRenderFragment[];
  diagnostics: TextRenderDiagnostic[];
  recognized: boolean;
};

export type TextRenderContext = {
  defaultColor: string;
  renderTheme: TextRenderTheme;
  markdownRules: MarkdownRenderRules;
  markdownColors: MarkdownRenderColors;
  forced: boolean;
};

export type Awaitable<T> = T | Promise<T>;

export interface TextDecoderPlugin {
  readonly id: TextRendererId;
  readonly phase: "decode";
  /** Higher values run first in Auto mode. Omit to make the plugin opt-in. */
  readonly autoPriority?: number;
  decode(
    source: string,
    context: TextRenderContext
  ): Awaitable<TextDecodeResult | null>;
}

export interface TextTransformerPlugin {
  readonly id: TextRendererId;
  readonly phase: "transform";
  /** Higher values run first within the transform phase. Omit to make the plugin opt-in. */
  readonly autoPriority?: number;
  transform(
    input: AttributedText,
    context: TextRenderContext
  ): Awaitable<TextTransformResult | null>;
}

export type TextRenderPlugin = TextDecoderPlugin | TextTransformerPlugin;

export type TextRenderingStorage = Pick<Storage, "getItem" | "setItem">;
