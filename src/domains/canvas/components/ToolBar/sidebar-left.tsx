"use client";

import { Clapperboard, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { SidebarStandard, useSidebar } from "@/shared/ui/sidebar";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/lib/utils";
import type { AnimationCanvasSize, AnimationFrame, GridCell } from "@/shared/types";
import {
  BACKGROUND_COLOR,
  CELL_HEIGHT,
  CELL_WIDTH,
  FONT_SIZE,
} from "@/shared/lib/constants";
import { GridManager } from "@/shared/utils/grid";
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

    const sourceWidth = Math.max(previewSize.width, 1) * CELL_WIDTH;
    const sourceHeight = Math.max(previewSize.height, 1) * CELL_HEIGHT;
    const scale = Math.min(
      (displayWidth - FRAME_PREVIEW_PADDING * 2) / sourceWidth,
      (displayHeight - FRAME_PREVIEW_PADDING * 2) / sourceHeight
    );
    const offsetX = (displayWidth - sourceWidth * scale) / 2;
    const offsetY = (displayHeight - sourceHeight * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.font = `${FONT_SIZE}px 'Maple Mono NF CN', monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    frameMap.forEach((cell, key) => {
      const [x, y] = key.split(",").map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const drawX = x * CELL_WIDTH;
      const drawY = y * CELL_HEIGHT;
      const wide = GridManager.isWideChar(cell.char);

      ctx.fillStyle = cell.color;
      ctx.fillText(
        cell.char,
        drawX + (wide ? CELL_WIDTH : CELL_WIDTH / 2),
        drawY + CELL_HEIGHT / 2
      );
    });

    ctx.strokeStyle = isActive ? "rgba(37, 99, 235, 0.7)" : "rgba(15, 23, 42, 0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, sourceWidth, sourceHeight);
    ctx.restore();
  }, [frameMap, isActive, previewSize]);

  return (
    <div
      className={cn(
        "h-11 w-16 shrink-0 overflow-hidden rounded-lg border bg-background/80",
        isActive ? "border-primary/40" : "border-border/70"
      )}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
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
    duplicateAnimationFrame,
    removeAnimationFrame,
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
      duplicateAnimationFrame: state.duplicateAnimationFrame,
      removeAnimationFrame: state.removeAnimationFrame,
      reorderAnimationFrames: state.reorderAnimationFrames,
    }))
  );
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pinnedFrameId, setPinnedFrameId] = useState<string | null>(null);

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

  if (canvasMode !== "animation" || !animationTimeline) {
    return null;
  }

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
            aria-label="Add frame"
            title="Add frame"
          >
            <Plus className="size-4" />
            {!isCollapsed && <span>Add Frame</span>}
          </Button>
        </div>
      }
    >
      <ScrollArea className="min-w-0 flex-1">
        <Reorder.Group
          as="div"
          axis="y"
          values={frameOrder}
          onReorder={reorderAnimationFrames}
          className="flex w-full max-w-full min-w-0 flex-col gap-1.5 pr-1 overflow-hidden"
        >
          {animationTimeline.frames.map((frame) => {
            const isActive = frame.id === sidebarCurrentFrameId;
            const canDelete = animationTimeline.frames.length > 1;
            const isEditing = frame.id === editingId;
            const frameRowClassName = cn(
              "relative flex w-full min-w-0 items-center rounded-xl px-2.5 py-2 text-left transition-colors outline-none overflow-hidden",
              isActive
                ? "bg-primary/12 text-primary"
                : "text-foreground hover:bg-accent/45"
            );

            return (
              <Reorder.Item
                key={frame.id}
                value={frame.id}
                className="min-w-0 list-none"
                dragListener={!isEditing}
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    {isEditing ? (
                      <div className={frameRowClassName}>
                        <Input
                          ref={inputRef}
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onBlur={commitRename}
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitRename();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          className="h-8 border-none bg-background/90 px-2 text-sm font-semibold shadow-none focus-visible:ring-1"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPinnedFrameId(frame.id);
                          setAnimationCurrentFrame(frame.id);
                        }}
                        onDoubleClick={() => startRename(frame.id, frame.name)}
                        className={cn(
                          frameRowClassName,
                          "cursor-grab active:cursor-grabbing"
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                          <FramePreview
                            frame={frame}
                            size={canvasBounds}
                            isActive={isActive}
                          />
                          {!isCollapsed && (
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-semibold">
                                {frame.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    )}
                  </ContextMenuTrigger>
                  <ContextMenuContent className="min-w-36">
                    <ContextMenuItem onClick={() => startRename(frame.id, frame.name)}>
                      <Pencil className="size-4" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => duplicateAnimationFrame(frame.id)}>
                      <Copy className="size-4" />
                      Duplicate
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      disabled={!canDelete}
                      onClick={() => removeAnimationFrame(frame.id)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </ScrollArea>

      {!isCollapsed && (
        <div className="px-1 pt-2 text-[11px] font-medium text-muted-foreground">
          {Math.max(activeFrameIndex + 1, 1)} / {animationTimeline.frames.length}
        </div>
      )}
    </SidebarStandard>
  );
}
