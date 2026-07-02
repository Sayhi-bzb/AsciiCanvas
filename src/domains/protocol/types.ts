import type {
  AnimationCanvasSize,
  CanvasMode,
  Point,
  StructuredTextStyleRange,
  TextAttributes,
} from "@/shared/types";

export const ASCII_CANVAS_DOCUMENT_TYPE = "ascii-canvas-document";
export const ASCII_CANVAS_DOCUMENT_VERSION = 1;

export type AsciiCanvasDocumentType = typeof ASCII_CANVAS_DOCUMENT_TYPE;
export type AsciiCanvasDocumentVersion = typeof ASCII_CANVAS_DOCUMENT_VERSION;

export interface AsciiCanvasProtocolCellV1 {
  x: number;
  y: number;
  char: string;
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
  href?: string;
}

export interface AsciiCanvasProtocolPlaybackV1 {
  fps: number;
  loop: boolean;
}

export interface AsciiCanvasProtocolFrameV1 {
  id: string;
  name: string;
  cells: AsciiCanvasProtocolCellV1[];
}

export interface AsciiCanvasProtocolStyleV1 {
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
}

interface AsciiCanvasProtocolNodeBaseV1 {
  id: string;
  order: number;
  style: AsciiCanvasProtocolStyleV1;
}

export interface AsciiCanvasProtocolBoxNodeV1
  extends AsciiCanvasProtocolNodeBaseV1 {
  type: "box";
  start: Point;
  end: Point;
  name?: string;
}

export interface AsciiCanvasProtocolSplitBoxNodeV1
  extends AsciiCanvasProtocolNodeBaseV1 {
  type: "splitBox";
  start: Point;
  end: Point;
  verticalSplitRatio: number;
  topSplitRatio: number;
  bottomSplitRatio: number;
}

export interface AsciiCanvasProtocolLineNodeV1
  extends AsciiCanvasProtocolNodeBaseV1 {
  type: "line";
  start: Point;
  end: Point;
  axis: "vertical" | "horizontal";
}

export interface AsciiCanvasProtocolBgNodeV1
  extends AsciiCanvasProtocolNodeBaseV1 {
  type: "bg";
  start: Point;
  end: Point;
}

export interface AsciiCanvasProtocolTextNodeV1
  extends AsciiCanvasProtocolNodeBaseV1 {
  type: "text";
  position: Point;
  text: string;
  styleRanges?: StructuredTextStyleRange[];
}

export type AsciiCanvasProtocolNodeV1 =
  | AsciiCanvasProtocolBoxNodeV1
  | AsciiCanvasProtocolSplitBoxNodeV1
  | AsciiCanvasProtocolLineNodeV1
  | AsciiCanvasProtocolBgNodeV1
  | AsciiCanvasProtocolTextNodeV1;

interface AsciiCanvasDocumentBaseV1<TMode extends CanvasMode> {
  type: AsciiCanvasDocumentType;
  version: AsciiCanvasDocumentVersion;
  mode: TMode;
}

export interface AsciiCanvasFreeformDocumentV1
  extends AsciiCanvasDocumentBaseV1<"freeform"> {
  cells: AsciiCanvasProtocolCellV1[];
}

export interface AsciiCanvasAnimationDocumentV1
  extends AsciiCanvasDocumentBaseV1<"animation"> {
  size: AnimationCanvasSize;
  playback: AsciiCanvasProtocolPlaybackV1;
  frames: AsciiCanvasProtocolFrameV1[];
}

export interface AsciiCanvasStructuredDocumentV1
  extends AsciiCanvasDocumentBaseV1<"structured"> {
  nodes: AsciiCanvasProtocolNodeV1[];
}

export type AsciiCanvasDocumentV1 =
  | AsciiCanvasFreeformDocumentV1
  | AsciiCanvasAnimationDocumentV1
  | AsciiCanvasStructuredDocumentV1;
