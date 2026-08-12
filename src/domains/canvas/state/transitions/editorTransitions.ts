import type { GridCell } from "@/shared/types";
import type { CanvasSession } from "@/domains/sessions/public";
import type { SlideDeck } from "@/domains/slides/public";
import { createStaticGridState } from "@/domains/selection/public";
import type { EditorState } from "../interfaces";
import { createMapFromEntries } from "../helpers/snapshotHelpers";
import type { resolveSessionRuntime } from "../helpers/storeUtils";

type SessionRuntime = ReturnType<typeof resolveSessionRuntime>;

type DocumentInteractionResetPatch = Pick<
  EditorState,
  | "selections"
  | "textCursor"
  | "editingStructuredTextNodeId"
  | "structuredTextSelection"
  | "selectedStructuredNodeIds"
  | "selectedStructuredBoxId"
  | "selectedStructuredSplitHandle"
  | "structuredContextPoint"
  | "structuredGridFocus"
  | "staticGridSelection"
  | "staticGridEditMode"
  | "hoveredGrid"
  | "scratchLayer"
  | "canvasColorPickerTarget"
>;

type SessionActivationPatch = Pick<
  EditorState,
  | "canvasSessions"
  | "activeCanvasId"
  | "canvasMode"
  | "slideDeck"
  | "structuredScene"
  | "structuredComponents"
  | "grid"
  | "tool"
  | "offset"
  | "zoom"
  | "activeCanvasHasSavedViewport"
> &
  DocumentInteractionResetPatch;

type SlideActivationPatch = Pick<
  EditorState,
  "slideDeck" | "canvasSessions" | "grid"
> &
  DocumentInteractionResetPatch;

export const createDocumentInteractionResetPatch =
  (): DocumentInteractionResetPatch => {
    const staticGrid = createStaticGridState();
    return {
      selections: [],
      textCursor: null,
      editingStructuredTextNodeId: null,
      structuredTextSelection: null,
      selectedStructuredNodeIds: [],
      selectedStructuredBoxId: null,
      selectedStructuredSplitHandle: null,
      structuredContextPoint: null,
      structuredGridFocus: null,
      staticGridSelection: staticGrid.selection,
      staticGridEditMode: staticGrid.editMode,
      hoveredGrid: null,
      scratchLayer: null,
      canvasColorPickerTarget: null,
    };
  };

export const createSessionActivationPatch = (
  canvasSessions: CanvasSession[],
  activeCanvasId: string,
  runtime: SessionRuntime
): SessionActivationPatch => ({
  canvasSessions,
  activeCanvasId,
  canvasMode: runtime.nextMode,
  slideDeck: runtime.nextSlideDeck,
  structuredScene: runtime.nextScene,
  structuredComponents: runtime.nextComponents,
  grid: createMapFromEntries(runtime.nextGridEntries),
  tool: runtime.nextTool,
  offset: runtime.nextOffset,
  zoom: runtime.nextZoom,
  activeCanvasHasSavedViewport: runtime.hasSavedViewport,
  ...createDocumentInteractionResetPatch(),
});

export const createSlideActivationPatch = (
  state: Pick<EditorState, "canvasSessions" | "activeCanvasId">,
  slideDeck: SlideDeck,
  activeGrid: [string, GridCell][]
): SlideActivationPatch => ({
  slideDeck,
  canvasSessions: state.canvasSessions.map((session) =>
    session.id === state.activeCanvasId && session.mode === "slide"
      ? { ...session, slideDeck }
      : session
  ),
  grid: createMapFromEntries(activeGrid),
  ...createDocumentInteractionResetPatch(),
});
