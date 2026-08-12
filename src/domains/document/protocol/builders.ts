import type { GridMap } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import { cloneTextAttributes } from "@/shared/utils/ansi";
import {
  normalizeStructuredComponents,
} from "@/domains/structured-content/public";
import { cloneStructuredTextStyleRanges } from "@/domains/structured-content/public";
import {
  CHARDESK_DOCUMENT_TYPE,
  CHARDESK_DOCUMENT_VERSION,
} from "./types";
import type {
  CharDeskDocumentV1,
  CharDeskFreeformDocumentV1,
  CharDeskDocumentCellV1,
  CharDeskDocumentNodeV1,
  CharDeskStructuredDocumentV1,
} from "./types";

const assertNever = (value: never): never => {
  throw new Error(`Unsupported structured node: ${JSON.stringify(value)}`);
};

const cloneComponentMetadata = (component: StructuredNode["component"]) =>
  component
    ? {
        component: {
          instanceId: component.instanceId,
          templateId: component.templateId,
          role: component.role,
        },
      }
    : {};

const sortCells = (cells: CharDeskDocumentCellV1[]) => {
  return [...cells].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    if (a.char !== b.char) return a.char.localeCompare(b.char);
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return (a.bgColor ?? "").localeCompare(b.bgColor ?? "");
  });
};

const gridEntriesToCells = (
  entries: Iterable<
    [
      string,
      {
        char: string;
        color: string;
        bgColor?: string;
        attrs?: CharDeskDocumentCellV1["attrs"];
        href?: string;
      },
    ]
  >
) => {
  const cells: CharDeskDocumentCellV1[] = [];

  for (const [key, cell] of entries) {
    const [x, y] = key.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    cells.push({
      x,
      y,
      char: cell.char,
      color: cell.color,
      ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
      ...(cloneTextAttributes(cell.attrs)
        ? { attrs: cloneTextAttributes(cell.attrs) }
        : {}),
      ...(cell.href ? { href: cell.href } : {}),
    });
  }

  return sortCells(cells);
};

const cloneStructuredNode = (
  node: StructuredNode
): CharDeskDocumentNodeV1 => {
  const style = {
    color: node.style.color,
    ...(node.style.bgColor ? { bgColor: node.style.bgColor } : {}),
    ...(cloneTextAttributes(node.style.attrs)
      ? { attrs: cloneTextAttributes(node.style.attrs) }
      : {}),
  };
  switch (node.type) {
    case "box":
      return {
        type: "box",
        id: node.id,
        order: node.order,
        start: { ...node.start },
        end: { ...node.end },
        style,
        ...(node.name ? { name: node.name } : {}),
        ...cloneComponentMetadata(node.component),
      };
    case "splitBox":
      return {
        type: "splitBox",
        id: node.id,
        order: node.order,
        start: { ...node.start },
        end: { ...node.end },
        verticalSplitRatio: node.verticalSplitRatio,
        topSplitRatio: node.topSplitRatio,
        bottomSplitRatio: node.bottomSplitRatio,
        ...(node.root ? { root: node.root } : {}),
        style,
        ...cloneComponentMetadata(node.component),
      };
    case "line":
      return {
        type: "line",
        id: node.id,
        order: node.order,
        start: { ...node.start },
        end: { ...node.end },
        axis: node.axis,
        ...(node.endMarker ? { endMarker: node.endMarker } : {}),
        style,
        ...cloneComponentMetadata(node.component),
      };
    case "bg":
      return {
        type: "bg",
        id: node.id,
        order: node.order,
        start: { ...node.start },
        end: { ...node.end },
        style,
        ...cloneComponentMetadata(node.component),
      };
    case "text":
      return {
        type: "text",
        id: node.id,
        order: node.order,
        position: { ...node.position },
        text: node.text,
        style,
        ...(cloneStructuredTextStyleRanges(node.styleRanges)
          ? { styleRanges: cloneStructuredTextStyleRanges(node.styleRanges) }
          : {}),
        ...cloneComponentMetadata(node.component),
      };
    default:
      return assertNever(node);
  }
};

const sortStructuredNodes = (nodes: StructuredNode[]) => {
  return [...nodes].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
};

export const buildFreeformCharDeskDocument = (
  grid: GridMap
): CharDeskFreeformDocumentV1 => {
  return {
    type: CHARDESK_DOCUMENT_TYPE,
    version: CHARDESK_DOCUMENT_VERSION,
    mode: "freeform",
    cells: gridEntriesToCells(grid.entries()),
  };
};

export const buildStructuredCharDeskDocument = (
  scene: StructuredNode[],
  components?: StructuredComponentInstance[]
): CharDeskStructuredDocumentV1 => {
  const normalizedComponents = normalizeStructuredComponents(components, scene);
  return {
    type: CHARDESK_DOCUMENT_TYPE,
    version: CHARDESK_DOCUMENT_VERSION,
    mode: "structured",
    nodes: sortStructuredNodes(scene).map(cloneStructuredNode),
    ...(normalizedComponents.length > 0
      ? { components: normalizedComponents }
      : {}),
  };
};

interface ProtocolCanvasStateSnapshotInput {
  canvasMode: CanvasMode;
  grid: GridMap;
  structuredScene: StructuredNode[];
  structuredComponents?: StructuredComponentInstance[];
}

export const buildCharDeskDocumentFromCanvasState = (
  input: ProtocolCanvasStateSnapshotInput
): CharDeskDocumentV1 => {
  switch (input.canvasMode) {
    case "freeform":
      return buildFreeformCharDeskDocument(input.grid);
    case "structured":
      return buildStructuredCharDeskDocument(
        input.structuredScene,
        input.structuredComponents
      );
    case "slide":
      throw new Error("Slide deck export is not supported");
  }
};
