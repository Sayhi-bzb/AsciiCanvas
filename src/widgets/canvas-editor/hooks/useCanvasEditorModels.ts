import {
  createGridSurfaceReader,
  createSurfaceGridProjection,
  useCanvasRuntime,
  useCanvasState,
  type CanvasState,
} from "@/domains/canvas/public";
import { useShallow } from "zustand/react/shallow";
import { useCanvasViewOptional } from '../engine/CanvasWorkspace';
import { createStaticGridState } from '@/domains/selection/public';
import type { CanvasSession } from '@/domains/sessions/public';
import { useMemo } from 'react';
import { createStructuredSceneSurface } from '@/domains/structured-content/public';

type SessionContent = Pick<
  CanvasState,
  | 'activeCanvasId'
  | 'canvasMode'
  | 'slideDeck'
  | 'grid'
  | 'structuredScene'
  | 'structuredComponents'
>;

const resolveSessionContent = (
  session: CanvasSession,
  documents: ReturnType<typeof useCanvasRuntime>["documents"]
): SessionContent => {
  if (session.mode === 'slide') {
    const activeSlide = session.slideDeck.slides.find(
      (slide) => slide.id === session.slideDeck.activeSlideId
    );
    return {
      activeCanvasId: session.id,
      canvasMode: session.mode,
      slideDeck: session.slideDeck,
    grid: activeSlide
      ? (() => {
          const reader = documents.getContentReader(session.id, activeSlide.id);
          return reader
            ? createSurfaceGridProjection(reader)
            : new Map(activeSlide.grid);
        })()
      : new Map(),
      structuredScene: [],
      structuredComponents: [],
    };
  }
  const seed = documents.getDocumentSeed(session.id, session.mode);
  const structuredScene = seed?.scene ?? session.scene;
  return {
    activeCanvasId: session.id,
    canvasMode: session.mode,
    slideDeck: null,
    grid: session.mode === 'structured'
      ? createSurfaceGridProjection(createStructuredSceneSurface(structuredScene))
      : (() => {
          const reader = documents.getContentReader(session.id);
          return reader
            ? createSurfaceGridProjection(reader)
            : new Map(seed?.grid ?? session.grid);
        })(),
    structuredScene,
    structuredComponents: seed?.components ?? session.components ?? [],
  };
};

export const useCanvasEditorModels = () => {
  const {
    commands: canvasCommands,
    documents,
    queries: canvasQueries,
  } = useCanvasRuntime();
  const canvasView = useCanvasViewOptional();
  const canvasSessions = useCanvasState((state) => state.canvasSessions);
  const interactionState = useCanvasState(
    useShallow((state) => ({
      activeCanvasId: state.activeCanvasId,
      tool: state.tool,
      canvasMode: state.canvasMode,
      slideDeck: state.slideDeck,
      brushChar: state.brushChar,
      brushColor: state.brushColor,
      brushBackgroundColor: state.brushBackgroundColor,
      canvasColorPickerTarget: state.canvasColorPickerTarget,
      offset: state.offset,
      zoom: state.zoom,
      grid: state.grid,
      staticGridSelection: state.staticGridSelection,
      structuredScene: state.structuredScene,
      editingStructuredTextNodeId: state.editingStructuredTextNodeId,
      selectedStructuredNodeIds: state.selectedStructuredNodeIds,
      structuredTextSelection: state.structuredTextSelection,
    }))
  );
  const boundSession = canvasView?.sessionId
    ? canvasSessions.find((session) => session.id === canvasView.sessionId)
    : undefined;
  const usesSessionSnapshot = !!boundSession && boundSession.id !== interactionState.activeCanvasId;
  const sessionContent = useMemo(
    () =>
      usesSessionSnapshot
        ? resolveSessionContent(boundSession, documents)
        : null,
    [boundSession, documents, usesSessionSnapshot]
  );
  const inactiveStaticGrid = useMemo(() => createStaticGridState(), []);
  const resolvedInteractionState = sessionContent
    ? {
        ...interactionState,
        ...sessionContent,
        textCursor: null,
        staticGridSelection: inactiveStaticGrid.selection,
        editingStructuredTextNodeId: null,
        selectedStructuredNodeIds: [],
        structuredTextSelection: null,
        structuredGridFocus: null,
        canvasColorPickerTarget: null,
      }
    : interactionState;
  const interactionStore = {
    ...resolvedInteractionState,
    ...(canvasView ? canvasView.viewport : null),
    setBrushColor: canvasCommands.preferences.setBrushColor,
    setBrushBackgroundColor: canvasCommands.preferences.setBrushBackgroundColor,
    setCanvasColorPickerTarget: canvasCommands.interaction.setColorPickerTarget,
    setOffset: canvasView?.setOffset ?? canvasCommands.viewport.setOffset,
    setZoom: canvasView?.setZoom ?? canvasCommands.viewport.setZoom,
    setViewport: canvasView?.setViewport ?? canvasCommands.viewport.setViewport,
    addScratchPoints: canvasCommands.grid.addScratchPoints,
    commitScratch: canvasCommands.grid.commitScratch,
    commitStructuredShape: canvasCommands.structured.commitShape,
    setTextCursor: canvasCommands.interaction.setTextCursor,
    setStaticGridActiveCell: canvasCommands.staticGrid.setActiveCell,
    enterStaticGridTextEdit: canvasCommands.staticGrid.enterTextEdit,
    setStaticGridSelectionRange: canvasCommands.staticGrid.setSelectionRange,
    appendStaticGridSelectionRange: canvasCommands.staticGrid.appendSelectionRange,
    clearSelections: canvasCommands.selection.clear,
    clearInteractionState: canvasCommands.selection.clearInteraction,
    erasePoints: canvasCommands.grid.erasePoints,
    updateScratchForShape: canvasCommands.grid.updateScratchForShape,
    setHoveredGrid:
      !canvasView || canvasView.isActive
        ? canvasCommands.interaction.setHoveredGrid
        : () => undefined,
    fillArea: canvasCommands.grid.fillArea,
    setStructuredGridFocus: canvasCommands.interaction.setStructuredGridFocus,
    setStructuredContextPoint: canvasCommands.interaction.setStructuredContextPoint,
    setSelectedStructuredNodeIds: canvasCommands.interaction.setSelectedStructuredNodeIds,
    setSelectedStructuredSplitHandle: canvasCommands.interaction.setSelectedStructuredSplitHandle,
    setEditingStructuredTextNodeId: canvasCommands.interaction.setEditingStructuredTextNodeId,
    setStructuredTextSelection: canvasCommands.interaction.setStructuredTextSelection,
    setStructuredTextColor: canvasCommands.structured.setTextColor,
    applyStructuredScene: canvasCommands.structured.applyScene,
    updateStructuredNode: canvasCommands.structured.updateNode,
  };
  const rendererStore = useCanvasState(
    useShallow((state) => ({
      activeCanvasId: state.activeCanvasId,
      offset: state.offset,
      zoom: state.zoom,
      grid: state.grid,
      scratchLayer: state.scratchLayer,
      textCursor: state.textCursor,
      staticGridSelection: state.staticGridSelection,
      staticGridEditMode: state.staticGridEditMode,
      showGrid: state.showGrid,
      hoveredGrid: state.hoveredGrid,
      tool: state.tool,
      canvasMode: state.canvasMode,
      slideDeck: state.slideDeck,
      structuredScene: state.structuredScene,
      selectedStructuredNodeIds: state.selectedStructuredNodeIds,
      selectedStructuredBoxId: state.selectedStructuredBoxId,
      structuredContextPoint: state.structuredContextPoint,
      structuredGridFocus: state.structuredGridFocus,
      editingStructuredTextNodeId: state.editingStructuredTextNodeId,
      structuredTextSelection: state.structuredTextSelection,
      canvasColorPickerTarget: state.canvasColorPickerTarget,
    }))
  );
  const viewRendererStore = canvasView
    ? {
        ...rendererStore,
        ...(sessionContent ?? null),
        ...canvasView.viewport,
        scratchLayer: canvasView.isActive ? rendererStore.scratchLayer : null,
        staticGridSelection: canvasView.isActive
          ? rendererStore.staticGridSelection
          : inactiveStaticGrid.selection,
        staticGridEditMode: canvasView.isActive
          ? rendererStore.staticGridEditMode
          : inactiveStaticGrid.editMode,
        selectedStructuredNodeIds: canvasView.isActive
          ? rendererStore.selectedStructuredNodeIds
          : [],
        selectedStructuredBoxId: canvasView.isActive
          ? rendererStore.selectedStructuredBoxId
          : null,
        structuredContextPoint: canvasView.isActive
          ? rendererStore.structuredContextPoint
          : null,
        hoveredGrid: canvasView.isActive ? rendererStore.hoveredGrid : null,
        textCursor: canvasView.isActive ? rendererStore.textCursor : null,
        structuredGridFocus: canvasView.isActive ? rendererStore.structuredGridFocus : null,
        editingStructuredTextNodeId: canvasView.isActive
          ? rendererStore.editingStructuredTextNodeId
          : null,
        structuredTextSelection: canvasView.isActive
          ? rendererStore.structuredTextSelection
          : null,
        canvasColorPickerTarget: canvasView.isActive
          ? rendererStore.canvasColorPickerTarget
          : null,
      }
    : rendererStore;
  const contentDocumentId = viewRendererStore.activeCanvasId;
  const contentPageId =
    viewRendererStore.canvasMode === 'slide'
      ? viewRendererStore.slideDeck?.activeSlideId
      : undefined;
  const contentReader = useMemo(
    () =>
      viewRendererStore.canvasMode === 'structured'
        ? createGridSurfaceReader(viewRendererStore.grid)
        : documents.getContentReader(contentDocumentId, contentPageId) ??
          createGridSurfaceReader(viewRendererStore.grid),
    [
      contentDocumentId,
      contentPageId,
      documents,
      viewRendererStore.canvasMode,
      viewRendererStore.grid,
    ]
  );
  const editorState = useCanvasState(
    useShallow((state) => ({
      grid: state.grid,
      textCursor: state.textCursor,
      staticGridSelection: state.staticGridSelection,
      staticGridEditMode: state.staticGridEditMode,
      offset: state.offset,
      zoom: state.zoom,
      structuredGridFocus: state.structuredGridFocus,
      selectedStructuredNodeIds: state.selectedStructuredNodeIds,
      structuredScene: state.structuredScene,
      structuredComponents: state.structuredComponents,
      brushColor: state.brushColor,
      canvasColorPickerTarget: state.canvasColorPickerTarget,
      pendingCameraPlacement: state.pendingCameraPlacement,
    }))
  );
  const editorStore = {
    ...editorState,
    ...(sessionContent ?? null),
    ...(canvasView ? canvasView.viewport : null),
    ...(canvasView && !canvasView.isActive
      ? {
          textCursor: null,
          staticGridSelection: inactiveStaticGrid.selection,
          staticGridEditMode: inactiveStaticGrid.editMode,
          structuredGridFocus: null,
          selectedStructuredNodeIds: [],
          canvasColorPickerTarget: null,
        }
      : null),
    writeTextString: canvasCommands.text.write,
    backspaceText: canvasCommands.text.backspace,
    deleteTextForward: canvasCommands.text.deleteForward,
    newlineText: canvasCommands.text.newline,
    indentText: canvasCommands.text.indent,
    moveTextCursor: canvasCommands.text.moveCursor,
    moveStaticGridFocus: canvasCommands.staticGrid.moveFocus,
    moveStaticGridFocusToEdge: canvasCommands.staticGrid.moveFocusToEdge,
    moveStaticGridFocusToContentBoundary:
      canvasCommands.staticGrid.moveFocusToContentBoundary,
    selectStaticGridAll: canvasCommands.staticGrid.selectAll,
    selectStaticGridRow: canvasCommands.staticGrid.selectRow,
    selectStaticGridColumn: canvasCommands.staticGrid.selectColumn,
    enterStaticGridTextEdit: canvasCommands.staticGrid.enterTextEdit,
    exitStaticGridTextEdit: canvasCommands.staticGrid.exitTextEdit,
    moveStructuredGridFocus: canvasCommands.interaction.moveStructuredGridFocus,
    setTextCursor: canvasCommands.interaction.setTextCursor,
    setOffset: canvasView?.setOffset ?? canvasCommands.viewport.setOffset,
    consumePendingCameraPlacement: canvasCommands.viewport.consumePendingPlacement,
    fillSelectionsWithChar: canvasCommands.selection.fillWithChar,
    clearSelections: canvasCommands.selection.clear,
    setStructuredGridFocus: canvasCommands.interaction.setStructuredGridFocus,
    setSelectedStructuredNodeIds: canvasCommands.interaction.setSelectedStructuredNodeIds,
    setSelectedStructuredSplitHandle: canvasCommands.interaction.setSelectedStructuredSplitHandle,
    setEditingStructuredTextNodeId: canvasCommands.interaction.setEditingStructuredTextNodeId,
    setStructuredTextSelection: canvasCommands.interaction.setStructuredTextSelection,
    setCanvasColorPickerTarget: canvasCommands.interaction.setColorPickerTarget,
    setHoveredGrid:
      !canvasView || canvasView.isActive
        ? canvasCommands.interaction.setHoveredGrid
        : () => undefined,
    getNextStructuredOrder: canvasQueries.getNextStructuredOrder,
    applyStructuredScene: canvasCommands.structured.applyScene,
    setStructuredContextPoint: canvasCommands.interaction.setStructuredContextPoint,
  };

  return {
    interaction: interactionStore,
    renderer: { ...viewRendererStore, contentReader },
    editor: editorStore,
  };
};
