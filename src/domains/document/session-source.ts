import { parseCharDeskDocumentEnvelope } from "@chardesk/document";
import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import {
  isSlideMarkdownSource,
  parseSlideMarkdown,
  parseSlideMarkdownBody,
} from "@/domains/slides/public";
import { parseCharDeskCanvasSource } from "./protocol/import";
import { parseStructuredDocumentBody } from "./structured-source";

export const parseDocumentSessionSource = (
  raw: string | unknown
): CanvasImportSnapshot => {
  if (typeof raw !== "string") {
    throw new Error("CharDesk source must be text.");
  }

  const document = parseCharDeskDocumentEnvelope(raw);
  if (document) {
    if (document.mode === "freeform") {
      return {
        ...parseCharDeskCanvasSource(document.body),
        ...(document.title ? { name: document.title } : {}),
      };
    }
    if (document.mode === "structured") {
      return {
        ...parseStructuredDocumentBody(document.body),
        ...(document.title ? { name: document.title } : {}),
      };
    }
    const parsed = parseSlideMarkdownBody(document.body);
    return {
      mode: "slide",
      slideDeck: parsed.slideDeck,
      ...(document.title ? { name: document.title } : {}),
    };
  }

  if (isSlideMarkdownSource(raw)) {
    const parsed = parseSlideMarkdown(raw);
    return {
      mode: "slide",
      slideDeck: parsed.slideDeck,
      ...(parsed.title ? { name: parsed.title } : {}),
    };
  }

  return parseCharDeskCanvasSource(raw);
};
