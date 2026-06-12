import type {
  AnimationCanvasSize,
  AnimationTimeline,
  CanvasMode,
  GridMap,
  StructuredNode,
} from "@/shared/types";
import {
  ASCII_CANVAS_DOCUMENT_TYPE,
  ASCII_CANVAS_DOCUMENT_VERSION,
} from "./types";
import type {
  AsciiCanvasAnimationDocumentV1,
  AsciiCanvasDocumentV1,
  AsciiCanvasFreeformDocumentV1,
  AsciiCanvasProtocolCellV1,
  AsciiCanvasProtocolNodeV1,
  AsciiCanvasStructuredDocumentV1,
} from "./types";

const sortCells = (cells: AsciiCanvasProtocolCellV1[]) => {
  return [...cells].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.x !== b.x) return a.x - b.x;
    if (a.char !== b.char) return a.char.localeCompare(b.char);
    return a.color.localeCompare(b.color);
  });
};

const gridEntriesToCells = (
  entries: Iterable<[string, { char: string; color: string }]>
) => {
  const cells: AsciiCanvasProtocolCellV1[] = [];

  for (const [key, cell] of entries) {
    const [x, y] = key.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    cells.push({
      x,
      y,
      char: cell.char,
      color: cell.color,
    });
  }

  return sortCells(cells);
};

const cloneStructuredNode = (
  node: StructuredNode
): AsciiCanvasProtocolNodeV1 => {
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

const sortStructuredNodes = (nodes: StructuredNode[]) => {
  return [...nodes].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id.localeCompare(b.id);
  });
};

export const buildFreeformProtocolDocument = (
  grid: GridMap
): AsciiCanvasFreeformDocumentV1 => {
  return {
    type: ASCII_CANVAS_DOCUMENT_TYPE,
    version: ASCII_CANVAS_DOCUMENT_VERSION,
    mode: "freeform",
    cells: gridEntriesToCells(grid.entries()),
  };
};

export const buildAnimationProtocolDocument = (
  size: AnimationCanvasSize,
  timeline: AnimationTimeline
): AsciiCanvasAnimationDocumentV1 => {
  return {
    type: ASCII_CANVAS_DOCUMENT_TYPE,
    version: ASCII_CANVAS_DOCUMENT_VERSION,
    mode: "animation",
    size: {
      width: size.width,
      height: size.height,
    },
    playback: {
      fps: timeline.fps,
      loop: timeline.loop,
    },
    frames: timeline.frames.map((frame) => ({
      id: frame.id,
      name: frame.name,
      cells: gridEntriesToCells(frame.grid),
    })),
  };
};

export const buildStructuredProtocolDocument = (
  scene: StructuredNode[]
): AsciiCanvasStructuredDocumentV1 => {
  return {
    type: ASCII_CANVAS_DOCUMENT_TYPE,
    version: ASCII_CANVAS_DOCUMENT_VERSION,
    mode: "structured",
    nodes: sortStructuredNodes(scene).map(cloneStructuredNode),
  };
};

type BuildProtocolDocumentByModeInput =
  | {
      mode: "freeform";
      grid: GridMap;
    }
  | {
      mode: "animation";
      size: AnimationCanvasSize;
      timeline: AnimationTimeline;
    }
  | {
      mode: "structured";
      scene: StructuredNode[];
    };

export const buildProtocolDocument = (
  input: BuildProtocolDocumentByModeInput
): AsciiCanvasDocumentV1 => {
  switch (input.mode) {
    case "freeform":
      return buildFreeformProtocolDocument(input.grid);
    case "animation":
      return buildAnimationProtocolDocument(input.size, input.timeline);
    case "structured":
      return buildStructuredProtocolDocument(input.scene);
  }
};

export interface ProtocolCanvasStateSnapshotInput {
  canvasMode: CanvasMode;
  grid: GridMap;
  structuredScene: StructuredNode[];
  canvasBounds: AnimationCanvasSize | null;
  animationTimeline: AnimationTimeline | null;
}

export const buildProtocolDocumentFromCanvasState = (
  input: ProtocolCanvasStateSnapshotInput
): AsciiCanvasDocumentV1 => {
  switch (input.canvasMode) {
    case "freeform":
      return buildFreeformProtocolDocument(input.grid);
    case "structured":
      return buildStructuredProtocolDocument(input.structuredScene);
    case "animation":
      if (!input.canvasBounds || !input.animationTimeline) {
        throw new Error(
          "Animation protocol export requires both canvasBounds and animationTimeline."
        );
      }
      return buildAnimationProtocolDocument(
        input.canvasBounds,
        input.animationTimeline
      );
  }
};
