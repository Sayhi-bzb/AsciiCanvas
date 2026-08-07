import type { GridMap, GridPoint, Point, SelectionArea, TextAttributes } from "@/shared/types";
import type { CanvasMode } from "@/domains/sessions/public";
import type { ToolType } from "../model/tool";
import type { StructuredNode, StructuredBoxNode, StructuredComponentInstance, StructuredTextStyleRange } from "@/domains/structured-content/public";
import type { StructuredTextSelection } from "@/domains/structured-content/public";
import type { GridAddress, GridEditMode, GridRange, GridSelectionState } from "@/domains/selection/public";
import type { StructuredSplitBoxHandle } from "@/domains/structured-content/public";
import type { CanvasSession } from "@/domains/sessions/public";
import type { SessionCommands } from "@/domains/sessions/public";
import type { CanvasHistoryMode } from "./yjs";
import type { SlideDeck } from "@/domains/slides/public";

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

export type ClipboardCommandResult =
  | { status: "applied"; changed: boolean }
  | {
      status: "noop";
      reason: "empty-source" | "empty-clipboard" | "unsupported-data";
    }
  | {
      status: "failed";
      reason: "clipboard-failed" | "stale-target";
    };

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
    tool: "box" | "splitBox" | "line" | "arrowLine" | "bg",
    start: Point,
    end: Point,
    options?: { axis?: "vertical" | "horizontal" | null }
  ) => void;
  setSelectedStructuredNodeIds: (ids: string[]) => void;
  setSelectedStructuredBoxId: (id: string | null) => void;
  setSelectedStructuredSplitHandle: (
    handle: { nodeId: string; handle: StructuredSplitBoxHandle } | null
  ) => void;
  splitStructuredSplitBoxLeaf: (
    nodeId: string,
    point: Point,
    axis: "horizontal" | "vertical"
  ) => boolean;
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
  setStructuredNodeCharColor: (color: string) => void;
  fillStructuredTextSelectionWithChar: (char: string) => void;
  reorderStructuredSelection: (direction: "forward" | "backward" | "front" | "back") => void;
  duplicateStructuredSelection: () => string[];
}

export interface SlideSlice {
  slideDeck: SlideDeck | null;
  addSlide: () => void;
  duplicateSlide: (slideId: string) => void;
  removeSlide: (slideId: string) => void;
  renameSlide: (slideId: string, name: string) => void;
  moveSlide: (slideId: string, targetIndex: number) => void;
  activateSlide: (slideId: string) => void;
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

interface StructuredGridFocusSlice {
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
  replaceStructuredTextRange: (
    nodeId: string,
    start: number,
    end: number,
    text: string,
    styleRanges?: StructuredTextStyleRange[]
  ) => void;
  writeTextString: (
    str: string,
    startPos?: Point,
    options?: { preserveTargetBackground?: boolean }
  ) => void;
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
  copySelection: (options?: { rich?: boolean; ansi?: boolean; event?: ClipboardEvent }) => Promise<ClipboardCommandResult>;
  cutSelection: (options?: { event?: ClipboardEvent }) => Promise<ClipboardCommandResult>;
  pasteFromClipboard: (options?: { eventDataTransfer?: DataTransfer }) => Promise<ClipboardCommandResult>;
  copySelectionAsPng: (withGrid: boolean) => Promise<void>;
  fillSelectionsWithChar: (
    char: string,
    options?: { preserveTargetBackground?: boolean }
  ) => void;
  setSelectionTextAttributes: (
    attrs: Partial<Record<"bold" | "italic" | "underline" | "strike", boolean>>
  ) => void;
  setSelectionBackgroundColor: (bgColor: string | null) => void;
  fillArea: (area: SelectionArea) => void;
  moveSelections: (dx: number, dy: number) => void;
  expandSelection: (dx: number, dy: number) => void;
}

export type EditorState = {
  offset: Point;
  zoom: number;
  tool: ToolType;
  canvasMode: CanvasMode;
  brushChar: string;
  brushColor: string;
  grid: GridMap;
  structuredScene: StructuredNode[];
  structuredComponents: StructuredComponentInstance[];
  selectedStructuredNodeIds: string[];
  selectedStructuredBoxId: string | null;
  selectedStructuredSplitHandle: {
    nodeId: string;
    handle: StructuredSplitBoxHandle;
  } | null;
  structuredContextPoint: Point | null;
  structuredGridFocus: Point | null;
  showGrid: boolean;
  exportShowGrid: boolean;
  hoveredGrid: Point | null;
  canvasColorPickerTarget: CanvasColorPickerTarget | null;
  canvasSessions: CanvasSession[];
  activeCanvasId: string;
  activeCanvasHasSavedViewport: boolean;
  canUndo: boolean;
  canRedo: boolean;

  setOffset: (updater: (prev: Point) => Point) => void;
  setZoom: (updater: (prev: number) => number) => void;
  setTool: (tool: ToolType) => void;
  applyStructuredScene: (
    scene: StructuredNode[],
    history?: CanvasHistoryMode | boolean,
    components?: StructuredComponentInstance[]
  ) => void;
  getNextStructuredOrder: () => number;
  setBrushChar: (char: string) => void;
  setBrushColor: (color: string) => void;
  setCanvasColorPickerTarget: (target: CanvasColorPickerTarget | null) => void;
  setStructuredContextPoint: (point: Point | null) => void;
  setShowGrid: (show: boolean) => void;
  setExportShowGrid: (show: boolean) => void;
  setHoveredGrid: (pos: Point | null) => void;
} & DrawingSlice &
  SlideSlice &
  StaticGridSlice &
  StructuredGridFocusSlice &
  TextSlice &
  SelectionSlice &
  SessionCommands;
