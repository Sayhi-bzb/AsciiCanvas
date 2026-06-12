export interface Point {
  x: number;
  y: number;
}

export interface GridCell {
  char: string;
  color: string;
}

export interface GridPoint extends Point {
  char: string;
  color?: string;
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

export interface AnsiAnimationDocument {
  script: string;
  width: number;
  height: number;
  fps: number;
  background: string;
}

export type CanvasMode =
  | "freeform"
  | "structured"
  | "animation"
  | "ansi-animation";

export type ToolType =
  | "select"
  | "pan"
  | "brush"
  | "eraser"
  | "fill"
  | "box"
  | "line"
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

export interface StructuredLineNode extends StructuredNodeBase {
  type: "line";
  start: Point;
  end: Point;
  axis: "vertical" | "horizontal";
}

export interface StructuredTextNode extends StructuredNodeBase {
  type: "text";
  position: Point;
  text: string;
}

export type StructuredNode =
  | StructuredBoxNode
  | StructuredLineNode
  | StructuredTextNode;
