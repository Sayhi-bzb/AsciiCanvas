import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { CanvasMode } from "@/domains/sessions/public";
import { gridCellRect } from "@/shared/metrics";
import {
  getStaticGridViewState,
} from "@/domains/selection/public";
import { shouldIgnoreCanvasSurfaceGesture } from "./interaction/core/gestureGuards";
import {
  resolveActionShortcut,
  resolveFillHotkeyChar,
  isActionAccepted,
  resolveHistoryShortcutCommand,
  runAction,
} from "@/domains/actions/public";
import type { CanvasEditorModel } from "./canvasModels";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";
import {
  createClipboardShortcutCoordinator,
  type ClipboardShortcutAction,
  type ClipboardShortcutTrace,
} from "./clipboardShortcutCoordinator";

const KEYBOARD_PAN_STEP = 48;
const MANAGED_TEXTAREA_SENTINEL = "\u00a0";
const CLIPBOARD_DEBUG_STORAGE_KEY = "chardesk.clipboardDebug";
const LEGACY_CLIPBOARD_DEBUG_STORAGE_KEY = "ascii-canvas.clipboardDebug";

type ManagedActionSource =
  | 'canvas-keydown'
  | 'clipboard-event'
  | 'context-menu';

type RunManagedAction = (
  actionId: ClipboardShortcutAction,
  event?: ClipboardEvent,
  source?: ManagedActionSource
) => ReturnType<typeof runAction>;

const traceClipboardShortcut = (
  trace: ClipboardShortcutTrace,
  canvasOwnsInputFocus: boolean
) => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  try {
    const enabled =
      window.localStorage.getItem(CLIPBOARD_DEBUG_STORAGE_KEY) === '1' ||
      window.localStorage.getItem(LEGACY_CLIPBOARD_DEBUG_STORAGE_KEY) === '1';
    if (!enabled) return;
  } catch {
    return;
  }
  console.debug('[CharDesk clipboard]', {
    ...trace,
    activeElement: document.activeElement?.tagName ?? null,
    canvasOwnsInputFocus,
  });
};

type UseManagedCanvasInputOptions = {
  canvasMode: CanvasMode;
  model: CanvasEditorModel;
  size: { width: number; height: number } | undefined;
  onUndo: () => void;
  onRedo: () => void;
  enabled?: boolean;
};

export const useManagedCanvasInput = ({
  canvasMode,
  model,
  size,
  onUndo,
  onRedo,
  enabled = true,
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
  const [canvasOwnsInputFocus, setCanvasOwnsInputFocus] = useState(false);
  const canvasOwnsInputFocusRef = useRef(false);
  const managedTextareaPoint =
    activeTextCursor ??
    structuredGridFocus ??
    activeSelections[0]?.start ??
    freeformStaticCell ??
    null;
  const primeManagedTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !canvasOwnsInputFocusRef.current || isComposing.current) {
      return;
    }
    textarea.value = MANAGED_TEXTAREA_SENTINEL;
    textarea.setSelectionRange(0, MANAGED_TEXTAREA_SENTINEL.length);
  }, []);
  const focusManagedTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    canvasOwnsInputFocusRef.current = true;
    setCanvasOwnsInputFocus(true);
    if (document.activeElement !== textarea) {
      textarea.focus({ preventScroll: true });
    }
    // Safari does not consistently dispatch cut/copy for an empty editable
    // target. Keep a selected sentinel so the native clipboard event fires.
    primeManagedTextarea();
  }, [primeManagedTextarea]);
  const releaseManagedTextarea = useCallback(() => {
    canvasOwnsInputFocusRef.current = false;
    setCanvasOwnsInputFocus(false);
  }, []);
  const handleCanvasPointerDown = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    if (shouldIgnoreCanvasSurfaceGesture(event.nativeEvent)) {
      releaseManagedTextarea();
      return;
    }
    event.preventDefault();
    focusManagedTextarea();
  };
  useLayoutEffect(() => {
    if (!canvasOwnsInputFocus) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (document.activeElement !== textarea) {
      textarea.focus({ preventScroll: true });
    }
    primeManagedTextarea();
  }, [canvasOwnsInputFocus, managedTextareaPoint, primeManagedTextarea]);

  useEffect(() => {
    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const textarea = textareaRef.current;
      const surface = textarea?.closest('[data-testid="canvas-editor-surface"]');
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (surface?.contains(target) && !shouldIgnoreCanvasSurfaceGesture(event)) {
        return;
      }
      releaseManagedTextarea();
    };
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
    };
  }, [releaseManagedTextarea]);

  const runManagedAction: RunManagedAction = (
    actionId,
    e?: ClipboardEvent,
    source: ManagedActionSource =
      e ? 'clipboard-event' : 'context-menu'
  ) => {
    return runAction(actionId, {
      source,
      clipboardEvent: e,
      managedTextarea: textareaRef.current,
    });
  };
  const [clipboardShortcutCoordinator] = useState(() =>
    createClipboardShortcutCoordinator({})
  );

  useEffect(() => {
    clipboardShortcutCoordinator.setFallbackHandler((actionId) => {
      runManagedAction(actionId, undefined, 'canvas-keydown');
    });
    clipboardShortcutCoordinator.setTraceHandler((trace) => {
      traceClipboardShortcut(trace, canvasOwnsInputFocusRef.current);
    });
    return () => {
      clipboardShortcutCoordinator.dispose();
    };
  }, [clipboardShortcutCoordinator]);

  useShortcutLayer({
    id: "managed-canvas-commands",
    priority: SHORTCUT_PRIORITY.managedCanvas,
    enabled: enabled && canvasOwnsInputFocus,
    onKeyDown: (event, context) => {
      if (
        context.targetKind !== "managed-canvas" ||
        event.target !== textareaRef.current
      ) {
        return;
      }
      const clipboardCommand = resolveActionShortcut(
        event,
        ["copy", "cut", "paste"] as const
      );
      if (clipboardCommand) {
        primeManagedTextarea();
        clipboardShortcutCoordinator.begin(clipboardCommand);
        return { claimed: true, preventDefault: false };
      }
      const historyCommand = resolveHistoryShortcutCommand(event);
      if (!historyCommand) return;
      const result = runAction(historyCommand, {
        source: "canvas-keydown",
        managedTextarea: textareaRef.current,
        onUndo,
        onRedo,
      });
      return result.status === "succeeded"
        ? { claimed: true, preventDefault: true }
        : undefined;
    },
  });

  const handleCopy = (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
    if (clipboardShortcutCoordinator.handleNative('copy') === 'suppress') {
      e.preventDefault();
      return;
    }
    const result = runManagedAction('copy', e.nativeEvent);
    if (isActionAccepted(result)) e.preventDefault();
  };
  const handleCut = (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
    if (clipboardShortcutCoordinator.handleNative('cut') === 'suppress') {
      e.preventDefault();
      return;
    }
    const result = runManagedAction('cut', e.nativeEvent);
    if (isActionAccepted(result) || document.activeElement === textareaRef.current) {
      e.preventDefault();
    }
  };
  const handlePaste = (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
    if (clipboardShortcutCoordinator.handleNative('paste') === 'suppress') {
      e.preventDefault();
      return;
    }
    const result = runManagedAction('paste', e.nativeEvent);
    if (isActionAccepted(result) || document.activeElement === textareaRef.current) {
      e.preventDefault();
    }
  };
  useShortcutLayer({
    id: "canvas-color-picker",
    priority: SHORTCUT_PRIORITY.dynamicCanvasCommand,
    enabled: !!canvasColorPickerTarget,
    onKeyDown: (event, context) => {
      if (
        event.key !== "Escape" ||
        context.targetKind === "editable" ||
        context.targetKind === "overlay"
      ) {
        return;
      }
      setCanvasColorPickerTarget(null);
      setHoveredGrid(null);
      return { claimed: true, preventDefault: true };
    },
  });

  const textareaStyle: CSSProperties = useMemo(() => {
    const point = managedTextareaPoint ?? { x: 0, y: 0 };
    const pos = size
      ? gridCellRect(point, { offset, zoom })
      : { x: 0, y: 0 };
    const bounds = size ?? { width: 1, height: 1 };

    return {
      position: 'absolute',
      left: `${Math.max(0, Math.min(bounds.width - 1, pos.x))}px`,
      top: `${Math.max(0, Math.min(bounds.height - 1, pos.y))}px`,
      width: '1px',
      height: '1px',
      opacity: 0.01,
      color: 'transparent',
      caretColor: 'transparent',
      background: 'transparent',
      border: 0,
      padding: 0,
      resize: 'none',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 1,
    };
  }, [
    managedTextareaPoint,
    offset,
    zoom,
    size,
  ]);


  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.defaultPrevented) return;
    if (isComposing.current) return;
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
    onCanvasPointerDown: handleCanvasPointerDown,
    textareaStyle: textareaStyle as CSSProperties,
    textareaProps: {
      onCompositionStart: () => {
        isComposing.current = true;
      },
      onCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement>) => {
        isComposing.current = false;
        if (event.data) writeTextString(event.data);
        primeManagedTextarea();
      },
      onInput: (event: FormEvent<HTMLTextAreaElement>) => {
        const value = event.currentTarget.value.replaceAll(
          MANAGED_TEXTAREA_SENTINEL,
          ""
        );
        if (!isComposing.current) {
          if (value) {
            writeTextString(value);
          }
          primeManagedTextarea();
        }
      },
      onKeyDown: handleKeyDown,
      onCopy: handleCopy,
      onCut: handleCut,
      onPaste: handlePaste,
      onBlur: () => {
        if (document.activeElement !== textareaRef.current) {
          releaseManagedTextarea();
        }
      },
    },
  };
};
