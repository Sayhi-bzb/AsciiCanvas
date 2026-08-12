import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { useSize } from 'ahooks';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { useCanvasEditorModels } from './hooks/useCanvasEditorModels';
import { CanvasContextMenuContent } from './CanvasContextMenuContent';
import { CanvasSurface } from './CanvasSurface';
import { StructuredTemplatePreviewOverlay } from './StructuredTemplatePreviewOverlay';
import { useStructuredTemplateDrop } from './hooks/useStructuredTemplateDrop';
import { useManagedCanvasInput } from './hooks/useManagedCanvasInput';
import { ContextMenu, ContextMenuTrigger } from '@/shared/ui/context-menu';
import { CANVAS_CONTEXT_MENU, STRUCTURED_CONTEXT_MENU } from '@/domains/actions/public';
import { GridManager } from '@/shared/utils/grid';
import { CELL_HEIGHT, CELL_WIDTH } from '@/shared/lib/constants';
import {
  createStructuredSceneQuery,
  isStructuredSplitBoxLineHandle,
} from '@/domains/structured-content/public';
import type { CanvasLinkHit } from './hooks/interaction/core/linkHitTesting';
import type { StructuredMovePreview } from './hooks/useCanvasRenderer';
import {
  getCanvasState,
  subscribeCanvasState,
  useCanvasState,
  type ToolType,
} from '@/domains/canvas/public';
import {
  applyCanvasViewportPresentation,
  resetCanvasViewportPresentation,
  type CanvasViewport,
} from './hooks/viewportPresentation';
import { useCanvasEngineRuntime } from './engine/useCanvasEngineRuntime';
import { CANVAS_FRAME_INVALIDATION } from './engine/FrameScheduler';
import { resolveCanvasSurfaceGeometry } from './canvasSurfaceGeometry';

interface CanvasEditorProps {
  onUndo: () => void;
  onRedo: () => void;
  onContainerSizeChange?: (size: { width: number; height: number } | undefined) => void;
  interactionToolOverride?: ToolType;
  enabled?: boolean;
}

export const CanvasEditor = ({
  onUndo,
  onRedo,
  onContainerSizeChange,
  interactionToolOverride,
  enabled = true,
}: CanvasEditorProps) => {
  const runtime = useCanvasEngineRuntime();
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportLayerRef = useRef<HTMLDivElement>(null);
  const [hoveredLink, setHoveredLink] = useState<CanvasLinkHit | null>(null);
  const structuredMovePreviewRef = useRef<StructuredMovePreview | null>(null);
  const requestCanvasRenderRef = useRef<(() => void) | null>(null);
  const size = useSize(containerRef);
  const surfaceGeometry = useMemo(
    () => (size ? resolveCanvasSurfaceGeometry(size) : undefined),
    [size]
  );
  useEffect(() => {
    onContainerSizeChange?.(size);
  }, [onContainerSizeChange, size]);
  const {
    interaction: interactionStore,
    renderer: rendererStore,
    editor: editorStore,
  } = useCanvasEditorModels();
  const interactionModel = interactionToolOverride
    ? { ...interactionStore, tool: interactionToolOverride }
    : interactionStore;
  const rendererModel = interactionToolOverride
    ? { ...rendererStore, tool: interactionToolOverride }
    : rendererStore;
  const { canvasMode } = interactionStore;
  const {
    offset,
    zoom,
    setStructuredGridFocus,
    selectedStructuredNodeIds,
    setSelectedStructuredNodeIds,
    setSelectedStructuredSplitHandle,
    structuredScene,
    setStructuredContextPoint,
  } = editorStore;
  const structuredSceneQuery = useMemo(
    () => createStructuredSceneQuery(structuredScene),
    [structuredScene]
  );
  const renderedViewportRef = useRef<CanvasViewport | null>(null);
  const lastSlideViewRef = useRef<{
    sessionId: string;
    pageKey: string;
  } | null>(null);
  const activeCanvasId = useCanvasState((state) => state.activeCanvasId);

  useEffect(() => {
    const slideDeck = rendererStore.slideDeck;
    if (canvasMode !== "slide" || !slideDeck || !size || !activeCanvasId) return;
    const activeSlide = slideDeck.slides.find(
      (slide) => slide.id === slideDeck.activeSlideId
    );
    if (!activeSlide) return;
    const pageKey = `${activeSlide.id}:${activeSlide.size.columns}x${activeSlide.size.rows}`;
    const previous = lastSlideViewRef.current;
    const changedSession = previous?.sessionId !== activeCanvasId;
    if (!changedSession && previous?.pageKey === pageKey) return;
    lastSlideViewRef.current = { sessionId: activeCanvasId, pageKey };
    if (changedSession && editorStore.activeCanvasHasSavedViewport) return;
    runtime.camera.fitBounds(
      {
        x: 0,
        y: 0,
        width: activeSlide.size.columns * CELL_WIDTH,
        height: activeSlide.size.rows * CELL_HEIGHT,
      },
      size,
      { padding: 48 }
    );
  }, [
    activeCanvasId,
    canvasMode,
    editorStore.activeCanvasHasSavedViewport,
    rendererStore.slideDeck,
    runtime,
    size,
  ]);

  const presentViewport = useCallback((presented: CanvasViewport) => {
    applyCanvasViewportPresentation(
      viewportLayerRef.current,
      renderedViewportRef.current,
      presented,
      surfaceGeometry
        ? {
            width: surfaceGeometry.viewportWidth,
            height: surfaceGeometry.viewportHeight,
            overscan: surfaceGeometry.overscan,
          }
        : undefined
    );
  }, [surfaceGeometry]);

  const handleViewportRendered = useCallback(
    (rendered: CanvasViewport) => {
      renderedViewportRef.current = {
        offset: { ...rendered.offset },
        zoom: rendered.zoom,
      };
      const current = getCanvasState();
      presentViewport({
        offset: { ...current.offset },
        zoom: current.zoom,
      });
    },
    [presentViewport]
  );

  useEffect(() => {
    const current = getCanvasState();
    const viewportLayer = viewportLayerRef.current;
    const schedulePresentation = (presented: CanvasViewport) => {
      runtime.frameScheduler.request(
        'viewport-presentation',
        CANVAS_FRAME_INVALIDATION.presentation,
        () => presentViewport(presented)
      );
    };
    schedulePresentation({ offset: { ...current.offset }, zoom: current.zoom });
    const unsubscribe = subscribeCanvasState((state, previous) => {
      if (state.zoom === previous.zoom && state.offset === previous.offset) return;
      schedulePresentation({
        offset: { ...state.offset },
        zoom: state.zoom,
      });
    });
    return () => {
      unsubscribe();
      runtime.frameScheduler.cancel('viewport-presentation');
      renderedViewportRef.current = null;
      resetCanvasViewportPresentation(viewportLayer);
    };
  }, [presentViewport, runtime]);

  const structuredTemplateDrop = useStructuredTemplateDrop({
    canvasMode,
    containerRef,
    model: editorStore,
  });
  const { textareaRef, onCanvasPointerDown, textareaStyle, textareaProps } = useManagedCanvasInput({
    canvasMode,
    model: editorStore,
    size,
    onUndo,
    onRedo,
    enabled,
  });

  const { draggingSelection, handleDoubleClick } = useCanvasInteraction(
    interactionModel,
    containerRef,
    setHoveredLink,
    structuredMovePreviewRef,
    requestCanvasRenderRef,
    runtime
  );

  useCanvasRenderer(
    { bg: bgCanvasRef, scratch: scratchCanvasRef, ui: uiCanvasRef },
    size,
    surfaceGeometry,
    rendererModel,
    draggingSelection,
    structuredMovePreviewRef,
    hoveredLink,
    requestCanvasRenderRef,
    handleViewportRendered,
    runtime
  );

  const activeContextMenu =
    canvasMode === 'structured' ? STRUCTURED_CONTEXT_MENU : CANVAS_CONTEXT_MENU;
  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (canvasMode !== 'structured') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const point = GridManager.screenToGrid(
      event.clientX - rect.left,
      event.clientY - rect.top,
      offset.x,
      offset.y,
      zoom
    );
    setStructuredContextPoint(point);

    const hit = structuredSceneQuery.findHit(point);
    if (!hit) {
      setSelectedStructuredSplitHandle(null);
      setStructuredGridFocus(point);
      return;
    }

    if (hit.kind === 'splitBox' && hit.handle && isStructuredSplitBoxLineHandle(hit.handle)) {
      setSelectedStructuredNodeIds([hit.node.id]);
      setSelectedStructuredSplitHandle({ nodeId: hit.node.id, handle: hit.handle });
      return;
    }

    setSelectedStructuredSplitHandle(null);
    if (hit.kind === 'splitBox') {
      setSelectedStructuredNodeIds([hit.node.id]);
      return;
    }
    if (!selectedStructuredNodeIds.includes(hit.node.id)) {
      setSelectedStructuredNodeIds([hit.node.id]);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <CanvasSurface
          containerRef={containerRef}
          bgCanvasRef={bgCanvasRef}
          viewportLayerRef={viewportLayerRef}
          scratchCanvasRef={scratchCanvasRef}
          uiCanvasRef={uiCanvasRef}
          surfaceGeometry={surfaceGeometry}
          containerSize={size}
          onContextMenu={handleContextMenu}
          {...structuredTemplateDrop.surfaceProps}
          onDoubleClick={handleDoubleClick}
          onPointerDown={onCanvasPointerDown}
          textareaRef={textareaRef}
          textareaStyle={textareaStyle}
          textareaProps={textareaProps}
        >
          <StructuredTemplatePreviewOverlay preview={structuredTemplateDrop.preview} zoom={zoom} />
        </CanvasSurface>
      </ContextMenuTrigger>

      <CanvasContextMenuContent entries={activeContextMenu} managedTextareaRef={textareaRef} />
    </ContextMenu>
  );
};
