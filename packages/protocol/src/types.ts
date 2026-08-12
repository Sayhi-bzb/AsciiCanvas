export type CharDeskTextAttributes = {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  inverse?: true;
};

export type CharDeskTextStyle = {
  color?: string;
  bgColor?: string;
  attrs?: CharDeskTextAttributes;
};

export type CharDeskTextCell = CharDeskTextStyle & {
  x: number;
  y: number;
  width: 1 | 2;
  text: string;
  href?: string;
};

export type CharDeskTextDiagnosticCode =
  | "malformed-ansi"
  | "unsupported-control"
  | "unsupported-sgr";

export type CharDeskTextDiagnostic = {
  code: CharDeskTextDiagnosticCode;
  offset: number;
  length: number;
  message: string;
};

export type CharDeskTextSyntax = "auto" | "plain" | "ansi";

export type ParseCharDeskTextOptions = {
  syntax?: CharDeskTextSyntax;
  defaultStyle?: CharDeskTextStyle;
  tabSize?: number;
};

export type ParsedCharDeskText = {
  version: 1;
  source: string;
  plainText: string;
  width: number;
  height: number;
  cells: CharDeskTextCell[];
  hasAnsi: boolean;
  diagnostics: CharDeskTextDiagnostic[];
};
