import type {
  AnimationCanvasSize,
  AnimationFrame,
  AnimationTimeline,
  CanvasMode,
  GridCell,
  GridMap,
  GridPoint,
  OnionSkinSettings,
  Point,
  SelectionArea,
  StructuredNode,
  TextAttributes,
  ToolType,
} from "@/shared/types";

export interface RichTextCell {
  x: number;
  y: number;
  char: string;
  color: string;
  bgColor?: string;
  attrs?: TextAttributes;
  href?: string;
}

export interface DrawingSlice {
  scratchLayer: GridMap | null;
  setScratchLayer: (points: GridPoint[]) => void;
  addScratchPoints: (points: GridPoint[]) => void;
  commitScratch: () => void;
  clearScratch: () => void;
  clearCanvas: () => void;
  erasePoints: (points: Point[], shouldSaveHistory?: boolean) => void;
  updateScratchForShape: (
    tool: ToolType,
    start: Point,
    end: Point,
    options?: { axis?: "vertical" | "horizontal" | null }
  ) => void;
  commitStructuredShape: (
    tool: "box" | "line",
    start: Point,
    end: Point,
    options?: { axis?: "vertical" | "horizontal" | null }
  ) => void;
}

export interface TextSlice {
  textCursor: Point | null;
  setTextCursor: (pos: Point | null) => void;
  writeTextString: (str: string, startPos?: Point) => void;
  pasteRichData: (cells: RichTextCell[], startPos?: Point) => void;
  moveTextCursor: (dx: number, dy: number) => void;
  backspaceText: () => void;
  newlineText: () => void;
  indentText: () => void;
}

export interface SelectionSlice {
  selections: SelectionArea[];
  addSelection: (area: SelectionArea) => void;
  clearSelections: () => void;
  clearInteractionState: () => void;
  canCopyOrCut: () => boolean;
  deleteSelection: () => void;
  copySelection: (options?: { rich?: boolean; ansi?: boolean; event?: ClipboardEvent }) => Promise<void>;
  cutSelection: (options?: { event?: ClipboardEvent }) => Promise<void>;
  pasteFromClipboard: (options?: { eventDataTransfer?: DataTransfer }) => Promise<void>;
  copySelectionAsPng: (withGrid: boolean) => Promise<void>;
  fillSelectionsWithChar: (char: string) => void;
  setSelectionTextAttributes: (
    attrs: Partial<Record<"bold" | "italic" | "underline" | "strike", boolean>>
  ) => void;
  setSelectionBackgroundColor: (bgColor: string | null) => void;
  fillArea: (area: SelectionArea) => void;
  moveSelections: (dx: number, dy: number) => void;
  expandSelection: (dx: number, dy: number) => void;
}

export interface CanvasSession {
  id: string;
  name: string;
  mode: CanvasMode;
  scene: StructuredNode[];
  grid: [string, GridCell][];
  size?: AnimationCanvasSize;
  timeline?: AnimationTimeline;
}

export interface SessionSlice {
  createCanvasSession: (
    mode?: CanvasMode,
    options?: { size?: AnimationCanvasSize }
  ) => void;
  importCanvasSession: (
    raw: string | unknown,
    options?: { name?: string }
  ) => CanvasSession;
  switchCanvasSession: (canvasId: string) => void;
  removeCanvasSession: (canvasId: string) => void;
  renameCanvasSession: (canvasId: string, nextName: string) => void;
}

export interface AnimationSlice {
  setAnimationCurrentFrame: (frameId: string) => void;
  insertAnimationFrame: (position?: "before" | "after") => void;
  renameAnimationFrame: (frameId: string, nextName: string) => void;
  duplicateAnimationFrame: (frameId?: string) => void;
  duplicateAnimationFrames: (frameIds: string[]) => string[];
  removeAnimationFrame: (frameId?: string) => void;
  removeAnimationFrames: (frameIds: string[]) => string[];
  moveAnimationFrame: (frameId: string, direction: -1 | 1) => void;
  reorderAnimationFrames: (frameIds: string[]) => void;
  setAnimationFps: (fps: number) => void;
  toggleAnimationLoop: () => void;
  setOnionSkinSettings: (settings: Partial<OnionSkinSettings>) => void;
  setAnimationCanvasSize: (size: AnimationCanvasSize) => void;
  applyGeneratedAnimationFrames: (
    frames: AnimationFrame[],
    mode: "insert-after-current" | "replace-animation" | "append-to-end",
    options?: { fps?: number; size?: AnimationCanvasSize }
  ) => void;
  playAnimation: () => void;
  pauseAnimation: () => void;
  stepAnimationFrame: (direction?: -1 | 1) => void;
  tickAnimationPlayback: () => void;
}

export type CanvasState = {
  offset: Point;
  zoom: number;
  tool: ToolType;
  canvasMode: CanvasMode;
  brushChar: string;
  brushColor: string;
  grid: GridMap;
  structuredScene: StructuredNode[];
  canvasBounds: AnimationCanvasSize | null;
  animationTimeline: AnimationTimeline | null;
  animationIsPlaying: boolean;
  showGrid: boolean;
  exportShowGrid: boolean;
  hoveredGrid: Point | null;
  canvasSessions: CanvasSession[];
  activeCanvasId: string;

  setOffset: (updater: (prev: Point) => Point) => void;
  setZoom: (updater: (prev: number) => number) => void;
  setTool: (tool: ToolType) => void;
  applyStructuredScene: (scene: StructuredNode[], shouldSaveHistory?: boolean) => void;
  getNextStructuredOrder: () => number;
  setBrushChar: (char: string) => void;
  setBrushColor: (color: string) => void;
  setShowGrid: (show: boolean) => void;
  setExportShowGrid: (show: boolean) => void;
  setHoveredGrid: (pos: Point | null) => void;
} & DrawingSlice &
  TextSlice &
  SelectionSlice &
  SessionSlice &
  AnimationSlice;
