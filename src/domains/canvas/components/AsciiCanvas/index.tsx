import { useRef, useEffect, useState } from 'react';
import { useSize } from 'ahooks';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { useAsciiCanvasModels } from './hooks/useAsciiCanvasModels';
import { CanvasContextMenuContent } from './CanvasContextMenuContent';
import { CanvasSurface } from './CanvasSurface';
import { StructuredTemplatePreviewOverlay } from './StructuredTemplatePreviewOverlay';
import { useStructuredTemplateDrop } from './hooks/useStructuredTemplateDrop';
import { useManagedCanvasInput } from './hooks/useManagedCanvasInput';
import { getCenteredAnimationOffset } from '@/domains/canvas/state/helpers/animationHelpers';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import {
  CANVAS_CONTEXT_MENU,
  STRUCTURED_CONTEXT_MENU,
} from '@/domains/actions/core';
import { GridManager } from '@/shared/utils/grid';
import {
  findStructuredNodeHit,
  isStructuredSplitBoxLineHandle,
} from '@/domains/canvas/state/helpers/structuredBoxEditing';
import type { CanvasLinkHit } from './hooks/interaction/core/linkHitTesting';
import type { StructuredMovePreview } from './hooks/useCanvasRenderer';

interface AsciiCanvasProps {
  onUndo: () => void;
  onRedo: () => void;
}

export const AsciiCanvas = ({ onUndo, onRedo }: AsciiCanvasProps) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredLink, setHoveredLink] = useState<CanvasLinkHit | null>(null);
  const structuredMovePreviewRef = useRef<StructuredMovePreview | null>(null);
  const requestCanvasRenderRef = useRef<(() => void) | null>(null);
  const size = useSize(containerRef);
  const {
    interaction: interactionStore,
    renderer: rendererStore,
    editor: editorStore,
  } = useAsciiCanvasModels();
  const {
    canvasMode,
    canvasBounds: interactionCanvasBounds,
    setOffset: setCanvasOffset,
  } = interactionStore;
  const {
    offset,
    zoom,
    setStructuredGridFocus,
    selectedStructuredNodeIds,
    setSelectedStructuredNodeIds,
    setSelectedStructuredSplitHandle,
    structuredScene,
    setStructuredContextPoint,
    activeCanvasHasSavedViewport,
  } = editorStore;

  const structuredTemplateDrop = useStructuredTemplateDrop({
    canvasMode,
    containerRef,
    model: editorStore,
  });
  const {
    textareaRef,
    onCanvasPointerUp,
    textareaStyle,
    textareaProps,
  } = useManagedCanvasInput({
    canvasMode,
    model: editorStore,
    size,
    onUndo,
    onRedo,
  });

  useEffect(() => {
    if (
      canvasMode !== 'animation' ||
      !interactionCanvasBounds ||
      !size ||
      activeCanvasHasSavedViewport
    ) {
      return;
    }

    const centeredOffset = getCenteredAnimationOffset(
      interactionCanvasBounds,
      size,
      zoom
    );

    setCanvasOffset((prev) => {
      if (prev.x === centeredOffset.x && prev.y === centeredOffset.y) {
        return prev;
      }
      return centeredOffset;
    });
  }, [
    activeCanvasHasSavedViewport,
    canvasMode,
    interactionCanvasBounds,
    setCanvasOffset,
    size,
    zoom,
  ]);

  const { draggingSelection, handleDoubleClick } = useCanvasInteraction(
    interactionStore,
    containerRef,
    setHoveredLink,
    structuredMovePreviewRef,
    requestCanvasRenderRef
  );

  useCanvasRenderer(
    { bg: bgCanvasRef, scratch: scratchCanvasRef, ui: uiCanvasRef },
    size,
    rendererStore,
    draggingSelection,
    structuredMovePreviewRef,
    hoveredLink,
    requestCanvasRenderRef
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

    const hit = findStructuredNodeHit(structuredScene, point);
    if (!hit) {
      setSelectedStructuredSplitHandle(null);
      setStructuredGridFocus(point);
      return;
    }

    if (
      hit.kind === 'splitBox' &&
      hit.handle &&
      isStructuredSplitBoxLineHandle(hit.handle)
    ) {
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
          scratchCanvasRef={scratchCanvasRef}
          uiCanvasRef={uiCanvasRef}
          canvasMode={canvasMode}
          containerSize={size}
          onContextMenu={handleContextMenu}
          {...structuredTemplateDrop.surfaceProps}
          onDoubleClick={handleDoubleClick}
          onPointerUp={onCanvasPointerUp}
          textareaRef={textareaRef}
          textareaStyle={textareaStyle}
          textareaProps={textareaProps}
        >
          <StructuredTemplatePreviewOverlay
            preview={structuredTemplateDrop.preview}
            zoom={zoom}
          />
        </CanvasSurface>
      </ContextMenuTrigger>

      <CanvasContextMenuContent
        entries={activeContextMenu}
        managedTextareaRef={textareaRef}
      />
    </ContextMenu>
  );
};


