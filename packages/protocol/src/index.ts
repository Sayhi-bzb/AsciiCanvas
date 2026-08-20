export {
  CHARDESK_TEXT_PROTOCOL_VERSION,
  parseCharDeskText,
  stripCharDeskAnsi,
} from "./parser.js";
export { layoutCharDeskTextRuns } from "./runs.js";
export { decodeCharDeskTextRuns } from "./decode.js";
export {
  getGraphemeCellWidth,
  getTextCellWidth,
  splitGraphemes,
  UNICODE_DATA_VERSION,
} from "./graphemes.js";
export {
  compareCharDeskGeometry,
  createCharDeskGeometrySnapshot,
} from "./geometry.js";
export type {
  CharDeskGeometryCell,
  CharDeskAnsiEvidence,
  CharDeskGeometryComparison,
  CharDeskGeometryMismatch,
  CharDeskGeometrySnapshot,
  CharDeskTextAttributes,
  CharDeskTextCell,
  CharDeskTextDiagnostic,
  CharDeskTextDiagnosticCode,
  CharDeskTextStyle,
  CharDeskTextRun,
  CharDeskTextSyntax,
  CompareCharDeskGeometryOptions,
  LayoutCharDeskTextRunsOptions,
  ParseCharDeskTextOptions,
  ParsedCharDeskText,
  DecodedCharDeskTextRuns,
} from "./types.js";
