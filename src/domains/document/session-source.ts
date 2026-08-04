import {
  registerCanvasSessionSourceParser,
} from "@/domains/canvas/public";
import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import {
  parseProtocolDocument,
  protocolDocumentToSnapshot,
} from "./protocol/import";

const parseDocumentSessionSource = (
  raw: string | unknown
): CanvasImportSnapshot =>
  protocolDocumentToSnapshot(parseProtocolDocument(raw));

registerCanvasSessionSourceParser(parseDocumentSessionSource);
