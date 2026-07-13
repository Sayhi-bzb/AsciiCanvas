export {
  ASCII_CANVAS_DOCUMENT_TYPE,
  ASCII_CANVAS_DOCUMENT_VERSION,
} from "./protocol/types";
export type { AsciiCanvasDocumentV1 } from "./protocol/types";
export {
  buildAnimationProtocolDocument,
  buildFreeformProtocolDocument,
  buildProtocolDocument,
  buildProtocolDocumentFromCanvasState,
  buildStructuredProtocolDocument,
} from "./protocol/builders";
export { isAsciiCanvasDocument } from "./protocol/validation";
export {
  parseProtocolDocument,
  protocolDocumentToSnapshot,
} from "./protocol/import";
export {
  isLikelyAsciinemaCast,
  parseAsciinemaCast,
} from "./cast/utils/cast";
import "./session-source";
