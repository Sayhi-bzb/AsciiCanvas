import {
  getAnimationFrameEntries,
  normalizeAnimationCanvasSize,
  normalizeAnimationTimeline
} from "@/domains/animation/public";import type { GridCell } from "@/shared/types";
import type { StructuredNode } from "@/domains/structured-content/public";
import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import { GridManager } from "@/shared/utils/grid";
import { sceneToGridEntries } from "@/domains/structured-content/public";
import type {
  AsciiCanvasAnimationDocumentV1,
  AsciiCanvasDocumentV1,
  AsciiCanvasFreeformDocumentV1,
  AsciiCanvasProtocolCellV1,
  AsciiCanvasProtocolNodeV1,
  AsciiCanvasStructuredDocumentV1,
} from "./types";
import { isAsciiCanvasDocument } from "./validation";
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

export type ProtocolImportSnapshot = CanvasImportSnapshot;

const toGridEntries = (cells: AsciiCanvasProtocolCellV1[]) => {
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
  node: AsciiCanvasProtocolNodeV1
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
  document: AsciiCanvasFreeformDocumentV1
): ProtocolImportSnapshot => {
  return {
    mode: "freeform",
    scene: [],
    components: [],
    grid: toGridEntries(document.cells),
  };
};

const importAnimationDocument = (
  document: AsciiCanvasAnimationDocumentV1
): ProtocolImportSnapshot => {
  const size = normalizeAnimationCanvasSize(document.size);
  const timeline = normalizeAnimationTimeline({
    currentFrameId: document.frames[0]?.id,
    fps: document.playback.fps,
    loop: document.playback.loop,
    frames: document.frames.map((frame) => ({
      id: frame.id,
      name: frame.name,
      grid: toGridEntries(frame.cells),
    })),
  });

  return {
    mode: "animation",
    scene: [],
    components: [],
    size,
    timeline,
    grid: getAnimationFrameEntries(timeline, timeline.currentFrameId),
  };
};

const importStructuredDocument = (
  document: AsciiCanvasStructuredDocumentV1
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

export const parseProtocolDocument = (
  raw: string | unknown
): AsciiCanvasDocumentV1 => {
  const parsed =
    typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;

  if (!isAsciiCanvasDocument(parsed)) {
    throw new Error("Invalid ascii-canvas-document payload.");
  }

  return parsed;
};

export const protocolDocumentToSnapshot = (
  document: AsciiCanvasDocumentV1
): ProtocolImportSnapshot => {
  switch (document.mode) {
    case "freeform":
      return importFreeformDocument(document);
    case "animation":
      return importAnimationDocument(document);
    case "structured":
      return importStructuredDocument(document);
  }
};
