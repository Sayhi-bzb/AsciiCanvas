import {
  registerCanvasSessionSourceParser,
  type CanvasImportSnapshot,
} from "@/domains/canvas/public";
import { isLikelyAsciinemaCast, parseAsciinemaCast } from "./cast/utils/cast";
import {
  parseProtocolDocument,
  protocolDocumentToSnapshot,
} from "./protocol/import";

export const parseDocumentSessionSource = (
  raw: string | unknown
): CanvasImportSnapshot =>
  typeof raw === "string" && isLikelyAsciinemaCast(raw)
    ? parseAsciinemaCast(raw)
    : protocolDocumentToSnapshot(parseProtocolDocument(raw));

registerCanvasSessionSourceParser(parseDocumentSessionSource);
