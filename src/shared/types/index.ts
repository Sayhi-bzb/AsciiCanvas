export interface Point {
  x: number;
  y: number;
}

export interface GridCell {
  char: string;
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
  href?: string;
}

export interface GridPoint extends Point {
  char: string;
  color?: string;
  bgColor?: string;
  attrs?: TextAttributes;
  href?: string;
}

export interface SelectionArea {
  start: Point;
  end: Point;
}

export type GridMap = Map<string, GridCell>;

export interface AnimationCanvasSize {
  width: number;
  height: number;
}

export interface OnionSkinSettings {
  enabled: boolean;
  backwardLayers: number;
  forwardLayers: number;
  opacityFalloff: number[];
}

export interface AnimationFrame {
  id: string;
  name: string;
  grid: [string, GridCell][];
}

export interface AnimationTimeline {
  frames: AnimationFrame[];
  currentFrameId: string;
  fps: number;
  loop: boolean;
  onionSkin: OnionSkinSettings;
}

export type CanvasMode = "freeform" | "structured" | "animation";

export type ToolType =
  | "select"
  | "pan"
  | "text"
  | "brush"
  | "eraser"
  | "fill"
  | "box"
  | "splitBox"
  | "line"
  | "bg"
  | "stepline"
  | "circle";

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StructuredNodeStyle {
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
}

export interface StructuredTextRangeStyle {
  color?: string;
  bgColor?: string;
  attrs?: TextAttributes;
}

export interface StructuredTextStyleRange {
  start: number;
  end: number;
  style: StructuredTextRangeStyle;
}

export interface TextAttributes {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  inverse?: true;
}

interface StructuredNodeBase {
  id: string;
  order: number;
  style: StructuredNodeStyle;
}

export interface StructuredBoxNode extends StructuredNodeBase {
  type: "box";
  start: Point;
  end: Point;
  name?: string;
}

export interface StructuredSplitBoxNode extends StructuredNodeBase {
  type: "splitBox";
  start: Point;
  end: Point;
  verticalSplitRatio: number;
  topSplitRatio: number;
  bottomSplitRatio: number;
}

export interface StructuredLineNode extends StructuredNodeBase {
  type: "line";
  start: Point;
  end: Point;
  axis: "vertical" | "horizontal";
}

export interface StructuredBgNode extends StructuredNodeBase {
  type: "bg";
  start: Point;
  end: Point;
}

export interface StructuredTextNode extends StructuredNodeBase {
  type: "text";
  position: Point;
  text: string;
  styleRanges?: StructuredTextStyleRange[];
}

export type StructuredNode =
  | StructuredBoxNode
  | StructuredSplitBoxNode
  | StructuredLineNode
  | StructuredBgNode
  | StructuredTextNode;
