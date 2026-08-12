import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import { parseSlideMarkdown } from "@/domains/slides/public";
import {
  parseCharDeskDocument,
  charDeskDocumentToSnapshot,
} from "./protocol/import";

export const parseDocumentSessionSource = (
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

  return charDeskDocumentToSnapshot(parseCharDeskDocument(raw));
};
