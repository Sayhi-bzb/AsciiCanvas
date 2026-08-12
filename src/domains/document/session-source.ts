import {
  registerCanvasSessionSourceParser,
} from "@/domains/canvas/public";
import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import { parseSlideMarkdown } from "@/domains/slides/public";
import {
  parseProtocolDocument,
  protocolDocumentToSnapshot,
} from "./protocol/import";

const parseDocumentSessionSource = (
  raw: string | unknown
): CanvasImportSnapshot => {
  if (
    typeof raw === "string" &&
    raw.replace(/^\uFEFF/, "").startsWith("---")
  ) {
    const parsed = parseSlideMarkdown(raw);
    return {
      mode: "slide",
      slideDeck: parsed.slideDeck,
      ...(parsed.title ? { name: parsed.title } : {}),
    };
  }

  return protocolDocumentToSnapshot(parseProtocolDocument(raw));
};

export const registerDocumentSessionSource = () => {
  registerCanvasSessionSourceParser(parseDocumentSessionSource);
};
