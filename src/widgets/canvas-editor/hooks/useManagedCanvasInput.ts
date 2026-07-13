import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useEventListener } from "ahooks";
import type { CanvasMode } from "@/shared/types";
import { gridCellRect } from "@/shared/metrics";
import { shouldIgnoreClipboardShortcut } from "@/shared/utils/dom-focus";
import {
  getStaticGridViewState,
} from "@/domains/selection/public";
import { shouldIgnoreCanvasSurfaceGesture } from "./interaction/core/gestureGuards";
import { resolveFillHotkeyChar } from "@/domains/actions/public";
import { resolveHistoryShortcutCommand } from "@/domains/actions/public";
import { runAction } from "@/domains/actions/public";
import type { CanvasEditorModel } from "./canvasModels";

const KEYBOARD_PAN_STEP = 48;

type UseManagedCanvasInputOptions = {
  canvasMode: CanvasMode;
  model: CanvasEditorModel;
  size: { width: number; height: number } | undefined;
  onUndo: () => void;
  onRedo: () => void;
};

export const useManagedCanvasInput = ({
  canvasMode,
  model,
  size,
  onUndo,
  onRedo,
}: UseManagedCanvasInputOptions) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposing = useRef(false);
  const {
    textCursor,
    staticGridSelection,
    staticGridEditMode,
    writeTextString,
    backspaceText,
    deleteTextForward,
    newlineText,
    indentText,
    moveTextCursor,
    moveStaticGridFocus,
    moveStructuredGridFocus,
    setTextCursor,
    selections,
    offset,
    zoom,
    setOffset,
    moveSelections,
    expandSelection,
    fillSelectionsWithChar,
    clearSelections,
    structuredGridFocus,
    setStructuredGridFocus,
    selectedStructuredNodeIds,
    setSelectedStructuredNodeIds,
    setEditingStructuredTextNodeId,
    setStructuredTextSelection,
    canvasColorPickerTarget,
    setCanvasColorPickerTarget,
    setHoveredGrid,
  } = model;
  const staticGridView = useMemo(
    () =>
      getStaticGridViewState({
        selection: staticGridSelection,
        editMode: staticGridEditMode,
        textCursor,
        selections,
      }),
    [staticGridEditMode, staticGridSelection, textCursor, selections]
  );
  const activeTextCursor =
    canvasMode === 'freeform' ? staticGridView.textCursor : textCursor;
  const activeSelections =
    canvasMode === 'freeform' ? staticGridView.selectionAreas : selections;
  const freeformStaticCell =
    canvasMode === 'freeform' ? staticGridView.activeCell : null;
  const hasStructuredSelection =
    canvasMode === 'structured' && selectedStructuredNodeIds.length > 0;
  const hasStructuredGridFocus =
    canvasMode === 'structured' && !!structuredGridFocus;
  const hasActiveSelection = activeSelections.length > 0 || hasStructuredSelection;
  const hasManagedTextareaTarget =
    !!activeTextCursor ||
    hasActiveSelection ||
    hasStructuredGridFocus ||
    !!freeformStaticCell;
  const managedTextareaPoint =
    activeTextCursor ??
    structuredGridFocus ??
    activeSelections[0]?.start ??
    freeformStaticCell ??
    null;
  const managedTextareaFocusKey = hasManagedTextareaTarget
    ? [
        canvasMode,
        managedTextareaPoint?.x ?? 'none',
        managedTextareaPoint?.y ?? 'none',
        activeSelections.length,
        selectedStructuredNodeIds.join(','),
      ].join(':')
    : null;
  const focusManagedTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !hasManagedTextareaTarget) return;
    if (shouldIgnoreClipboardShortcut(document.activeElement, textarea)) return;
    if (document.activeElement !== textarea) {
      textarea.focus({ preventScroll: true });
    }
  }, [hasManagedTextareaTarget]);
  const handleCanvasPointerUp = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    if (shouldIgnoreCanvasSurfaceGesture(event.nativeEvent)) return;
    focusManagedTextarea();
  };
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (hasManagedTextareaTarget) {
      focusManagedTextarea();
      return;
    }

    if (document.activeElement === textarea) {
      textarea.blur();
    }
  }, [focusManagedTextarea, hasManagedTextareaTarget, managedTextareaFocusKey]);

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

  const textareaStyle: CSSProperties = useMemo(() => {
    if (!hasManagedTextareaTarget || !size) return { display: 'none' };
    const point = managedTextareaPoint ?? { x: 0, y: 0 };
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
  }, [
    hasManagedTextareaTarget,
    managedTextareaPoint,
    offset,
    zoom,
    size,
  ]);


  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    if (activeTextCursor) {
      if (e.key === 'Backspace') {
        e.preventDefault();
        backspaceText();
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        deleteTextForward();
        return;
      }
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && hasActiveSelection) {
      e.preventDefault();
      runAction('delete-selection', { source: 'canvas-keydown' });
      return;
    }

    if (e.key === 'Backspace') {
      if (activeTextCursor) {
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
      if (e.ctrlKey || e.metaKey) {
        setOffset((prev) => ({
          x: prev.x - dx * KEYBOARD_PAN_STEP,
          y: prev.y - dy * KEYBOARD_PAN_STEP,
        }));
        return;
      }

      if (canvasMode === 'freeform') {
        moveStaticGridFocus(dx, dy, { extend: e.shiftKey });
      } else if (textCursor) {
        moveTextCursor(dx, dy);
      } else if (!hasStructuredSelection) {
        moveStructuredGridFocus(dx, dy);
      } else if (selections.length > 0) {
        if (e.shiftKey) {
          expandSelection(dx, dy);
        } else {
          moveSelections(dx, dy);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (canvasColorPickerTarget) {
        setCanvasColorPickerTarget(null);
        setHoveredGrid(null);
      } else if (activeTextCursor) {
        setTextCursor(null);
        setEditingStructuredTextNodeId(null);
        setStructuredTextSelection(null);
      } else if (hasStructuredSelection) {
        setSelectedStructuredNodeIds([]);
      } else if (hasStructuredGridFocus) {
        setStructuredGridFocus(null);
      } else if (hasActiveSelection) {
        clearSelections();
      }
    } else if (activeSelections.length > 0 && !activeTextCursor) {
      const fillChar = resolveFillHotkeyChar(e);
      if (!fillChar) return;

      // Direct character fill when selection is active
      e.preventDefault();
      fillSelectionsWithChar(fillChar);
    }
  };

  return {
    textareaRef,
    onCanvasPointerUp: handleCanvasPointerUp,
    textareaStyle: textareaStyle as CSSProperties,
    textareaProps: {
      onCompositionStart: () => {
        isComposing.current = true;
      },
      onCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement>) => {
        isComposing.current = false;
        if (event.data) writeTextString(event.data);
        if (textareaRef.current) textareaRef.current.value = "";
      },
      onInput: (event: FormEvent<HTMLTextAreaElement>) => {
        if (!isComposing.current && event.currentTarget.value) {
          writeTextString(event.currentTarget.value);
          event.currentTarget.value = "";
        }
      },
      onKeyDown: handleKeyDown,
    },
  };
};