import type { CharDeskTextStyle } from "@chardesk/protocol";
import type { ThemeRegistration } from "shiki";
import type { MarkdownTextStyles } from "./markdown.js";
import type { MarkdownSyntaxExtension } from "./markdown-extension.js";
import type {
  CharDeskRenderColorDefault,
  CharDeskRenderTheme,
} from "./render-theme.js";

export type CharDeskMarkdownFeatureKind = "core" | "extension" | "style";

export type CharDeskMarkdownFeatureContract = {
  readonly id: string;
  readonly kind: CharDeskMarkdownFeatureKind;
  readonly defaultEnabled: boolean;
  readonly colorSlots: Readonly<Record<string, CharDeskRenderColorDefault>>;
};

export type CharDeskMarkdownStyleContribution = {
  readonly styles?: MarkdownTextStyles;
  readonly extensionStyles?: Readonly<Record<string, CharDeskTextStyle>>;
  readonly codeTheme?: ThemeRegistration;
};

export type CharDeskMarkdownModuleStyleContext = {
  readonly theme: CharDeskRenderTheme;
  color<Feature extends CharDeskMarkdownFeatureContract>(
    feature: Feature,
    slot: keyof Feature["colorSlots"] & string
  ): string | undefined;
};

export type CharDeskMarkdownModule = {
  readonly id: string;
  readonly extensions?: readonly MarkdownSyntaxExtension[];
  readonly features: readonly CharDeskMarkdownFeatureContract[];
  readonly styleRoles?: readonly string[];
  resolveStyles(
    context: CharDeskMarkdownModuleStyleContext
  ): CharDeskMarkdownStyleContribution;
};

export const defineCharDeskMarkdownFeature = <
  const Feature extends CharDeskMarkdownFeatureContract,
>(feature: Feature): Feature => feature;

export const defineCharDeskMarkdownModule = <
  const Module extends CharDeskMarkdownModule,
>(module: Module): Module => module;
