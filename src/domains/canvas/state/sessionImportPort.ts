import type { CanvasImportSnapshot } from "./interfaces";

export type CanvasSessionSourceParser = (
  raw: string | unknown
) => CanvasImportSnapshot;

let sourceParser: CanvasSessionSourceParser = () => {
  throw new Error("Canvas session source parser is not registered");
};

export const registerCanvasSessionSourceParser = (
  parser: CanvasSessionSourceParser
) => {
  sourceParser = parser;
};

export const parseCanvasSessionSource: CanvasSessionSourceParser = (raw) =>
  sourceParser(raw);
