import { useRef, useMemo, useEffect, useLayoutEffect, useState, type DragEvent } from 'react';
import { useSize, useEventListener } from 'ahooks';
import { useCanvasStore } from '@/domains/canvas/state/canvasStore';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
import { Minimap } from './Minimap';
import { SelectionFormatToolbar } from './SelectionFormatToolbar';
import { StructuredTemplatePreviewGrid } from '@/domains/canvas/components/ToolBar/structured-template-preview-grid';
import { getCenteredAnimationOffset } from '@/domains/canvas/state/helpers/animationHelpers';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/shared/ui/context-menu';
import {
  ACTION_CATALOG,
  CANVAS_CONTEXT_MENU,
  STRUCTURED_CONTEXT_MENU,
  canRunAction,
  runAction,
} from '@/domains/actions/core';
import { getActionShortcutLabel } from '@/domains/actions/core/shortcuts';
import { resolveFillHotkeyChar } from '@/domains/actions/input-arbiter';
import {
  resolveHistoryShortcutCommand,
} from '@/domains/actions/adapters/editorCommands';
import { shouldIgnoreClipboardShortcut } from '@/shared/utils/dom-focus';
import { gridCellRect } from '@/shared/metrics';
import { GridManager } from '@/shared/utils/grid';
import {
  findStructuredNodeHit,
  isStructuredSplitBoxLineHandle,
} from '@/domains/canvas/state/helpers/structuredBoxEditing';
import {
  buildStructuredTemplate,
  getActiveStructuredTemplateDragId,
  getStructuredTemplatePreview,
  isStructuredTemplateId,
  setActiveStructuredTemplateDragId,
  STRUCTURED_TEMPLATE_MIME,
  STRUCTURED_TEMPLATES,
  type StructuredTemplateId,
} from '@/domains/canvas/state/helpers/structuredTemplates';
import { getStaticGridViewState } from '@/domains/canvas/state/helpers/staticGridModel';
import { useShallow } from 'zustand/react/shallow';
import type { CanvasLinkHit } from './hooks/interaction/core/linkHitTesting';
import type { Point } from '@/shared/types';
import { FONT_SIZE } from '@/shared/lib/constants';
import type { ContextMenuEntry } from '@/domains/actions/core/types';
import type { StructuredMovePreview } from './hooks/useCanvasRenderer';
import { normalizeScene } from '@/shared/utils/structured';
import { useUiI18n, type I18nKey } from '@/shared/i18n';

const KEYBOARD_PAN_STEP = 48;

type StructuredTemplatePreviewState = {
  templateId: StructuredTemplateId;
  position: Point;
};

interface AsciiCanvasProps {
  onUndo: () => void;
  onRedo: () => void;
}

export const AsciiCanvas = ({ onUndo, onRedo }: AsciiCanvasProps) => {
  const { t } = useUiI18n();
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposing = useRef(false);
  const [hoveredLink, setHoveredLink] = useState<CanvasLinkHit | null>(null);
  const structuredMovePreviewRef = useRef<StructuredMovePreview | null>(null);
  const requestCanvasRenderRef = useRef<(() => void) | null>(null);
  const [structuredTemplatePreview, setStructuredTemplatePreviewState] =
    useState<StructuredTemplatePreviewState | null>(null);
  const structuredTemplatePreviewRef =
    useRef<StructuredTemplatePreviewState | null>(null);
  const pendingStructuredTemplatePreviewRef =
    useRef<StructuredTemplatePreviewState | null>(null);
  const structuredTemplatePreviewRafRef = useRef<number | null>(null);

  const size = useSize(containerRef);
  const interactionStore = useCanvasStore(
    useShallow((state) => ({
      tool: state.tool,
      canvasMode: state.canvasMode,
      brushChar: state.brushChar,
      brushColor: state.brushColor,
      setBrushColor: state.setBrushColor,
      canvasColorPickerTarget: state.canvasColorPickerTarget,
      setCanvasColorPickerTarget: state.setCanvasColorPickerTarget,
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
      structuredScene: state.structuredScene,
      structuredComponents: state.structuredComponents,
      editingStructuredTextNodeId: state.editingStructuredTextNodeId,
      selectedStructuredNodeIds: state.selectedStructuredNodeIds,
      setStructuredGridFocus: state.setStructuredGridFocus,
      setStructuredContextPoint: state.setStructuredContextPoint,
      setSelectedStructuredNodeIds: state.setSelectedStructuredNodeIds,
      setSelectedStructuredSplitHandle: state.setSelectedStructuredSplitHandle,
      setEditingStructuredTextNodeId: state.setEditingStructuredTextNodeId,
      setStructuredTextSelection: state.setStructuredTextSelection,
      structuredTextSelection: state.structuredTextSelection,
      setStructuredTextColor: state.setStructuredTextColor,
      applyStructuredScene: state.applyStructuredScene,
      updateStructuredNode: state.updateStructuredNode,
      activeCanvasHasSavedViewport: state.activeCanvasHasSavedViewport,
    }))
  );
  const {
    canvasMode,
    canvasBounds: interactionCanvasBounds,
    setOffset: setCanvasOffset,
    activeCanvasHasSavedViewport,
  } = interactionStore;
  const rendererStore = useCanvasStore(
    useShallow((state) => ({
      offset: state.offset,
      zoom: state.zoom,
      grid: state.grid,
      scratchLayer: state.scratchLayer,
      textCursor: state.textCursor,
      selections: state.selections,
      staticGridSelection: state.staticGridSelection,
      staticGridEditMode: state.staticGridEditMode,
      showGrid: state.showGrid,
      hoveredGrid: state.hoveredGrid,
      tool: state.tool,
      canvasMode: state.canvasMode,
      canvasBounds: state.canvasBounds,
      animationTimeline: state.animationTimeline,
      animationPlaybackFrameId: state.animationPlaybackFrameId,
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
    setSelectedStructuredSplitHandle,
    setEditingStructuredTextNodeId,
    setStructuredTextSelection,
    structuredScene,
    structuredComponents,
    brushColor,
    canvasColorPickerTarget,
    setCanvasColorPickerTarget,
    setHoveredGrid,
    getNextStructuredOrder,
    applyStructuredScene,
    setStructuredContextPoint,
  } = useCanvasStore(
    useShallow((state) => ({
      textCursor: state.textCursor,
      staticGridSelection: state.staticGridSelection,
      staticGridEditMode: state.staticGridEditMode,
      writeTextString: state.writeTextString,
      backspaceText: state.backspaceText,
      deleteTextForward: state.deleteTextForward,
      newlineText: state.newlineText,
      indentText: state.indentText,
      moveTextCursor: state.moveTextCursor,
      moveStaticGridFocus: state.moveStaticGridFocus,
      moveStructuredGridFocus: state.moveStructuredGridFocus,
      setTextCursor: state.setTextCursor,
      selections: state.selections,
      offset: state.offset,
      zoom: state.zoom,
      setOffset: state.setOffset,
      moveSelections: state.moveSelections,
      expandSelection: state.expandSelection,
      fillSelectionsWithChar: state.fillSelectionsWithChar,
      clearSelections: state.clearSelections,
      structuredGridFocus: state.structuredGridFocus,
      setStructuredGridFocus: state.setStructuredGridFocus,
      selectedStructuredNodeIds: state.selectedStructuredNodeIds,
      setSelectedStructuredNodeIds: state.setSelectedStructuredNodeIds,
      setSelectedStructuredSplitHandle: state.setSelectedStructuredSplitHandle,
      setEditingStructuredTextNodeId: state.setEditingStructuredTextNodeId,
      setStructuredTextSelection: state.setStructuredTextSelection,
      structuredScene: state.structuredScene,
      structuredComponents: state.structuredComponents,
      brushColor: state.brushColor,
      canvasColorPickerTarget: state.canvasColorPickerTarget,
      setCanvasColorPickerTarget: state.setCanvasColorPickerTarget,
      setHoveredGrid: state.setHoveredGrid,
      getNextStructuredOrder: state.getNextStructuredOrder,
      applyStructuredScene: state.applyStructuredScene,
      setStructuredContextPoint: state.setStructuredContextPoint,
    }))
  );

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
  const activeContextMenu =
    canvasMode === 'structured' ? STRUCTURED_CONTEXT_MENU : CANVAS_CONTEXT_MENU;
  const getContextMenuActionLabel = (id: string, fallback: string) => {
    const labelKeyById: Record<string, I18nKey> = {
      copy: 'context.copyText',
      'copy-rich': 'context.copyColor',
      'copy-ansi': 'context.copyAnsi',
      cut: 'context.cutZone',
      paste: 'context.paste',
      'fill-selection-char': 'context.fillSelection',
      'snapshot-png': 'context.snapshotPng',
      'delete-selection': 'context.delete',
      'structured-rename': 'context.rename',
      'structured-bring-forward': 'context.bringForward',
      'structured-send-backward': 'context.sendBackward',
      'structured-bring-to-front': 'context.bringToFront',
      'structured-send-to-back': 'context.sendToBack',
      'structured-duplicate': 'context.duplicate',
      'structured-copy-hierarchy': 'context.copyStructure',
      'structured-split-horizontal': 'context.splitHorizontal',
      'structured-split-vertical': 'context.splitVertical',
      'structured-delete-divider': 'context.deleteDivider',
    };
    const labelKey = labelKeyById[id];
    return labelKey ? t(labelKey) : fallback;
  };
  const renderContextMenuEntry = (entry: ContextMenuEntry, index: number) => {
    if (entry.type === 'separator') {
      return <ContextMenuSeparator key={`sep-${index}`} />;
    }

    if (entry.type === 'submenu') {
      const Icon = entry.icon;
      const hasEnabledChild = entry.children.some(
        (child) => child.type === 'action' && canRunAction(child.id, useCanvasStore.getState())
      );

      return (
        <ContextMenuSub key={`sub-${entry.label}-${index}`}>
          <ContextMenuSubTrigger disabled={!hasEnabledChild}>
            {Icon && <Icon className="mr-2 size-4" />}
            <span>{entry.label === 'Layer' ? t('context.layer') : entry.label}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {entry.children.map((child, childIndex) =>
              renderContextMenuEntry(child, childIndex)
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
      );
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
        <span>{getContextMenuActionLabel(entry.id, meta.label)}</span>
        {shortcutLabel && (
          <ContextMenuShortcut>{shortcutLabel}</ContextMenuShortcut>
        )}
      </ContextMenuItem>
    );
  };
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (hasManagedTextareaTarget) {
      if (shouldIgnoreClipboardShortcut(document.activeElement, textarea)) {
        return;
      }
      if (document.activeElement !== textarea) {
        textarea.focus({ preventScroll: true });
      }
      return;
    }

    if (document.activeElement === textarea) {
      textarea.blur();
    }
  }, [hasManagedTextareaTarget, managedTextareaFocusKey]);

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

  const cancelStructuredTemplatePreviewFrame = () => {
    if (structuredTemplatePreviewRafRef.current === null) return;
    window.cancelAnimationFrame(structuredTemplatePreviewRafRef.current);
    structuredTemplatePreviewRafRef.current = null;
  };

  const commitStructuredTemplatePreview = (
    preview: StructuredTemplatePreviewState | null
  ) => {
    pendingStructuredTemplatePreviewRef.current = preview;
    structuredTemplatePreviewRef.current = preview;
    setStructuredTemplatePreviewState((current) => {
      if (
        current?.templateId === preview?.templateId &&
        current?.position.x === preview?.position.x &&
        current?.position.y === preview?.position.y
      ) {
        return current;
      }
      return preview;
    });
  };

  const scheduleStructuredTemplatePreview = (
    preview: StructuredTemplatePreviewState
  ) => {
    const pending = pendingStructuredTemplatePreviewRef.current;
    if (
      pending?.templateId === preview.templateId &&
      pending.position.x === preview.position.x &&
      pending.position.y === preview.position.y
    ) {
      return;
    }

    pendingStructuredTemplatePreviewRef.current = preview;
    if (structuredTemplatePreviewRafRef.current !== null) return;

    structuredTemplatePreviewRafRef.current = window.requestAnimationFrame(() => {
      structuredTemplatePreviewRafRef.current = null;
      commitStructuredTemplatePreview(
        pendingStructuredTemplatePreviewRef.current
      );
    });
  };

  const clearStructuredTemplatePreview = () => {
    cancelStructuredTemplatePreviewFrame();
    commitStructuredTemplatePreview(null);
  };

  useEffect(() => () => cancelStructuredTemplatePreviewFrame(), []);

  const textareaStyle: React.CSSProperties = useMemo(() => {
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

  const hasStructuredTemplateDragData = (dataTransfer: DataTransfer) => {
    return Array.from(dataTransfer.types).includes(STRUCTURED_TEMPLATE_MIME);
  };

  const getStructuredTemplateDragPoint = (
    event: DragEvent<HTMLDivElement>
  ): Point | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return GridManager.screenToGrid(
      event.clientX - rect.left,
      event.clientY - rect.top,
      offset.x,
      offset.y,
      zoom
    );
  };

  const getStructuredTemplateDragId = (
    dataTransfer: DataTransfer
  ): StructuredTemplateId | null => {
    const templateId = dataTransfer.getData(STRUCTURED_TEMPLATE_MIME);
    if (isStructuredTemplateId(templateId)) return templateId;

    // Some browsers hide custom drag data until drop, so dragover reads the
    // active template captured by the sidebar drag session.
    if (hasStructuredTemplateDragData(dataTransfer)) {
      return getActiveStructuredTemplateDragId();
    }
    return null;
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (canvasMode !== 'structured') return;
    if (!hasStructuredTemplateDragData(event.dataTransfer)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

    const templateId = getStructuredTemplateDragId(event.dataTransfer);
    const position = getStructuredTemplateDragPoint(event);
    if (!templateId || !position) return;

    scheduleStructuredTemplatePreview({ templateId, position });
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (canvasMode !== 'structured') return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    clearStructuredTemplatePreview();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (canvasMode !== 'structured') return;
    const templateId = getStructuredTemplateDragId(event.dataTransfer);
    if (!templateId) {
      clearStructuredTemplatePreview();
      setActiveStructuredTemplateDragId(null);
      return;
    }

    event.preventDefault();
    const latestPreview =
      pendingStructuredTemplatePreviewRef.current ??
      structuredTemplatePreviewRef.current;
    const point =
      latestPreview?.templateId === templateId
        ? latestPreview.position
        : getStructuredTemplateDragPoint(event);
    if (!point) {
      clearStructuredTemplatePreview();
      setActiveStructuredTemplateDragId(null);
      return;
    }

    clearStructuredTemplatePreview();
    setActiveStructuredTemplateDragId(null);
    const { nodes, components } = buildStructuredTemplate(templateId, point, {
      brushColor,
      startOrder: getNextStructuredOrder(),
    });
    if (nodes.length === 0) return;

    applyStructuredScene(
      [...structuredScene, ...nodes],
      true,
      [...structuredComponents, ...components]
    );
    setSelectedStructuredNodeIds(normalizeScene(nodes).map((node) => node.id));
    setEditingStructuredTextNodeId(null);
    setStructuredTextSelection(null);
    setTextCursor(null);
    setStructuredGridFocus(null);
    clearSelections();
  };

  const activeStructuredTemplatePreview = structuredTemplatePreview
    ? STRUCTURED_TEMPLATES.find(
        (template) => template.id === structuredTemplatePreview.templateId
      )
    : null;
  const structuredTemplatePreviewRect =
    structuredTemplatePreview && activeStructuredTemplatePreview
      ? gridCellRect(structuredTemplatePreview.position, { offset, zoom })
      : null;
  const structuredTemplatePreviewGrid = activeStructuredTemplatePreview
    ? getStructuredTemplatePreview(activeStructuredTemplatePreview.id)
    : null;

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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          style={{ touchAction: 'none' }}
          onContextMenu={handleContextMenu}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDoubleClick={handleDoubleClick}
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
          {activeStructuredTemplatePreview &&
            structuredTemplatePreviewRect &&
            structuredTemplatePreviewGrid && (
            <div
              data-testid="structured-template-preview"
              className="pointer-events-none absolute"
              style={{
                left: `${structuredTemplatePreviewRect.x}px`,
                top: `${structuredTemplatePreviewRect.y}px`,
                width: `${
                  structuredTemplatePreviewRect.width *
                  structuredTemplatePreviewGrid.width
                }px`,
                height: `${
                  structuredTemplatePreviewRect.height *
                  structuredTemplatePreviewGrid.height
                }px`,
                zIndex: 20,
              }}
            >
              <StructuredTemplatePreviewGrid
                preview={structuredTemplatePreviewGrid}
                cellWidth={structuredTemplatePreviewRect.width}
                cellHeight={structuredTemplatePreviewRect.height}
                fontSize={FONT_SIZE * zoom}
              />
            </div>
          )}
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
        {activeContextMenu.map((entry, index) =>
          renderContextMenuEntry(entry, index)
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};


