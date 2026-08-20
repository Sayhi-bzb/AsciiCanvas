import type { CharDeskTextStyle } from "@chardesk/protocol";
import type { GridCell, TextAttributes } from "@/shared/types";

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
  | "thematic-break"
  | "code-block"
  | "table";

export type MarkdownRenderRules = Record<MarkdownRenderRuleId, boolean>;
export type MarkdownColorRuleId = Exclude<MarkdownRenderRuleId, "code-block">;
export type MarkdownRenderColors = Partial<Record<MarkdownColorRuleId, string>>;

export type TextRenderProfile = {
  mode: TextRendererMode;
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

export type TextRenderFragment = TextStyle & {
  text: string;
  origin?: { from: number; to: number };
};

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

export type MarkdownRuleDecoration = {
  attrs?: Partial<Record<keyof TextAttributes, true>>;
  href?: string;
};

export interface MarkdownRenderRule {
  readonly id: MarkdownRenderRuleId;
  readonly nodeTypes: readonly string[];
  decorate(node: unknown): MarkdownRuleDecoration;
}

export type TextRenderingStorage = Pick<Storage, "getItem" | "setItem">;
