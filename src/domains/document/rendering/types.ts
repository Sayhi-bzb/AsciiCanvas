import type { CharGraphFragment } from "@chardesk/chargraph";
import type { CharDeskTextStyle } from "@chardesk/protocol";
import type { I18nKey } from "@/shared/i18n";
import type { GridCell } from "@/shared/types";

export type BuiltInTextRendererId = "raw" | "ansi" | "markdown";
export type TextRendererId = string;
export type TextRendererMode = "auto" | TextRendererId;
export type TextRenderThemeTokenId =
  | "foreground"
  | "background"
  | "accent"
  | "accent-foreground"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "surface"
  | "surface-foreground";
export type TextRenderTheme = Record<TextRenderThemeTokenId, string>;
export type TextRenderThemeOverrides = Partial<TextRenderTheme>;
export type TextRenderColorDefault =
  | { readonly kind: "inherit" }
  | { readonly kind: "token"; readonly token: TextRenderThemeTokenId }
  | {
      readonly kind: "mixed";
      readonly tokens: readonly TextRenderThemeTokenId[];
      readonly includesInherited?: boolean;
    };
export type TextRenderFeatureId = string;
export type TextRenderFeatureColorSlotDefinition = {
  readonly id: string;
  readonly label?: I18nKey;
  readonly default: TextRenderColorDefault;
};
export type TextRenderFeatureDefinition = {
  readonly id: TextRenderFeatureId;
  readonly rendererId: TextRendererId;
  readonly settingsGroup: string;
  readonly label: I18nKey;
  readonly defaultEnabled: boolean;
  readonly colorSlots: readonly TextRenderFeatureColorSlotDefinition[];
};
export type TextRenderFeatureConfig = {
  enabled: boolean;
  colors: Record<string, string>;
};
export type TextRenderFeatureSettings = Record<
  TextRenderFeatureId,
  TextRenderFeatureConfig
>;

export type TextRenderProfile = {
  mode: TextRendererMode;
  renderTheme: TextRenderThemeOverrides;
  features: TextRenderFeatureSettings;
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
  features: TextRenderFeatureSettings;
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
