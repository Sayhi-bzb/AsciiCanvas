"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Clapperboard, Code2, Pencil, Plus, X } from "lucide-react";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/shared/lib/utils";
import { uiClass } from "@/shared/styles/components";
import { Button } from "@/shared/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const ANIMATION_SIZE_PRESETS = [
  { label: "Classic Terminal", width: 80, height: 25 },
  { label: "Square 64", width: 64, height: 64 },
  { label: "Poster 128", width: 128, height: 128 },
];

export function SessionTabs() {
  const {
    canvasSessions,
    activeCanvasId,
    createCanvasSession,
    switchCanvasSession,
    removeCanvasSession,
    renameCanvasSession,
  } = useCanvasStore(
    useShallow((state) => ({
      canvasSessions: state.canvasSessions,
      activeCanvasId: state.activeCanvasId,
      createCanvasSession: state.createCanvasSession,
      switchCanvasSession: state.switchCanvasSession,
      removeCanvasSession: state.removeCanvasSession,
      renameCanvasSession: state.renameCanvasSession,
    }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [animationDialogOpen, setAnimationDialogOpen] = useState(false);
  const [animationWidth, setAnimationWidth] = useState("80");
  const [animationHeight, setAnimationHeight] = useState("25");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  const canRemove = canvasSessions.length > 1;

  useEffect(() => {
    if (!editingId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingId]);

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const commitRename = () => {
    if (!editingId) return;
    renameCanvasSession(editingId, editingName);
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  const pendingDeleteSession = pendingDeleteId
    ? canvasSessions.find((session) => session.id === pendingDeleteId) || null
    : null;
  const createOptions = [
    { mode: "freeform" as const, label: "New Freeform", icon: Pencil },
    { mode: "animation" as const, label: "New Animation", icon: Clapperboard },
    { mode: "generated-animation" as const, label: "New Generated", icon: Code2 },
  ];

  const commitAnimationCreation = () => {
    const width = Number.parseInt(animationWidth, 10);
    const height = Number.parseInt(animationHeight, 10);
    createCanvasSession("animation", {
      size: {
        width: Number.isFinite(width) ? width : 80,
        height: Number.isFinite(height) ? height : 25,
      },
    });
    setAnimationDialogOpen(false);
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
      <div className={uiClass.sessionShell}>
        <div className="flex items-center gap-1 max-w-[min(85vw,760px)] md:max-w-[min(72vw,760px)] overflow-x-auto pr-1 scrollbar-hide">
          {canvasSessions.map((session) => {
            const isActive = session.id === activeCanvasId;
            const ModeIcon =
              session.mode === "structured"
                ? Box
                : session.mode === "animation"
                ? Clapperboard
                : Pencil;
            const modeLabel =
              session.mode === "structured"
                ? "Structured"
                : session.mode === "animation"
                ? "Animation"
                : "Freeform";
            return (
              <div
                key={session.id}
                className={cn(
                  "group flex items-center rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/12"
                    : "bg-transparent hover:bg-accent/60"
                )}
              >
                {editingId === session.id ? (
                  <input
                    ref={inputRef}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitRename();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                    className="mx-1 h-6 w-28 rounded border border-primary bg-background px-1.5 text-xs text-foreground outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => switchCanvasSession(session.id)}
                    onDoubleClick={() => startRename(session.id, session.name)}
                    className={cn(
                      "h-8 text-xs font-medium whitespace-nowrap outline-none flex items-center gap-1.5",
                      isActive ? "text-primary" : "text-foreground",
                      isMobile ? "px-2 max-w-20" : "px-3 max-w-44"
                    )}
                    title={`${session.name} (${modeLabel})`}
                  >
                    <ModeIcon
                      className={cn(
                        "size-3.5 shrink-0",
                        isActive ? "text-primary/80" : "text-muted-foreground"
                      )}
                    />
                    <span className={cn("truncate", isMobile && "max-w-[60px]")}>{session.name}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingDeleteId(session.id);
                  }}
                  disabled={!canRemove}
                  className={cn(
                    "h-8 w-7 flex items-center justify-center rounded-r-lg transition-colors",
                    canRemove
                      ? "text-muted-foreground hover:text-destructive"
                      : "text-muted-foreground/40 cursor-not-allowed"
                  )}
                  aria-label={`Close ${session.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <Popover open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              tone="subtle"
              shape="square"
              size="sm"
              className="size-8 shrink-0"
              aria-label="Create new canvas"
            >
              <Plus className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={8}
            className={cn(uiClass.submenuPanel, "w-44 p-1")}
          >
            {createOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => {
                    if (option.mode === "animation") {
                      setAnimationDialogOpen(true);
                    } else if (option.mode === "generated-animation") {
                      createCanvasSession("animation", {
                        size: { width: 80, height: 25 },
                      });
                    } else {
                      createCanvasSession(option.mode);
                    }
                    setCreateMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 h-9 px-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={animationDialogOpen} onOpenChange={setAnimationDialogOpen}>
        <DialogContent className="max-w-md overflow-hidden border-none p-0 shadow-2xl">
          <div className="border-b bg-muted/30 px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Clapperboard className="size-4 text-primary" />
                Create Animation Session
              </DialogTitle>
              <DialogDescription className="text-xs">
                Fixed bounds, onion-skin playback, and frame-based editing in the
                same workspace language as the rest of the app.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 bg-background px-5 py-5">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Presets
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ANIMATION_SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setAnimationWidth(String(preset.width));
                      setAnimationHeight(String(preset.height));
                    }}
                    className="rounded-xl border border-border bg-muted/25 px-3 py-3 text-left transition-colors hover:bg-accent/45"
                  >
                    <div className="text-[11px] font-semibold text-foreground">
                      {preset.width} x {preset.height}
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      {preset.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="animation-width">Width</Label>
                <Input
                  id="animation-width"
                  inputMode="numeric"
                  value={animationWidth}
                  onChange={(event) => setAnimationWidth(event.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="animation-height">Height</Label>
                <Input
                  id="animation-height"
                  inputMode="numeric"
                  value={animationHeight}
                  onChange={(event) => setAnimationHeight(event.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Startup Defaults
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/80 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Playback
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">10 FPS</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Loop enabled by default.
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/80 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Onion Skin
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    2 back / 2 forward
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Fade profile: 0.5, 0.3, 0.1
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                tone="neutral"
                onClick={() => setAnimationDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={commitAnimationCreation}>Create Animation</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDeleteSession}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete This Canvas?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteSession
                ? `Canvas "${pendingDeleteSession.name}" will be closed and removed from this session.`
                : "This canvas will be removed from this session."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDeleteSession) return;
                removeCanvasSession(pendingDeleteSession.id);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
