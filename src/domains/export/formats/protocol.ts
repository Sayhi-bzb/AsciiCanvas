import { buildProtocolDocumentFromCanvasState } from "@/domains/document/public";
import type { AsciiCanvasDocumentV1 } from "@/domains/document/public";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import type {
  AnimationCanvasSize,
  AnimationTimeline,
  CanvasMode,
  GridCell,
  GridMap,
  StructuredComponentInstance,
  StructuredNode,
} from "@/shared/types";
import { cloneTextAttributes } from "@/shared/utils/ansi";

const MONOCHROME_EXPORT_COLOR = COLOR_PRIMARY_TEXT;
type AnimationExchangeCell = {
  x: number;
  y: number;
  char: string;
  color: string;
  bgColor?: string;
  attrs?: GridCell["attrs"];
  href?: string;
};

type AnimationExchangeDocument = {
  type: "ascii-animation";
  version: 1;
  size: AnimationCanvasSize;
  playback: {
    fps: number;
    loop: boolean;
  };
  frames: Array<{
    name: string;
    cells: AnimationExchangeCell[];
  }>;
};

interface ProtocolExportInput {
  canvasMode: CanvasMode;
  grid: GridMap;
  structuredScene: StructuredNode[];
  structuredComponents?: StructuredComponentInstance[];
  canvasBounds: AnimationCanvasSize | null;
  animationTimeline: AnimationTimeline | null;
  includeColor?: boolean;
}

const applyMonochromeProtocolColor = (
  document: AsciiCanvasDocumentV1
): AsciiCanvasDocumentV1 => {
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
    case "animation":
      return {
        ...document,
        frames: document.frames.map((frame) => ({
          ...frame,
          cells: frame.cells.map((cell) => ({
            x: cell.x,
            y: cell.y,
            char: cell.char,
            color: MONOCHROME_EXPORT_COLOR,
          })),
        })),
      };
    case "structured":
      return {
        ...document,
        nodes: document.nodes.map((node) => ({
          ...node,
          style: {
            color: MONOCHROME_EXPORT_COLOR,
          },
        })),
      };
  }
};

export const buildAnimationExchangeDocument = (
  size: AnimationCanvasSize,
  timeline: AnimationTimeline
): AnimationExchangeDocument => {
  return {
    type: "ascii-animation",
    version: 1,
    size,
    playback: {
      fps: timeline.fps,
      loop: timeline.loop,
    },
    frames: timeline.frames.map((frame) => ({
      name: frame.name,
      cells: frame.grid.map(([key, cell]) => {
        const [x, y] = key.split(",").map(Number);
        return {
          x,
          y,
          char: cell.char,
          color: cell.color,
          ...(cell.bgColor ? { bgColor: cell.bgColor } : {}),
          ...(cloneTextAttributes(cell.attrs)
            ? { attrs: cloneTextAttributes(cell.attrs) }
            : {}),
          ...(cell.href ? { href: cell.href } : {}),
        };
      }),
    })),
  };
};

export const buildProtocolExportDocument = ({
  canvasMode,
  grid,
  structuredScene,
  structuredComponents,
  canvasBounds,
  animationTimeline,
  includeColor = true,
}: ProtocolExportInput) => {
  const document = buildProtocolDocumentFromCanvasState({
    canvasMode,
    grid,
    structuredScene,
    structuredComponents,
    canvasBounds,
    animationTimeline,
  });
  return includeColor ? document : applyMonochromeProtocolColor(document);
};

export const exportProtocolToJSON = (input: ProtocolExportInput) => {
  return JSON.stringify(buildProtocolExportDocument(input), null, 2);
};

export const exportAnimationToJSON = (
  size: AnimationCanvasSize,
  timeline: AnimationTimeline
) => {
  return JSON.stringify(buildAnimationExchangeDocument(size, timeline), null, 2);
};

