import { parseCharDeskDocumentEnvelope } from "@chardesk/document";

export const resolveBlackboardSource = (source: string) => {
  const document = parseCharDeskDocumentEnvelope(source);
  if (!document) return source;
  if (document.mode !== "freeform") {
    throw new Error(`Blackboard supports freeform documents, not ${document.mode}.`);
  }
  return document.body;
};
