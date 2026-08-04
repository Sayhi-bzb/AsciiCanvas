export type AsciiCanvasTextAttributes = {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  inverse?: true;
};

export type AsciiCanvasTextStyle = {
  color?: string;
  bgColor?: string;
  attrs?: AsciiCanvasTextAttributes;
};

export type AsciiCanvasTextCell = AsciiCanvasTextStyle & {
  x: number;
  y: number;
  width: 1 | 2;
  text: string;
  href?: string;
};

export type AsciiCanvasTextDiagnosticCode =
  | "malformed-ansi"
  | "unsupported-control"
  | "unsupported-sgr";

export type AsciiCanvasTextDiagnostic = {
  code: AsciiCanvasTextDiagnosticCode;
  offset: number;
  length: number;
  message: string;
};

export type AsciiCanvasTextSyntax = "auto" | "plain" | "ansi";

export type ParseAsciiCanvasTextOptions = {
  syntax?: AsciiCanvasTextSyntax;
  defaultStyle?: AsciiCanvasTextStyle;
  tabSize?: number;
};

export type ParsedAsciiCanvasText = {
  version: 1;
  source: string;
  plainText: string;
  width: number;
  height: number;
  cells: AsciiCanvasTextCell[];
  hasAnsi: boolean;
  diagnostics: AsciiCanvasTextDiagnostic[];
};
