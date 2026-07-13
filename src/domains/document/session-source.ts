import {
  registerCanvasSessionSourceParser,
} from "@/domains/canvas/public";
import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import { isLikelyAsciinemaCast, parseAsciinemaCast } from "./cast/utils/cast";
import {
  parseProtocolDocument,
  protocolDocumentToSnapshot,
} from "./protocol/import";

const parseDocumentSessionSource = (
  raw: string | unknown
): CanvasImportSnapshot =>
  typeof raw === "string" && isLikelyAsciinemaCast(raw)
    ? parseAsciinemaCast(raw)
    : protocolDocumentToSnapshot(parseProtocolDocument(raw));

registerCanvasSessionSourceParser(parseDocumentSessionSource);
