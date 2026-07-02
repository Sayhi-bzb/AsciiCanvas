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
  StructuredBoxNode,
  TextAttributes,
  ToolType,
} from "@/shared/types";
import type { StructuredTextSelection } from "@/shared/utils/structuredTextRanges";
import type { GridAddress, GridEditMode, GridRange, GridSelectionState } from "./helpers/staticGridModel";
import type { CanvasHistoryMode } from "@/shared/lib/yjs-setup";

export type CanvasColorPickerTarget = "char" | "bg";

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
    tool: "box" | "splitBox" | "line" | "bg",
    start: Point,
    end: Point,
    options?: { axis?: "vertical" | "horizontal" | null }
  ) => void;
  setSelectedStructuredNodeIds: (ids: string[]) => void;
  setSelectedStructuredBoxId: (id: string | null) => void;
  updateStructuredNode: (
    id: string,
    updater: (node: StructuredNode) => StructuredNode,
    history?: CanvasHistoryMode | boolean
  ) => void;
  updateStructuredBox: (id: string, updater: (node: StructuredBoxNode) => StructuredBoxNode) => void;
  setStructuredTextAttributes: (
    attrs: Partial<Record<"bold" | "italic" | "underline" | "strike", boolean>>
  ) => void;
  setStructuredTextColor: (color: string) => void;
  setStructuredTextBackgroundColor: (bgColor: string | null) => void;
  fillStructuredTextSelectionWithChar: (char: string) => void;
  reorderStructuredSelection: (direction: "forward" | "backward" | "front" | "back") => void;
  duplicateStructuredSelection: () => string[];
}

export interface StaticGridSlice {
  staticGridSelection: GridSelectionState;
  staticGridEditMode: GridEditMode;
  setStaticGridActiveCell: (address: GridAddress) => void;
  setStaticGridSelectionRange: (range: GridRange) => void;
  moveStaticGridFocus: (dx: number, dy: number, options?: { extend?: boolean }) => void;
  enterStaticGridTextEdit: (address?: GridAddress) => void;
  exitStaticGridTextEdit: () => void;
  clearStaticGridSelection: () => void;
}

export interface StructuredGridFocusSlice {
  structuredGridFocus: Point | null;
  setStructuredGridFocus: (point: Point | null) => void;
  moveStructuredGridFocus: (dx: number, dy: number) => void;
}

export interface TextSlice {
  textCursor: Point | null;
  editingStructuredTextNodeId: string | null;
  structuredTextSelection: StructuredTextSelection | null;
  setTextCursor: (pos: Point | null) => void;
  setEditingStructuredTextNodeId: (id: string | null) => void;
  setStructuredTextSelection: (selection: StructuredTextSelection | null) => void;
  writeTextString: (str: string, startPos?: Point) => void;
  pasteRichData: (cells: RichTextCell[], startPos?: Point) => void;
  moveTextCursor: (dx: number, dy: number) => void;
  backspaceText: () => void;
  deleteTextForward: () => void;
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

export interface CanvasViewport {
  offset: Point;
  zoom: number;
}

export interface CanvasSession {
  id: string;
  name: string;
  mode: CanvasMode;
  scene: StructuredNode[];
  grid: [string, GridCell][];
  size?: AnimationCanvasSize;
  timeline?: AnimationTimeline;
  viewport?: CanvasViewport;
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
  selectedStructuredNodeIds: string[];
  selectedStructuredBoxId: string | null;
  structuredGridFocus: Point | null;
  canvasBounds: AnimationCanvasSize | null;
  animationTimeline: AnimationTimeline | null;
  animationIsPlaying: boolean;
  showGrid: boolean;
  exportShowGrid: boolean;
  hoveredGrid: Point | null;
  canvasColorPickerTarget: CanvasColorPickerTarget | null;
  canvasSessions: CanvasSession[];
  activeCanvasId: string;
  activeCanvasHasSavedViewport: boolean;

  setOffset: (updater: (prev: Point) => Point) => void;
  setZoom: (updater: (prev: number) => number) => void;
  setTool: (tool: ToolType) => void;
  applyStructuredScene: (
    scene: StructuredNode[],
    history?: CanvasHistoryMode | boolean
  ) => void;
  getNextStructuredOrder: () => number;
  setBrushChar: (char: string) => void;
  setBrushColor: (color: string) => void;
  setCanvasColorPickerTarget: (target: CanvasColorPickerTarget | null) => void;
  setShowGrid: (show: boolean) => void;
  setExportShowGrid: (show: boolean) => void;
  setHoveredGrid: (pos: Point | null) => void;
} & DrawingSlice &
  StaticGridSlice &
  StructuredGridFocusSlice &
  TextSlice &
  SelectionSlice &
  SessionSlice &
  AnimationSlice;
