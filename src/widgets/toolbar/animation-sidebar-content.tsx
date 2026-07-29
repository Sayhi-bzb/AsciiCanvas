"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type Announcements,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import type { AnimationCanvasSize, AnimationFrame } from "@/domains/animation/public";
import { useSidebar } from "@/shared/ui/sidebar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { AnimationEffectsPanel } from "@/widgets/animation-effects/AnimationEffectsPanel";
import { cn } from "@/shared/lib/utils";
import { BACKGROUND_COLOR } from "@/shared/lib/constants";
import { GridManager } from "@/shared/utils/grid";
import type { GridCell } from "@/shared/types";
import {
  DEFAULT_GRID_RENDER_METRICS,
  drawTextCell,
  setTextRenderStyle,
} from "@/shared/metrics";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { uiClass } from "@/shared/styles/components";
import { useUiI18n } from "@/shared/i18n";
import {
  areFrameOrdersEqual,
  getMovingFrameIds,
  moveFrameBlock,
} from "./animation-frame-reorder";

const FRAME_PREVIEW_PADDING = 5;
const sidebarIcons = HOST_ICONOLOGY.animationSidebar;

function AnimationCommandButton({
  label,
  icon: Icon,
  disabled,
  destructive = false,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          tone="subtle"
          shape="square"
          size="md"
          disabled={disabled}
          aria-label={label}
          className={cn(
            uiClass.hostIconControl,
            destructive &&
              "text-destructive hover:bg-destructive/10 hover:text-destructive"
          )}
          onClick={onClick}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function FramePreview({
  frame,
  size,
  isCurrent,
  emptyLabel,
}: {
  frame: AnimationFrame;
  size: AnimationCanvasSize | null;
  isCurrent: boolean;
  emptyLabel: string;
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
      drawTextCell(ctx, cell, x * cellWidth, y * cellHeight);
    });

    ctx.strokeStyle = isCurrent
      ? "rgba(37, 99, 235, 0.72)"
      : "rgba(15, 23, 42, 0.58)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, sourceWidth, sourceHeight);
    ctx.restore();
  }, [frameMap, isCurrent, previewSize]);

  return (
    <div
      className={cn(
        "relative h-10 w-14 shrink-0 overflow-hidden rounded-md border bg-background/80",
        isCurrent ? "border-primary/45" : "border-border/70"
      )}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {frame.grid.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/75 text-[10px] font-medium text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

type FrameRowProps = {
  frame: AnimationFrame;
  index: number;
  size: AnimationCanvasSize | null;
  isCurrent: boolean;
  isSelected: boolean;
  isPlayback: boolean;
  isEditing: boolean;
  isGroupDragging: boolean;
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
};

function SortableFrameRow({
  frame,
  index,
  size,
  isCurrent,
  isSelected,
  isPlayback,
  isEditing,
  isGroupDragging,
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
}: FrameRowProps) {
  const { t } = useUiI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: frame.id, disabled: isEditing });
  const frameLabel = t("animation.sidebar.frameNumber", { index: index + 1 });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition ?? "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
    zIndex: isDragging ? 1 : undefined,
  };
  const rowClassName = cn(
    "group/frame relative grid h-14 w-full min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-2 overflow-hidden rounded-md px-1 text-left outline-none transition-[background-color,color,opacity]",
    isCurrent
      ? "bg-accent text-foreground"
      : isSelected
        ? "bg-accent/55 text-foreground"
        : "text-foreground hover:bg-accent/45 focus-within:bg-accent/45",
    isGroupDragging && "opacity-45"
  );

  const actionItems = (
    <>
      <DropdownMenuItem onSelect={onStartRename}>
        <sidebarIcons.rename />
        {t("animation.sidebar.rename")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onDuplicate}>
        <sidebarIcons.duplicate />
        {t("animation.sidebar.duplicate")}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onInsertAfter}>
        <sidebarIcons.add />
        {t("animation.sidebar.insertAfter")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        disabled={!canDelete}
        onSelect={onDelete}
      >
        <sidebarIcons.delete />
        {t("animation.sidebar.delete")}
      </DropdownMenuItem>
    </>
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="min-w-0 list-none"
      data-testid={`animation-frame-item-${frame.id}`}
      data-dragging={isGroupDragging || undefined}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {isEditing ? (
            <div className={rowClassName}>
              {isCurrent && (
                <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
              )}
              <span aria-hidden className="size-6" />
              <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
                <FramePreview
                  frame={frame}
                  size={size}
                  isCurrent={isCurrent}
                  emptyLabel={t("animation.sidebar.empty")}
                />
                <Input
                  ref={inputRef}
                  value={editingName}
                  aria-label={t("animation.sidebar.frameName")}
                  onChange={(event) => onEditingNameChange(event.target.value)}
                  onBlur={onCommitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onCommitRename();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelRename();
                    }
                  }}
                  className="h-7 min-w-0 border-none bg-background/90 px-2 text-xs font-semibold shadow-none focus-visible:ring-1"
                />
              </div>
              <span aria-hidden className="size-8" />
            </div>
          ) : (
            <div
              data-current={isCurrent || undefined}
              data-playback={isPlayback || undefined}
              onContextMenu={onContextSelect}
              className={rowClassName}
            >
              {isCurrent && (
                <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
              )}

              <button
                type="button"
                aria-label={t("animation.sidebar.reorder", { name: frame.name })}
                title={t("animation.sidebar.reorder", { name: frame.name })}
                {...attributes}
                {...listeners}
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  uiClass.hostIconControl,
                  "size-6 touch-none cursor-grab rounded-md active:cursor-grabbing [&_svg]:size-3.5"
                )}
              >
                <sidebarIcons.reorder />
              </button>

              <button
                type="button"
                aria-current={isCurrent ? "true" : undefined}
                aria-pressed={isSelected}
                aria-label={t("animation.sidebar.selectFrame", {
                  frame: frameLabel,
                  name: frame.name,
                })}
                onClick={onSelect}
                onDoubleClick={onStartRename}
                className="grid h-full min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="relative">
                  <FramePreview
                    frame={frame}
                    size={size}
                    isCurrent={isCurrent}
                    emptyLabel={t("animation.sidebar.empty")}
                  />
                  {isPlayback && (
                    <span
                      aria-label={t("animation.sidebar.playbackFrame")}
                      className="absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
                    >
                      <sidebarIcons.playhead className="size-2.5 fill-current" />
                    </span>
                  )}
                </div>

                <span className="min-w-0 overflow-hidden">
                  <span className="block truncate text-xs font-semibold">
                    {frame.name}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {frameLabel}
                  </span>
                </span>
              </button>

              <DropdownMenu onOpenChange={(open) => open && onContextSelect()}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("animation.sidebar.frameActions", {
                      name: frame.name,
                    })}
                    className={cn(
                      uiClass.hostIconControl,
                      "opacity-0 group-hover/frame:opacity-100 group-focus-within/frame:opacity-100 data-[state=open]:bg-accent data-[state=open]:opacity-100"
                    )}
                  >
                    <sidebarIcons.more />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" align="start">
                  {actionItems}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </ContextMenuTrigger>

        <ContextMenuContent className="min-w-36">
          <ContextMenuItem onSelect={onStartRename}>
            <sidebarIcons.rename />
            {t("animation.sidebar.rename")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={onDuplicate}>
            <sidebarIcons.duplicate />
            {t("animation.sidebar.duplicate")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={onInsertAfter}>
            <sidebarIcons.add />
            {t("animation.sidebar.insertAfter")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            disabled={!canDelete}
            onSelect={onDelete}
          >
            <sidebarIcons.delete />
            {t("animation.sidebar.delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
}

function AnimationFrameList({
  frames,
  selectedFrameIds,
  onReorder,
  children,
}: {
  frames: AnimationFrame[];
  selectedFrameIds: string[];
  onReorder: (frameIds: string[]) => void;
  children: (
    frame: AnimationFrame,
    index: number,
    isGroupDragging: boolean
  ) => React.ReactNode;
}) {
  const { t } = useUiI18n();
  const frameOrder = useMemo(() => frames.map((frame) => frame.id), [frames]);
  const frameMap = useMemo(
    () => new Map(frames.map((frame) => [frame.id, frame] as const)),
    [frames]
  );
  const [draftOrder, setDraftOrder] = useState(frameOrder);
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [movingFrameIds, setMovingFrameIds] = useState<string[]>([]);
  const sourceOrderRef = useRef(frameOrder);
  const movingFrameIdsRef = useRef<string[]>([]);
  const draftOrderRef = useRef(frameOrder);
  const hasValidDropRef = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const detectFrameCollision: CollisionDetection = (args) => {
    const stationaryContainers = args.droppableContainers.filter(
      (container) =>
        !movingFrameIdsRef.current.includes(String(container.id))
    );
    const scopedArgs = {
      ...args,
      droppableContainers: stationaryContainers,
    };
    const pointerCollisions = pointerWithin(scopedArgs);
    return pointerCollisions.length > 0
      ? pointerCollisions
      : closestCenter(scopedArgs);
  };
  const handleDragStart = ({ active }: DragStartEvent) => {
    const activeId = String(active.id);
    const nextMovingFrameIds = getMovingFrameIds(
      frameOrder,
      selectedFrameIds,
      activeId
    );
    sourceOrderRef.current = frameOrder;
    movingFrameIdsRef.current = nextMovingFrameIds;
    setDraftOrder(frameOrder);
    draftOrderRef.current = frameOrder;
    hasValidDropRef.current = false;
    setMovingFrameIds(nextMovingFrameIds);
    setActiveFrameId(activeId);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const overId = String(over.id);
    if (movingFrameIdsRef.current.includes(overId)) return;
    const nextOrder = moveFrameBlock(
      sourceOrderRef.current,
      movingFrameIdsRef.current,
      String(active.id),
      overId
    );
    hasValidDropRef.current = true;
    draftOrderRef.current = nextOrder;
    setDraftOrder(nextOrder);
  };

  const finishDrag = (nextOrder: string[]) => {
    setDraftOrder(nextOrder);
    setActiveFrameId(null);
    draftOrderRef.current = nextOrder;
    setMovingFrameIds([]);
    movingFrameIdsRef.current = [];
    hasValidDropRef.current = false;
  };

  const handleDragEnd = () => {
    const sourceOrder = sourceOrderRef.current;
    const nextOrder = hasValidDropRef.current
      ? draftOrderRef.current
      : sourceOrder;
    finishDrag(nextOrder);
    if (!areFrameOrdersEqual(sourceOrder, nextOrder)) onReorder(nextOrder);
  };

  const handleDragCancel = () => {
    finishDrag(sourceOrderRef.current);
  };

  const activeFrame = activeFrameId ? frameMap.get(activeFrameId) : undefined;
  const renderOrder = activeFrameId ? draftOrder : frameOrder;
  const orderedFrames = renderOrder
    .map((frameId) => frameMap.get(frameId))
    .filter((frame): frame is AnimationFrame => !!frame);
  const movingIds = new Set(movingFrameIds);
  const announceFramePosition = (
    key:
      | "animation.sidebar.reorderPickedUp"
      | "animation.sidebar.reorderMoved"
      | "animation.sidebar.reorderDropped",
    frameId: string,
    order: string[]
  ) =>
    t(key, {
      name: frameMap.get(frameId)?.name ?? frameId,
      position: Math.max(order.indexOf(frameId) + 1, 1),
      count: order.length,
    });
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      announceFramePosition(
        "animation.sidebar.reorderPickedUp",
        String(active.id),
        sourceOrderRef.current
      ),
    onDragOver: ({ active, over }) =>
      over
        ? announceFramePosition(
            "animation.sidebar.reorderMoved",
            String(active.id),
            draftOrderRef.current
          )
        : undefined,
    onDragEnd: ({ active }) =>
      announceFramePosition(
        "animation.sidebar.reorderDropped",
        String(active.id),
        draftOrderRef.current
      ),
    onDragCancel: ({ active }) =>
      t("animation.sidebar.reorderCancelled", {
        name: frameMap.get(String(active.id))?.name ?? String(active.id),
      }),
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: t("animation.sidebar.reorderInstructions"),
        },
      }}
      collisionDetection={detectFrameCollision}
      autoScroll={{
        acceleration: 10,
        threshold: { x: 0.2, y: 0.15 },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <SortableContext
          items={renderOrder}
          strategy={verticalListSortingStrategy}
        >
          <ul
            aria-label={t("animation.sidebar.frameList")}
            className="flex w-full max-w-full min-w-0 flex-col gap-1 p-1"
          >
            {orderedFrames.map((frame, index) =>
              children(frame, index, movingIds.has(frame.id))
            )}
          </ul>
        </SortableContext>
      </ScrollArea>

      <DragOverlay>
        {activeFrame ? (
          <div
            data-testid="animation-frame-drag-overlay"
            className="flex h-12 w-52 items-center gap-2 rounded-md border border-primary/35 bg-popover px-2 text-popover-foreground shadow-lg"
          >
            <sidebarIcons.reorder className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">
              {activeFrame.name}
            </span>
            {movingFrameIds.length > 1 && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {movingFrameIds.length}
              </span>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function AnimationSidebarContent() {
  const { t } = useUiI18n();
  const {
    canvasMode,
    canvasBounds,
    animationTimeline,
    animationIsPlaying,
    animationPlaybackFrameId,
    setAnimationCurrentFrame,
    insertAnimationFrame,
    renameAnimationFrame,
    duplicateAnimationFrames,
    removeAnimationFrames,
    reorderAnimationFrames,
  } = useEditorStore(
    useShallow((state) => ({
      canvasMode: state.canvasMode,
      canvasBounds: state.canvasBounds,
      animationTimeline: state.animationTimeline,
      animationIsPlaying: state.animationIsPlaying,
      animationPlaybackFrameId: state.animationPlaybackFrameId,
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

  if (canvasMode !== "animation" || !animationTimeline || isCollapsed) {
    return null;
  }

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

  const commandTargetFrameId =
    effectiveSelectedFrameIds[0] ?? animationTimeline.currentFrameId;
  const renameTarget =
    effectiveSelectedFrameIds.length === 1
      ? animationTimeline.frames.find(
          (frame) => frame.id === effectiveSelectedFrameIds[0]
        )
      : undefined;
  const canDeleteSelection =
    effectiveSelectedFrameIds.length > 0 &&
    effectiveSelectedFrameIds.length < animationTimeline.frames.length;
  const selectionStatus =
    effectiveSelectedFrameIds.length > 1
      ? t("animation.sidebar.selectedCount", {
          count: effectiveSelectedFrameIds.length,
        })
      : t("animation.sidebar.frameCount", {
          count: animationTimeline.frames.length,
        });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        role="tablist"
        aria-label={t("animation.sidebar.views")}
        className="grid shrink-0 grid-cols-2 gap-1 border-b border-accent p-[3px]"
      >
        {(["frames", "effects"] as const).map((mode) => {
          const Icon = sidebarIcons[mode];
          const selected = panelMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setPanelMode(mode)}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors outline-none",
                uiClass.hostControl,
                selected && uiClass.hostControlActive
              )}
            >
              <Icon className="size-4" />
              {t(`animation.sidebar.${mode}`)}
            </button>
          );
        })}
      </div>

      {panelMode === "effects" ? (
        <div
          role="tabpanel"
          aria-label={t("animation.sidebar.effects")}
          className="flex min-h-0 flex-1 p-2"
        >
          <AnimationEffectsPanel />
        </div>
      ) : (
        <div
          role="tabpanel"
          aria-label={t("animation.sidebar.frames")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div
            data-testid="animation-frame-command-bar"
            className="flex h-10 shrink-0 items-center justify-between border-b border-accent px-2"
          >
            <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
              {selectionStatus}
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              <AnimationCommandButton
                label={t("animation.sidebar.addAfter")}
                icon={sidebarIcons.add}
                onClick={() => {
                  insertAnimationFrame("after");
                  setSelectedFrameIds([]);
                  setSelectionAnchorFrameId(null);
                }}
              />
              <AnimationCommandButton
                label={t("animation.sidebar.duplicate")}
                icon={sidebarIcons.duplicate}
                disabled={!commandTargetFrameId}
                onClick={() => {
                  if (commandTargetFrameId) {
                    duplicateSelectedFrames(commandTargetFrameId);
                  }
                }}
              />
              <AnimationCommandButton
                label={t("animation.sidebar.rename")}
                icon={sidebarIcons.rename}
                disabled={!renameTarget}
                onClick={() => {
                  if (renameTarget) {
                    startRename(renameTarget.id, renameTarget.name);
                  }
                }}
              />
              <AnimationCommandButton
                label={t("animation.sidebar.delete")}
                icon={sidebarIcons.delete}
                destructive
                disabled={!canDeleteSelection || !commandTargetFrameId}
                onClick={() => {
                  if (commandTargetFrameId) {
                    removeSelectedFrames(commandTargetFrameId);
                  }
                }}
              />
            </div>
          </div>

          <AnimationFrameList
            frames={animationTimeline.frames}
            selectedFrameIds={effectiveSelectedFrameIds}
            onReorder={reorderAnimationFrames}
          >
            {(frame, index, isGroupDragging) => {
              const isCurrent = frame.id === sidebarCurrentFrameId;
              const isSelected = effectiveSelectedFrameIds.includes(frame.id);
              const isEditing = frame.id === editingId;
              const actionFrameCount = getActionFrameIds(frame.id).length;

              return (
                <SortableFrameRow
                  key={frame.id}
                  frame={frame}
                  index={index}
                  size={canvasBounds}
                  isCurrent={isCurrent}
                  isSelected={isSelected}
                  isPlayback={frame.id === animationPlaybackFrameId}
                  isEditing={isEditing}
                  isGroupDragging={isGroupDragging}
                  editingName={editingName}
                  inputRef={inputRef}
                  canDelete={actionFrameCount < animationTimeline.frames.length}
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
            }}
          </AnimationFrameList>
        </div>
      )}
    </div>
  );
}
