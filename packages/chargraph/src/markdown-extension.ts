import type { CharDeskTextStyle } from "@chardesk/protocol";
import type { MarkedExtension, Token } from "marked";
import type {
  CharGraphAwaitable,
  CharGraphRenderResult,
  CharGraphSourceRange,
} from "./model.js";

export type MarkdownExtensionRenderRequest =
  | {
      kind: "fenced-code";
      language: string;
      source: string;
      sourceOrigin: CharGraphSourceRange;
      rawSource: string;
      rawOrigin: CharGraphSourceRange;
    }
  | {
      kind: "token";
      token: Token;
      source: string;
      sourceOrigin: CharGraphSourceRange;
    };

export type MarkdownExtensionRenderContext = {
  enabled(rule: string): boolean;
  style(role: string): CharDeskTextStyle | undefined;
};

export interface MarkdownSyntaxExtension {
  readonly id: string;
  readonly marked?: MarkedExtension;
  readonly tokenTypes?: readonly string[];
  readonly fencedLanguages?: readonly string[];
  render(
    request: MarkdownExtensionRenderRequest,
    context: MarkdownExtensionRenderContext
  ): CharGraphAwaitable<CharGraphRenderResult | null>;
}
