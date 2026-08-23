import type { CharDeskTextStyle } from "@chardesk/protocol";
import type { MarkedExtension, Token } from "marked";
import type {
  CharGraphAwaitable,
  CharGraphFragment,
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

export type MarkdownExtensionRenderContext<StyleRole extends string = string> = {
  enabled(rule: string): boolean;
  style(role: StyleRole): CharDeskTextStyle | undefined;
  renderBlocks(
    tokens: readonly Token[],
    sourceOrigin: CharGraphSourceRange
  ): Promise<CharGraphFragment[]>;
};

export interface MarkdownSyntaxExtension<StyleRole extends string = string> {
  readonly id: string;
  readonly marked?: MarkedExtension;
  readonly tokenTypes?: readonly string[];
  readonly fencedLanguages?: readonly string[];
  render(
    request: MarkdownExtensionRenderRequest,
    context: MarkdownExtensionRenderContext<StyleRole>
  ): CharGraphAwaitable<CharGraphRenderResult | null>;
}
