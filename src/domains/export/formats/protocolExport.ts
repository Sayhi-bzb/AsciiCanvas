import { buildCharDeskDocumentFromCanvasState } from "@/domains/document/public";
import type { CharDeskDocumentV1 } from "@/domains/document/public";
import type { CanvasMode } from "@/domains/sessions/public";
import type {
  StructuredComponentInstance,
  StructuredNode,
} from "@/domains/structured-content/public";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import type { GridMap } from "@/shared/types";

const MONOCHROME_EXPORT_COLOR = COLOR_PRIMARY_TEXT;

interface ProtocolExportInput {
  canvasMode: CanvasMode;
  grid: GridMap;
  structuredScene: StructuredNode[];
  structuredComponents?: StructuredComponentInstance[];
  includeColor?: boolean;
}

const applyMonochromeProtocolColor = (
  document: CharDeskDocumentV1
): CharDeskDocumentV1 => {
  switch (document.mode) {
    case "freeform":
      return {
        ...document,
        cells: document.cells.map((cell) => ({
          x: cell.x,
          y: cell.y,
          char: cell.char,
          color: MONOCHROME_EXPORT_COLOR,
        })),
      };
    case "structured":
      return {
        ...document,
        nodes: document.nodes.map((node) => ({
          ...node,
          style: { color: MONOCHROME_EXPORT_COLOR },
        })),
      };
  }
};

export const buildCharDeskExportDocument = ({
  canvasMode,
  grid,
  structuredScene,
  structuredComponents,
  includeColor = true,
}: ProtocolExportInput) => {
  const document = buildCharDeskDocumentFromCanvasState({
    canvasMode,
    grid,
    structuredScene,
    structuredComponents,
  });
  return includeColor ? document : applyMonochromeProtocolColor(document);
};

export const exportCharDeskDocumentToJSON = (input: ProtocolExportInput) =>
  JSON.stringify(buildCharDeskExportDocument(input), null, 2);
