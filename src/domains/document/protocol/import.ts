import type { GridCell } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import { GridManager } from "@/shared/utils/grid";
import { sceneToGridEntries } from "@/domains/structured-content/public";
import type {
  CharDeskDocumentV1,
  CharDeskFreeformDocumentV1,
  CharDeskDocumentCellV1,
  CharDeskDocumentNodeV1,
  CharDeskStructuredDocumentV1,
} from "./types";
import { isCharDeskDocument } from "./validation";
import { cloneTextAttributes } from "@/shared/utils/ansi";
import { cloneStructuredTextStyleRanges } from "@/domains/structured-content/public";
import {
  normalizeStructuredComponents,
} from "@/domains/structured-content/public";

const assertNever = (value: never): never => {
  throw new Error(`Unsupported structured protocol node: ${JSON.stringify(value)}`);
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

type ProtocolImportSnapshot = Exclude<CanvasImportSnapshot, { mode: "slide" }>;

const toGridEntries = (cells: CharDeskDocumentCellV1[]) => {
  const entries = new Map<string, GridCell>();

  cells.forEach((cell) => {
    entries.set(GridManager.toKey(cell.x, cell.y), {
      char: cell.char,
      color: cell.color,
      ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
      ...(cloneTextAttributes(cell.attrs)
        ? { attrs: cloneTextAttributes(cell.attrs) }
        : {}),
      ...(cell.href ? { href: cell.href } : {}),
    });
  });

  return Array.from(entries.entries());
};

const cloneStructuredProtocolNode = (
  node: CharDeskDocumentNodeV1
): StructuredNode => {
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

const importFreeformDocument = (
  document: CharDeskFreeformDocumentV1
): ProtocolImportSnapshot => {
  return {
    mode: "freeform",
    scene: [],
    components: [],
    grid: toGridEntries(document.cells),
  };
};

const importStructuredDocument = (
  document: CharDeskStructuredDocumentV1
): ProtocolImportSnapshot => {
  const scene = document.nodes.map(cloneStructuredProtocolNode);
  const components = normalizeStructuredComponents(document.components, scene);
  return {
    mode: "structured",
    scene,
    components,
    grid: sceneToGridEntries(scene),
  };
};

export const parseCharDeskDocument = (
  raw: string | unknown
): CharDeskDocumentV1 => {
  const parsed =
    typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;

  if (!isCharDeskDocument(parsed)) {
    throw new Error("Invalid chardesk-document payload.");
  }

  return parsed;
};

export const charDeskDocumentToSnapshot = (
  document: CharDeskDocumentV1
): ProtocolImportSnapshot => {
  switch (document.mode) {
    case "freeform":
      return importFreeformDocument(document);
    case "structured":
      return importStructuredDocument(document);
  }
};
