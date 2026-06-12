import {
  getAnimationFrameEntries,
  normalizeAnimationCanvasSize,
  normalizeAnimationTimeline,
} from "@/domains/canvas/state/helpers/animationHelpers";
import type {
  AnimationCanvasSize,
  AnimationTimeline,
  GridCell,
  StructuredNode,
} from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import { sceneToGridEntries } from "@/shared/utils/structured";
import type {
  AsciiCanvasAnimationDocumentV1,
  AsciiCanvasDocumentV1,
  AsciiCanvasFreeformDocumentV1,
  AsciiCanvasProtocolCellV1,
  AsciiCanvasProtocolNodeV1,
  AsciiCanvasStructuredDocumentV1,
} from "./types";
import { isAsciiCanvasDocument } from "./validation";

export interface ProtocolImportSnapshot {
  mode: AsciiCanvasDocumentV1["mode"];
  scene: StructuredNode[];
  grid: [string, GridCell][];
  size?: AnimationCanvasSize;
  timeline?: AnimationTimeline;
}

const toGridEntries = (cells: AsciiCanvasProtocolCellV1[]) => {
  const entries = new Map<string, GridCell>();

  cells.forEach((cell) => {
    entries.set(GridManager.toKey(cell.x, cell.y), {
      char: cell.char,
      color: cell.color,
    });
  });

  return Array.from(entries.entries());
};

const cloneStructuredProtocolNode = (
  node: AsciiCanvasProtocolNodeV1
): StructuredNode => {
  switch (node.type) {
    case "box":
      return {
        type: "box",
        id: node.id,
        order: node.order,
        start: { ...node.start },
        end: { ...node.end },
        style: { color: node.style.color },
        ...(node.name ? { name: node.name } : {}),
      };
    case "line":
      return {
        type: "line",
        id: node.id,
        order: node.order,
        start: { ...node.start },
        end: { ...node.end },
        axis: node.axis,
        style: { color: node.style.color },
      };
    case "text":
      return {
        type: "text",
        id: node.id,
        order: node.order,
        position: { ...node.position },
        text: node.text,
        style: { color: node.style.color },
      };
  }
};

const importFreeformDocument = (
  document: AsciiCanvasFreeformDocumentV1
): ProtocolImportSnapshot => {
  return {
    mode: "freeform",
    scene: [],
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
    size,
    timeline,
    grid: getAnimationFrameEntries(timeline, timeline.currentFrameId),
  };
};

const importStructuredDocument = (
  document: AsciiCanvasStructuredDocumentV1
): ProtocolImportSnapshot => {
  const scene = document.nodes.map(cloneStructuredProtocolNode);
  return {
    mode: "structured",
    scene,
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
