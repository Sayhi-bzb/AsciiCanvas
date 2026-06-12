"use client";

import { Clapperboard, Copy, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { SidebarStandard, useSidebar } from "@/shared/ui/sidebar";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { AnimationEffectsPanel } from "@/domains/animation-generators/components/AnimationEffectsPanel";
import { cn } from "@/shared/lib/utils";
import type { AnimationCanvasSize, AnimationFrame, GridCell } from "@/shared/types";
import {
  BACKGROUND_COLOR,
} from "@/shared/lib/constants";
import { GridManager } from "@/shared/utils/grid";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawTextCell,
  setTextRenderStyle,
} from "@/shared/metrics";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";

const FRAME_PREVIEW_PADDING = 6;

function FramePreview({
  frame,
  size,
  isActive,
}: {
  frame: AnimationFrame;
  size: AnimationCanvasSize | null;
  isActive: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameMap = useMemo(() => new Map<string, GridCell>(frame.grid), [frame.grid]);
  const previewSize = useMemo(() => {
    if (size) return size;
    if (frameMap.size === 0) return { width: 1, height: 1 };
    const { maxX, maxY } = GridManager.getGridBounds(frameMap);
    return {
      width: Math.max(maxX + 1, 1),
      height: Math.max(maxY + 1, 1),
    };
  }, [frameMap, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (!displayWidth || !displayHeight) return;

    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
    const sourceWidth = Math.max(previewSize.width, 1) * cellWidth;
    const sourceHeight = Math.max(previewSize.height, 1) * cellHeight;
    const scale = Math.min(
      (displayWidth - FRAME_PREVIEW_PADDING * 2) / sourceWidth,
      (displayHeight - FRAME_PREVIEW_PADDING * 2) / sourceHeight
    );
    const offsetX = (displayWidth - sourceWidth * scale) / 2;
    const offsetY = (displayHeight - sourceHeight * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    setTextRenderStyle(ctx);

    frameMap.forEach((cell, key) => {
      const [x, y] = key.split(",").map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const drawX = x * cellWidth;
      const drawY = y * cellHeight;
      drawTextCell(ctx, cell, drawX, drawY);
    });

    ctx.strokeStyle = isActive ? "rgba(37, 99, 235, 0.7)" : "rgba(15, 23, 42, 0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, sourceWidth, sourceHeight);
    ctx.restore();
  }, [frameMap, isActive, previewSize]);

  return (
    <div
      className={cn(
        "relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border bg-background/80",
        isActive ? "border-primary/40" : "border-border/70"
      )}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {frame.grid.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Empty
        </div>
      )}
    </div>
  );
}

function FrameRow({
  frame,
  index,
  size,
  isActive,
  isSelected,
  isEditing,
  isCollapsed,
  editingName,
  inputRef,
  canDelete,
  onSelect,
  onContextSelect,
  onStartRename,
  onEditingNameChange,
  onCommitRename,
  onCancelRename,
  onInsertAfter,
  onDuplicate,
  onDelete,
}: {
  frame: AnimationFrame;
  index: number;
  size: AnimationCanvasSize | null;
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isCollapsed: boolean;
  editingName: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  canDelete: boolean;
  onSelect: (event?: React.MouseEvent | React.KeyboardEvent) => void;
  onContextSelect: () => void;
  onStartRename: () => void;
  onEditingNameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onInsertAfter: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const dragControls = useDragControls();
  const frameLabel = `Frame ${index + 1}`;
  const rowClassName = cn(
    "group/frame relative flex w-full min-w-0 items-center rounded-xl px-1.5 py-2 text-left outline-none overflow-hidden",
    isActive
      ? "bg-primary/12 text-primary ring-1 ring-primary/20"
      : isSelected
      ? "bg-accent/55 text-foreground ring-1 ring-border/80"
      : "text-foreground hover:bg-accent/45 focus-visible:bg-accent/45"
  );
  const stopFrameSelectionEvent = (
    event: React.MouseEvent | React.PointerEvent
  ) => {
    event.stopPropagation();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
    }
  };

  return (
    <Reorder.Item
      key={frame.id}
      value={frame.id}
      dragListener={false}
      dragControls={dragControls}
      transition={{ duration: 0 }}
      className="min-w-0 list-none"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {isEditing ? (
            <div className={rowClassName}>
              <Input
                ref={inputRef}
                value={editingName}
                onChange={(event) => onEditingNameChange(event.target.value)}
                onBlur={onCommitRename}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCommitRename();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelRename();
                  }
                }}
                className="h-8 border-none bg-background/90 px-2 text-sm font-semibold shadow-none focus-visible:ring-1"
              />
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-current={isActive ? "true" : undefined}
              aria-selected={isSelected}
              aria-label={`Select ${frameLabel}: ${frame.name}`}
              onPointerDown={stopFrameSelectionEvent}
              onMouseDown={stopFrameSelectionEvent}
              onClick={onSelect}
              onContextMenu={onContextSelect}
              onDoubleClick={onStartRename}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect();
                }
              }}
              className={rowClassName}
            >
              <button
                type="button"
                aria-label={`Reorder ${frame.name}`}
                title="Drag to reorder"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dragControls.start(event);
                }}
                onClick={(event) => event.stopPropagation()}
                className="mr-1 flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical className="size-3.5" />
              </button>

              <FramePreview frame={frame} size={size} isActive={isActive} />

              {!isCollapsed && (
                <div className="ml-2 min-w-0 flex-1 overflow-hidden">
                  <span className="block truncate text-sm font-semibold">
                    {frame.name}
                  </span>
                </div>
              )}

            </div>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-36">
          <ContextMenuItem onClick={onStartRename}>
            <Pencil className="size-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDuplicate}>
            <Copy className="size-4" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onClick={onInsertAfter}>
            <Plus className="size-4" />
            Insert After
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            disabled={!canDelete}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

    </Reorder.Item>
  );
}

export function SidebarLeft() {
  const {
    canvasMode,
    canvasBounds,
    animationTimeline,
    animationIsPlaying,
    setAnimationCurrentFrame,
    insertAnimationFrame,
    renameAnimationFrame,
    duplicateAnimationFrames,
    removeAnimationFrames,
    reorderAnimationFrames,
  } = useCanvasStore(
    useShallow((state) => ({
      canvasMode: state.canvasMode,
      canvasBounds: state.canvasBounds,
      animationTimeline: state.animationTimeline,
      animationIsPlaying: state.animationIsPlaying,
      setAnimationCurrentFrame: state.setAnimationCurrentFrame,
      insertAnimationFrame: state.insertAnimationFrame,
      renameAnimationFrame: state.renameAnimationFrame,
      duplicateAnimationFrames: state.duplicateAnimationFrames,
      removeAnimationFrames: state.removeAnimationFrames,
      reorderAnimationFrames: state.reorderAnimationFrames,
    }))
  );
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pinnedFrameId, setPinnedFrameId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"frames" | "effects">("frames");
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const [selectionAnchorFrameId, setSelectionAnchorFrameId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!editingId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingId]);

  const sidebarCurrentFrameId = useMemo(() => {
    if (!animationTimeline) return null;
    if (!animationIsPlaying) return animationTimeline.currentFrameId;
    if (
      pinnedFrameId &&
      animationTimeline.frames.some((frame) => frame.id === pinnedFrameId)
    ) {
      return pinnedFrameId;
    }
    return animationTimeline.currentFrameId;
  }, [animationIsPlaying, animationTimeline, pinnedFrameId]);

  const activeFrameIndex = useMemo(() => {
    if (!animationTimeline) return -1;
    return animationTimeline.frames.findIndex(
      (frame) => frame.id === sidebarCurrentFrameId
    );
  }, [animationTimeline, sidebarCurrentFrameId]);

  const frameOrder = useMemo(
    () => animationTimeline?.frames.map((frame) => frame.id) ?? [],
    [animationTimeline]
  );

  const effectiveSelectedFrameIds = useMemo(() => {
    if (!animationTimeline) return [];
    const existingIds = new Set(animationTimeline.frames.map((frame) => frame.id));
    const next = selectedFrameIds.filter((frameId) => existingIds.has(frameId));
    if (next.length > 0) return next;
    return animationTimeline.currentFrameId
      ? [animationTimeline.currentFrameId]
      : [];
  }, [animationTimeline, selectedFrameIds]);

  const effectiveSelectionAnchorFrameId = useMemo(() => {
    if (!animationTimeline) return null;
    const existingIds = new Set(animationTimeline.frames.map((frame) => frame.id));
    return selectionAnchorFrameId && existingIds.has(selectionAnchorFrameId)
      ? selectionAnchorFrameId
      : effectiveSelectedFrameIds[0] ?? animationTimeline.currentFrameId;
  }, [animationTimeline, effectiveSelectedFrameIds, selectionAnchorFrameId]);

  if (canvasMode !== "animation" || !animationTimeline) {
    return null;
  }

  const stopCanvasUiEvent = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  const selectFrame = (
    frameId: string,
    event?: React.MouseEvent | React.KeyboardEvent
  ) => {
    const frameIds = animationTimeline.frames.map((frame) => frame.id);
    const frameIndex = frameIds.indexOf(frameId);
    if (frameIndex === -1) return;

    if (event?.shiftKey) {
      const anchorId = effectiveSelectionAnchorFrameId ?? frameId;
      const anchorIndex = frameIds.indexOf(anchorId);
      const start = Math.min(anchorIndex === -1 ? frameIndex : anchorIndex, frameIndex);
      const end = Math.max(anchorIndex === -1 ? frameIndex : anchorIndex, frameIndex);
      setPinnedFrameId(frameId);
      setAnimationCurrentFrame(frameId);
      setSelectedFrameIds(frameIds.slice(start, end + 1));
      setSelectionAnchorFrameId(anchorId);
      return;
    }

    if (event?.ctrlKey || event?.metaKey) {
      if (effectiveSelectedFrameIds.includes(frameId)) {
        if (effectiveSelectedFrameIds.length === 1) return;
        const nextFrameIds = effectiveSelectedFrameIds.filter(
          (entry) => entry !== frameId
        );
        const nextCurrentFrameId = nextFrameIds[0];
        setPinnedFrameId(nextCurrentFrameId);
        setAnimationCurrentFrame(nextCurrentFrameId);
        setSelectedFrameIds(nextFrameIds);
        setSelectionAnchorFrameId(nextCurrentFrameId);
        return;
      }
      setPinnedFrameId(frameId);
      setAnimationCurrentFrame(frameId);
      setSelectedFrameIds([...effectiveSelectedFrameIds, frameId]);
      setSelectionAnchorFrameId(frameId);
      return;
    }

    setPinnedFrameId(frameId);
    setAnimationCurrentFrame(frameId);
    setSelectedFrameIds([frameId]);
    setSelectionAnchorFrameId(frameId);
  };

  const selectFrameForContextMenu = (frameId: string) => {
    if (effectiveSelectedFrameIds.includes(frameId)) return;
    setPinnedFrameId(frameId);
    setAnimationCurrentFrame(frameId);
    setSelectedFrameIds([frameId]);
    setSelectionAnchorFrameId(frameId);
  };

  const getActionFrameIds = (frameId: string) => {
    const selectedIds = new Set(effectiveSelectedFrameIds);
    const actionIds = animationTimeline.frames
      .map((frame) => frame.id)
      .filter((id) => selectedIds.has(id));
    return actionIds.includes(frameId) ? actionIds : [frameId];
  };

  const duplicateSelectedFrames = (frameId: string) => {
    const newFrameIds = duplicateAnimationFrames(getActionFrameIds(frameId));
    if (newFrameIds.length === 0) return;
    setSelectedFrameIds(newFrameIds);
    setSelectionAnchorFrameId(newFrameIds[0]);
    setPinnedFrameId(newFrameIds[0]);
  };

  const removeSelectedFrames = (frameId: string) => {
    const actionFrameIds = getActionFrameIds(frameId);
    const fallbackFrameIds = removeAnimationFrames(actionFrameIds);
    if (fallbackFrameIds.length === 0) return;
    setSelectedFrameIds(fallbackFrameIds);
    setSelectionAnchorFrameId(fallbackFrameIds[0]);
    setPinnedFrameId(fallbackFrameIds[0]);
    if (editingId && actionFrameIds.includes(editingId)) {
      setEditingId(null);
    }
  };

  const startRename = (frameId: string, frameName: string) => {
    setAnimationCurrentFrame(frameId);
    setPinnedFrameId(frameId);
    setEditingId(frameId);
    setEditingName(frameName);
  };

  const commitRename = () => {
    if (!editingId) return;
    renameAnimationFrame(editingId, editingName);
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  return (
    <SidebarStandard
      variant="floating"
      side="left"
      title="Frames"
      className="pointer-events-auto"
      data-canvas-ui="true"
      onPointerDown={stopCanvasUiEvent}
      onMouseDown={stopCanvasUiEvent}
      onClick={stopCanvasUiEvent}
      onContextMenu={stopCanvasUiEvent}
      icon={
        <div className="flex items-center justify-center rounded-lg bg-accent p-1.5 shrink-0">
          <Clapperboard className="size-4 text-accent-foreground" />
        </div>
      }
      footer={
        <div className={cn("w-full", isCollapsed && "flex justify-center")}>
          <Button
            type="button"
            tone="neutral"
            size="sm"
            className={cn(
              "w-full shadow-none",
              isCollapsed && "size-8 rounded-lg px-0"
            )}
            onClick={() => insertAnimationFrame("after")}
            aria-label="Add frame after current"
            title="Add frame after current"
          >
            <Plus className="size-4" />
            {!isCollapsed && <span>Add After Current</span>}
          </Button>
        </div>
      }
    >
      {!isCollapsed && (
        <div className="mb-3 grid grid-cols-2 gap-1">
          {(["frames", "effects"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPanelMode(mode)}
              className={cn(
                "h-8 rounded-lg text-xs font-semibold capitalize transition-colors",
                panelMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/35 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      )}

      {panelMode === "effects" && !isCollapsed ? (
        <AnimationEffectsPanel />
      ) : (
      <ScrollArea className="min-w-0 flex-1">
        <Reorder.Group
          as="div"
          axis="y"
          values={frameOrder}
          onReorder={reorderAnimationFrames}
          className="flex w-full max-w-full min-w-0 flex-col gap-2 pr-1 overflow-hidden"
        >
          {animationTimeline.frames.map((frame, index) => {
            const isActive = frame.id === sidebarCurrentFrameId;
            const isSelected = effectiveSelectedFrameIds.includes(frame.id);
            const isEditing = frame.id === editingId;

            return (
              <FrameRow
                key={frame.id}
                frame={frame}
                index={index}
                size={canvasBounds}
                isActive={isActive}
                isSelected={isSelected}
                isEditing={isEditing}
                isCollapsed={isCollapsed}
                editingName={editingName}
                inputRef={inputRef}
                canDelete
                onSelect={(event) => selectFrame(frame.id, event)}
                onContextSelect={() => selectFrameForContextMenu(frame.id)}
                onStartRename={() => startRename(frame.id, frame.name)}
                onEditingNameChange={setEditingName}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                onDuplicate={() => duplicateSelectedFrames(frame.id)}
                onInsertAfter={() => {
                  selectFrame(frame.id);
                  insertAnimationFrame("after");
                  setSelectedFrameIds([]);
                  setSelectionAnchorFrameId(null);
                }}
                onDelete={() => removeSelectedFrames(frame.id)}
              />
            );
          })}
        </Reorder.Group>
      </ScrollArea>
      )}

      {!isCollapsed && (
        <div className="px-1 pt-2 text-[11px] font-medium text-muted-foreground">
          {Math.max(activeFrameIndex + 1, 1)} / {animationTimeline.frames.length}
        </div>
      )}
    </SidebarStandard>
  );
}
