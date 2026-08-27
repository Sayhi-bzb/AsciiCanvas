import { useCallback, useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useSize } from 'ahooks';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { useCanvasEditorModels } from './hooks/useCanvasEditorModels';
import { CanvasContextMenuContent } from './CanvasContextMenuContent';
import { CanvasSurface } from './CanvasSurface';
import { CanvasColorSourceChooser } from './CanvasColorSourceChooser';
import { StructuredTemplatePreviewOverlay } from './StructuredTemplatePreviewOverlay';
import { useStructuredTemplateDrop } from './hooks/useStructuredTemplateDrop';
import { useManagedCanvasInput } from './hooks/useManagedCanvasInput';
import { useCanvasSpacePan } from './hooks/useCanvasSpacePan';
import { ContextMenu, ContextMenuTrigger } from '@chardesk/ui';
import { CANVAS_CONTEXT_MENU, STRUCTURED_CONTEXT_MENU } from '@/domains/actions/public';
import { GridManager } from '@/shared/utils/grid';
import { CELL_HEIGHT, CELL_WIDTH } from '@/shared/lib/constants';
import {
  createStructuredSceneQuery,
  isStructuredSplitBoxLineHandle,
} from '@/domains/structured-content/public';
import type { CanvasLinkHit } from './hooks/interaction/core/linkHitTesting';
import type { StructuredMovePreview } from './hooks/useCanvasRenderer';
import { isStaticGridMode } from '@/domains/sessions/public';
import {
  applyCanvasViewportPresentation,
  resetCanvasViewportPresentation,
  type CanvasViewport,
} from './hooks/viewportPresentation';
import { useCanvasEngineRuntime } from './engine/useCanvasEngineRuntime';
import { useCanvasViewOptional, useCanvasWorkspaceOptional } from './engine/CanvasWorkspace';
import { CANVAS_FRAME_INVALIDATION } from './engine/FrameScheduler';
import { resolveCanvasSurfaceGeometry } from './canvasSurfaceGeometry';
import type { EditorViewportFrame } from '@/widgets/editor-chrome/public';
import { computeVisibleSurfaceBounds } from './minimap/geometry';
import {
  DEFAULT_CANVAS_EDITOR_CAPABILITIES,
  type CanvasEditorCapabilities,
} from './canvasEditorCapabilities';

interface CanvasEditorProps {
  onUndo: () => void;
  onRedo: () => void;
  onContainerSizeChange?: (size: { width: number; height: number } | undefined) => void;
  capabilities?: CanvasEditorCapabilities;
  viewportFrame?: EditorViewportFrame;
  fitContentRevision?: number;
  active?: boolean;
  onActivate?: () => void;
}

export const CanvasEditor = ({
  onUndo,
  onRedo,
  onContainerSizeChange,
  capabilities = DEFAULT_CANVAS_EDITOR_CAPABILITIES,
  viewportFrame,
  fitContentRevision = 0,
  active = true,
  onActivate,
}: CanvasEditorProps) => {
  const canvasView = useCanvasViewOptional();
  const canvasWorkspace = useCanvasWorkspaceOptional();
  const subscribeViewport = canvasView?.subscribeViewport;
  const getViewport = canvasView?.getViewport;
  const runtime = useCanvasEngineRuntime();
  const effectiveCapabilities = capabilities;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasLayers = useMemo(
    () => ({ surface: canvasRef }),
    [],
  );
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
  const activeCanvasId = rendererStore.activeCanvasId;
  const lastFitContentRevisionRef = useRef(0);

  useEffect(() => {
    if (
      fitContentRevision <= 0 ||
      fitContentRevision === lastFitContentRevisionRef.current ||
      !size
    ) return;
    const bounds = computeVisibleSurfaceBounds(rendererStore.contentReader);
    if (!bounds) return;
    lastFitContentRevisionRef.current = fitContentRevision;
    runtime.camera.fitBounds(bounds, size, {
      padding: 48,
      insets: viewportFrame?.insets,
    });
  }, [
    fitContentRevision,
    rendererStore.contentReader,
    runtime,
    size,
    viewportFrame?.insets,
  ]);

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
      { padding: 48, insets: viewportFrame?.insets }
    );
  }, [
    activeCanvasId,
    canvasMode,
    editorStore.activeCanvasHasSavedViewport,
    rendererStore.slideDeck,
    runtime,
    size,
    viewportFrame?.insets,
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
      presentViewport(runtime.camera.getViewport());
    },
    [presentViewport, runtime]
  );

  useEffect(() => {
    const viewportLayer = viewportLayerRef.current;
    const schedulePresentation = (presented: CanvasViewport) => {
      runtime.frameScheduler.request(
        'viewport-presentation',
        CANVAS_FRAME_INVALIDATION.presentation,
        () => presentViewport(presented)
      );
    };
    schedulePresentation(runtime.camera.getViewport());
    const unsubscribe = subscribeViewport?.(() => {
      if (getViewport) schedulePresentation(getViewport());
    });
    return () => {
      unsubscribe?.();
      runtime.frameScheduler.cancel('viewport-presentation');
      renderedViewportRef.current = null;
      resetCanvasViewportPresentation(viewportLayer);
    };
  }, [getViewport, presentViewport, runtime, subscribeViewport]);

  const structuredTemplateDrop = useStructuredTemplateDrop({
    canvasMode,
    containerRef,
    model: editorStore,
    enabled: effectiveCapabilities.mutateContent,
  });
  const {
    textareaRef,
    canvasOwnsInputFocus,
    onCanvasPointerDown,
    textareaStyle,
    textareaProps,
  } = useManagedCanvasInput({
    canvasMode,
    model: editorStore,
    size,
    onUndo,
    onRedo,
    enabled: effectiveCapabilities.copy || effectiveCapabilities.mutateContent,
    mutateEnabled: active && effectiveCapabilities.mutateContent,
    active,
  });
  const isCanvasTextEditing = isStaticGridMode(canvasMode)
    ? editorStore.staticGridEditMode === 'text-edit'
    : !!rendererStore.textCursor ||
      !!rendererStore.editingStructuredTextNodeId ||
      !!rendererStore.structuredTextSelection;
  const isTemporaryPanActive = useCanvasSpacePan({
    enabled:
      active &&
      effectiveCapabilities.navigate &&
      canvasOwnsInputFocus &&
      !isCanvasTextEditing,
  });
  const interactionModel = isTemporaryPanActive
    ? { ...interactionStore, tool: 'pan' as const }
    : interactionStore;
  const rendererModel = isTemporaryPanActive
    ? { ...rendererStore, tool: 'pan' as const }
    : rendererStore;

  const {
    activateInteractionOwner = () => false,
    cursor,
    draggingSelection,
    handleDoubleClick,
    colorSourceChoice,
    selectColorSource,
    cancelColorSourceChoice,
  } = useCanvasInteraction(
    interactionModel,
    containerRef,
    setHoveredLink,
    structuredMovePreviewRef,
    requestCanvasRenderRef,
    runtime,
    effectiveCapabilities,
    canvasView?.viewId ?? 'single'
  );

  const activateCanvas = useCallback(() => {
    activateInteractionOwner();
    onActivate?.();
  }, [activateInteractionOwner, onActivate]);

  useLayoutEffect(() => {
    if (active) activateInteractionOwner();
  }, [active, activateInteractionOwner]);

  useCanvasRenderer(
    canvasLayers,
    size,
    surfaceGeometry,
    rendererModel,
    draggingSelection,
    structuredMovePreviewRef,
    hoveredLink,
    requestCanvasRenderRef,
    handleViewportRendered,
    runtime,
    canvasWorkspace?.runtime.rasterTileCache
  );

  const activeContextMenu =
    canvasMode === 'structured' ? STRUCTURED_CONTEXT_MENU : CANVAS_CONTEXT_MENU;
  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!effectiveCapabilities.mutateContent) {
      event.preventDefault();
      return;
    }
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
          canvasRef={canvasRef}
          viewportLayerRef={viewportLayerRef}
          surfaceGeometry={surfaceGeometry}
          containerSize={size}
          viewportFrame={viewportFrame}
          onContextMenu={handleContextMenu}
          onFocusCapture={activateCanvas}
          onPointerDownCapture={activateCanvas}
          onWheelCapture={activateCanvas}
          data-canvas-view-active={active ? 'true' : 'false'}
          style={{ cursor: cursor || undefined }}
          interactionUi={active}
          {...structuredTemplateDrop.surfaceProps}
          onDoubleClick={handleDoubleClick}
          onPointerDown={onCanvasPointerDown}
          textareaRef={textareaRef}
          textareaStyle={textareaStyle}
          textareaProps={textareaProps}
        >
          <StructuredTemplatePreviewOverlay preview={structuredTemplateDrop.preview} zoom={zoom} />
          {colorSourceChoice && (
            <CanvasColorSourceChooser
              choice={colorSourceChoice}
              offset={offset}
              zoom={zoom}
              onSelect={selectColorSource}
              onCancel={cancelColorSourceChoice}
            />
          )}
        </CanvasSurface>
      </ContextMenuTrigger>

      {effectiveCapabilities.mutateContent && (
        <CanvasContextMenuContent entries={activeContextMenu} managedTextareaRef={textareaRef} />
      )}
    </ContextMenu>
  );
};
