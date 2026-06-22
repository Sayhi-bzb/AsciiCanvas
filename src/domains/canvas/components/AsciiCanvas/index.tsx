import { useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { useSize, useEventListener } from 'ahooks';
import { useCanvasStore } from '@/domains/canvas/state/canvasStore';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { Minimap } from './Minimap';
import { SelectionFormatToolbar } from './SelectionFormatToolbar';
import { getCenteredAnimationOffset } from '@/domains/canvas/state/helpers/animationHelpers';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/shared/ui/context-menu';
import {
  ACTION_CATALOG,
  CANVAS_CONTEXT_MENU,
  canRunAction,
  runAction,
} from '@/domains/actions/core';
import { getActionShortcutLabel } from '@/domains/actions/core/shortcuts';
import { resolveFillHotkeyChar } from '@/domains/actions/input-arbiter';
import {
  resolveHistoryShortcutCommand,
} from '@/domains/actions/adapters/editorCommands';
import { gridCellRect } from '@/shared/metrics';
import { useShallow } from 'zustand/react/shallow';

interface AsciiCanvasProps {
  onUndo: () => void;
  onRedo: () => void;
}

export const AsciiCanvas = ({ onUndo, onRedo }: AsciiCanvasProps) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposing = useRef(false);

  const size = useSize(containerRef);
  const interactionStore = useCanvasStore(
    useShallow((state) => ({
      tool: state.tool,
      canvasMode: state.canvasMode,
      brushChar: state.brushChar,
      setOffset: state.setOffset,
      setZoom: state.setZoom,
      addScratchPoints: state.addScratchPoints,
      commitScratch: state.commitScratch,
      commitStructuredShape: state.commitStructuredShape,
      setTextCursor: state.setTextCursor,
      addSelection: state.addSelection,
      clearSelections: state.clearSelections,
      clearInteractionState: state.clearInteractionState,
      erasePoints: state.erasePoints,
      offset: state.offset,
      zoom: state.zoom,
      grid: state.grid,
      updateScratchForShape: state.updateScratchForShape,
      setHoveredGrid: state.setHoveredGrid,
      fillArea: state.fillArea,
      canvasBounds: state.canvasBounds,
    }))
  );
  const {
    canvasMode,
    canvasBounds: interactionCanvasBounds,
    setOffset: setCanvasOffset,
  } = interactionStore;
  const rendererStore = useCanvasStore(
    useShallow((state) => ({
      offset: state.offset,
      zoom: state.zoom,
      grid: state.grid,
      scratchLayer: state.scratchLayer,
      textCursor: state.textCursor,
      selections: state.selections,
      showGrid: state.showGrid,
      hoveredGrid: state.hoveredGrid,
      tool: state.tool,
      canvasMode: state.canvasMode,
      canvasBounds: state.canvasBounds,
      animationTimeline: state.animationTimeline,
    }))
  );
  const {
    textCursor,
    writeTextString,
    backspaceText,
    newlineText,
    indentText,
    moveTextCursor,
    setTextCursor,
    selections,
    offset,
    zoom,
    moveSelections,
    expandSelection,
    fillSelectionsWithChar,
    clearSelections,
  } = useCanvasStore(
    useShallow((state) => ({
      textCursor: state.textCursor,
      writeTextString: state.writeTextString,
      backspaceText: state.backspaceText,
      newlineText: state.newlineText,
      indentText: state.indentText,
      moveTextCursor: state.moveTextCursor,
      setTextCursor: state.setTextCursor,
      selections: state.selections,
      offset: state.offset,
      zoom: state.zoom,
      moveSelections: state.moveSelections,
      expandSelection: state.expandSelection,
      fillSelectionsWithChar: state.fillSelectionsWithChar,
      clearSelections: state.clearSelections,
    }))
  );

  useEffect(() => {
    if (
      canvasMode !== 'animation' ||
      !interactionCanvasBounds ||
      !size
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
    canvasMode,
    interactionCanvasBounds,
    setCanvasOffset,
    size,
    zoom,
  ]);

  const { draggingSelection } = useCanvasInteraction(
    interactionStore,
    containerRef
  );

  useCanvasRenderer(
    { bg: bgCanvasRef, scratch: scratchCanvasRef, ui: uiCanvasRef },
    size,
    rendererStore,
    draggingSelection
  );

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const shouldFocus = textCursor || selections.length > 0;
    if (shouldFocus) {
      if (document.activeElement !== textarea) {
        textarea.focus({ preventScroll: true });
      }
      return;
    }

    if (document.activeElement === textarea) {
      textarea.blur();
    }
  }, [textCursor, selections.length]);

  const runManagedAction = (
    actionId: 'copy' | 'cut' | 'paste',
    e?: ClipboardEvent
  ) => {
    return runAction(actionId, {
      source: e ? 'clipboard-event' : 'context-menu',
      clipboardEvent: e,
      managedTextarea: textareaRef.current,
    });
  };

  useEventListener('copy', (e: ClipboardEvent) => {
    const result = runManagedAction('copy', e);
    if (result.succeeded) e.preventDefault();
  });
  useEventListener('cut', (e: ClipboardEvent) => {
    const result = runManagedAction('cut', e);
    if (result.succeeded || document.activeElement === textareaRef.current) {
      e.preventDefault();
    }
  });
  useEventListener('paste', (e: ClipboardEvent) => {
    const result = runManagedAction('paste', e);
    if (result.succeeded || document.activeElement === textareaRef.current) {
      e.preventDefault();
    }
  });

  const textareaStyle: React.CSSProperties = useMemo(() => {
    if ((!textCursor && selections.length === 0) || !size) return { display: 'none' };
    const point = textCursor ?? selections[0].start;
    const pos = gridCellRect(point, { offset, zoom });

    return {
      position: 'absolute',
      left: `${pos.x}px`,
      top: `${pos.y}px`,
      width: `${Math.max(1, pos.width)}px`,
      height: `${Math.max(1, pos.height)}px`,
      opacity: 0,
      pointerEvents: 'none',
      zIndex: -1,
    };
  }, [textCursor, selections, offset, zoom, size]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (isComposing.current) return;
    const historyCommand = resolveHistoryShortcutCommand(e);
    if (historyCommand) {
      e.preventDefault();
      runAction(historyCommand, {
        source: 'canvas-keydown',
        managedTextarea: textareaRef.current,
        onUndo,
        onRedo,
      });
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selections.length > 0) {
      e.preventDefault();
      runAction('delete-selection', { source: 'canvas-keydown' });
      return;
    }

    if (e.key === 'Backspace') {
      if (textCursor) {
        e.preventDefault();
        backspaceText();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      newlineText();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      indentText();
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;

      if (textCursor) {
        moveTextCursor(dx, dy);
      } else if (selections.length > 0) {
        if (e.shiftKey) {
          expandSelection(dx, dy);
        } else {
          moveSelections(dx, dy);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (textCursor) {
        setTextCursor(null);
      } else if (selections.length > 0) {
        clearSelections();
      }
    } else if (selections.length > 0 && !textCursor) {
      const fillChar = resolveFillHotkeyChar(e);
      if (!fillChar) return;

      // Direct character fill when selection is active
      e.preventDefault();
      fillSelectionsWithChar(fillChar);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          style={{ touchAction: 'none' }}
          className="relative w-screen h-screen overflow-hidden bg-background touch-none select-none cursor-default"
        >
          <canvas
            ref={bgCanvasRef}
            className="absolute inset-0 w-full h-full block pointer-events-none"
          />
          <canvas
            ref={scratchCanvasRef}
            className="absolute inset-0 w-full h-full block pointer-events-none"
          />
          <canvas
            ref={uiCanvasRef}
            className="absolute inset-0 w-full h-full block pointer-events-none"
          />
          <SelectionFormatToolbar containerSize={size} />
          {canvasMode !== 'animation' && <Minimap containerSize={size} />}
          <textarea
            ref={textareaRef}
            style={textareaStyle}
            onCompositionStart={() => {
              isComposing.current = true;
            }}
            onCompositionEnd={(e) => {
              isComposing.current = false;
              if (e.data) writeTextString(e.data);
              if (textareaRef.current) textareaRef.current.value = '';
            }}
            onInput={(e) => {
              if (!isComposing.current && e.currentTarget.value) {
                writeTextString(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
            onKeyDown={handleKeyDown}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {CANVAS_CONTEXT_MENU.map((entry, index) => {
          if (entry.type === 'separator') {
            return <ContextMenuSeparator key={`sep-${index}`} />;
          }

          const meta = ACTION_CATALOG[entry.id];
          const Icon = meta.icon;
          const disabled = !canRunAction(entry.id, useCanvasStore.getState());
          const shortcutLabel = getActionShortcutLabel(entry.id);

          return (
            <ContextMenuItem
              key={entry.id}
              onClick={() =>
                runAction(entry.id, {
                  source: 'context-menu',
                  managedTextarea: textareaRef.current,
                })
              }
              variant={meta.destructive ? 'destructive' : 'default'}
              disabled={disabled}
            >
              {Icon && <Icon className="mr-2 size-4" />}
              <span>{meta.label}</span>
              {shortcutLabel && (
                <ContextMenuShortcut>{shortcutLabel}</ContextMenuShortcut>
              )}
            </ContextMenuItem>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
};
