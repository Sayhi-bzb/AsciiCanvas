"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Box, Clapperboard, Pencil, Plus, X } from "lucide-react";
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
import { useUiI18n, type I18nKey } from "@/shared/i18n";

const ANIMATION_SIZE_PRESETS = [
  { labelKey: "session.animation.preset.classicTerminal", width: 80, height: 25 },
  { labelKey: "session.animation.preset.square64", width: 64, height: 64 },
  { labelKey: "session.animation.preset.poster128", width: 128, height: 128 },
] satisfies Array<{
  labelKey: I18nKey;
  width: number;
  height: number;
}>;

const getModeLabelKey = (mode: "freeform" | "structured" | "animation") => {
  switch (mode) {
    case "structured":
      return "session.mode.structured";
    case "animation":
      return "session.mode.animation";
    case "freeform":
      return "session.mode.freeform";
  }
};

const getModeIcon = (mode: "freeform" | "structured" | "animation" | undefined) => {
  switch (mode) {
    case "structured":
      return Box;
    case "animation":
      return Clapperboard;
    default:
      return Pencil;
  }
};

const createOptionMeta = [
  { mode: "freeform" as const, labelKey: "session.newFreeform", icon: Pencil },
  { mode: "structured" as const, labelKey: "session.newStructured", icon: Box },
  { mode: "animation" as const, labelKey: "session.newAnimation", icon: Clapperboard },
] satisfies Array<{
  mode: "freeform" | "structured" | "animation";
  labelKey: I18nKey;
  icon: typeof Pencil;
}>;

export function SessionTabs() {
  const { t } = useUiI18n();
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
  const shellRef = useRef<HTMLDivElement | null>(null);
  const collapseTimerRef = useRef<number | null>(null);
  const isPinnedOpenRef = useRef(false);
  const isMobile = useIsMobile();

  const canRemove = canvasSessions.length > 1;
  const activeSession =
    canvasSessions.find((session) => session.id === activeCanvasId) ??
    canvasSessions[0];
  const pendingDeleteSession = pendingDeleteId
    ? canvasSessions.find((session) => session.id === pendingDeleteId) || null
    : null;
  const isPinnedOpen =
    !!editingId || !!pendingDeleteSession || createMenuOpen || animationDialogOpen;
  const [isExpanded, setIsExpanded] = useState(false);
  const showExpandedTabs = isExpanded || isPinnedOpen;
  const activeNameLength = Math.min(
    Array.from(activeSession?.name ?? t("session.fallbackName")).length,
    28
  );
  const collapsedSessionTabsWidth = isMobile
    ? `clamp(8rem, calc(${activeNameLength}ch + 4.25rem), 11rem)`
    : `clamp(9rem, calc(${activeNameLength}ch + 4.75rem), 14rem)`;
  const expandedNameLength = canvasSessions.reduce(
    (total, session) => total + Math.min(Array.from(session.name).length, isMobile ? 10 : 16),
    0
  );
  const expandedChromeWidthRem =
    canvasSessions.length * (isMobile ? 4.75 : 5.25) + 2.75;
  const expandedSessionTabsWidth = isMobile
    ? `clamp(13rem, calc(${expandedNameLength}ch + ${expandedChromeWidthRem}rem), min(96vw, 820px))`
    : `clamp(14rem, calc(${expandedNameLength}ch + ${expandedChromeWidthRem}rem), min(92vw, 820px))`;
  const sessionTabsWidth = showExpandedTabs
    ? expandedSessionTabsWidth
    : collapsedSessionTabsWidth;
  const sessionTabsStyle = {
    "--session-tabs-width": sessionTabsWidth,
    width: "var(--session-tabs-width)",
  } as CSSProperties;

  const clearCollapseTimer = () => {
    if (collapseTimerRef.current === null) return;
    window.clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = null;
  };

  const expandTabs = () => {
    clearCollapseTimer();
    setIsExpanded(true);
  };

  const collapseTabsSoon = () => {
    clearCollapseTimer();
    if (isPinnedOpen) return;
    collapseTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      collapseTimerRef.current = null;
    }, 500);
  };

  const expandTabsTemporarily = () => {
    clearCollapseTimer();
    setIsExpanded(true);
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null;
      if (isPinnedOpenRef.current) return;
      setIsExpanded(false);
    }, 1600);
  };

  useEffect(() => {
    if (!editingId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingId]);

  useEffect(() => {
    isPinnedOpenRef.current = isPinnedOpen;
  }, [isPinnedOpen]);

  useEffect(() => () => clearCollapseTimer(), []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const handleShellWheel = (event: WheelEvent) => {
      event.stopPropagation();

      const target = event.target;
      const tabScroller =
        target instanceof Element
          ? target.closest<HTMLElement>('[data-session-tabs-scroll="true"]')
          : null;

      if (showExpandedTabs && tabScroller) {
        const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
        if (delta !== 0) {
          event.preventDefault();
          tabScroller.scrollLeft += delta;
          return;
        }
      }

      event.preventDefault();
    };

    shell.addEventListener("wheel", handleShellWheel, {
      capture: true,
      passive: false,
    });
    return () => {
      shell.removeEventListener("wheel", handleShellWheel, {
        capture: true,
      });
    };
  }, [showExpandedTabs]);

  const startRename = (id: string, name: string) => {
    expandTabs();
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
    expandTabsTemporarily();
  };

  const switchSession = (id: string) => {
    switchCanvasSession(id);
    expandTabsTemporarily();
  };

  const createSession = (mode: "freeform" | "structured") => {
    createCanvasSession(mode);
    expandTabsTemporarily();
  };

  const ModeIcon = getModeIcon(activeSession?.mode);
  const modeLabel = activeSession
    ? t(getModeLabelKey(activeSession.mode))
    : t("session.fallbackName");

  return (
    <div
      className={cn(
        "fixed left-1/2 top-3 z-[70] -translate-x-1/2 pointer-events-none transition-[width,top] duration-200 ease-out",
        isMobile && "top-2"
      )}
      style={sessionTabsStyle}
      data-canvas-ui="true"
    >
      <div
        ref={shellRef}
        onPointerEnter={expandTabs}
        onPointerLeave={collapseTabsSoon}
        onFocusCapture={expandTabs}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          collapseTabsSoon();
        }}
        className={cn(
          uiClass.sessionShell,
          "h-9 min-w-0 overflow-hidden rounded-xl !p-1 transition-[background-color,border-color,padding] duration-200 ease-out",
          showExpandedTabs
            ? "w-full border-border/70 bg-background/82 shadow-sm shadow-black/5"
            : "w-full border-border/45 bg-background/55 shadow-none"
        )}
      >
        <div className="relative h-7 min-w-0 flex-1 overflow-hidden">
          <button
            type="button"
            onClick={expandTabs}
            className={cn(
              "absolute inset-0 flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 text-xs font-medium text-foreground/82 outline-none transition-[opacity,transform,background-color] duration-150 ease-out hover:bg-accent/35",
              showExpandedTabs
                ? "pointer-events-none -translate-y-1 opacity-0"
                : "translate-y-0 opacity-100"
            )}
            title={activeSession ? `${activeSession.name} (${modeLabel})` : t("session.fallbackName")}
            aria-label={t("session.expand")}
            aria-hidden={showExpandedTabs}
            tabIndex={showExpandedTabs ? -1 : 0}
          >
            <ModeIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {activeSession?.name ?? t("session.fallbackName")}
            </span>
          </button>

          <div
            data-session-tabs-scroll="true"
            className={cn(
              "absolute inset-0 flex min-w-0 items-center gap-1 overflow-x-auto pr-0.5 scrollbar-hide transition-[opacity,transform] duration-150 ease-out",
              showExpandedTabs
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-1 opacity-0"
            )}
            aria-hidden={!showExpandedTabs}
          >
            {canvasSessions.map((session) => {
              const isActive = session.id === activeCanvasId;
              const SessionModeIcon = getModeIcon(session.mode);
              const sessionModeLabel = t(getModeLabelKey(session.mode));
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group/tab flex shrink-0 items-center rounded-lg border transition-colors",
                    isActive
                      ? "border-primary/25 bg-primary/10"
                      : "border-transparent bg-transparent hover:bg-accent/55"
                  )}
                >
                  {editingId === session.id ? (
                    <input
                      ref={inputRef}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onBlur={commitRename}
                      tabIndex={showExpandedTabs ? 0 : -1}
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
                      onClick={() => switchSession(session.id)}
                      onDoubleClick={() => startRename(session.id, session.name)}
                      tabIndex={showExpandedTabs ? 0 : -1}
                      className={cn(
                        "h-7 min-w-0 text-xs font-medium whitespace-nowrap outline-none flex items-center gap-1.5",
                        isActive ? "text-primary" : "text-foreground/88",
                        isMobile ? "px-2 max-w-24" : "px-2 max-w-36"
                      )}
                      title={`${session.name} (${sessionModeLabel})`}
                    >
                      <SessionModeIcon
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
                      expandTabs();
                      setPendingDeleteId(session.id);
                    }}
                    disabled={!canRemove}
                    tabIndex={showExpandedTabs ? 0 : -1}
                    className={cn(
                      "h-7 w-6 flex shrink-0 items-center justify-center rounded-r-lg transition-colors",
                      canRemove
                        ? "text-muted-foreground/55 opacity-65 hover:text-destructive hover:opacity-100 group-hover/tab:opacity-100 group-focus-within/tab:opacity-100"
                        : "text-muted-foreground/40 cursor-not-allowed"
                    )}
                    aria-label={t("session.close", { name: session.name })}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <Popover open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              tone="subtle"
              shape="square"
              size="sm"
              className={cn(
                "shrink-0 transition-[width,height,background-color] duration-150 ease-out",
                showExpandedTabs ? "size-7" : "size-7 bg-transparent"
              )}
              aria-label={t("session.createNew")}
              onClick={expandTabs}
            >
              <Plus className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={8}
            className={cn(uiClass.submenuPanel, "w-44 p-1")}
          >
            {createOptionMeta.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => {
                    if (option.mode === "animation") {
                      setAnimationDialogOpen(true);
                    } else {
                      createSession(option.mode);
                    }
                    setCreateMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 h-9 px-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="text-sm font-medium">{t(option.labelKey)}</span>
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
                {t("session.animation.title")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("session.animation.description")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 bg-background px-5 py-5">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t("session.animation.presets")}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ANIMATION_SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.labelKey}
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
                      {t(preset.labelKey)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="animation-width">{t("session.animation.width")}</Label>
                <Input
                  id="animation-width"
                  inputMode="numeric"
                  value={animationWidth}
                  onChange={(event) => setAnimationWidth(event.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="animation-height">{t("session.animation.height")}</Label>
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
                {t("session.animation.startupDefaults")}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/80 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("session.animation.playback")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">10 FPS</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("session.animation.loopEnabled")}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/80 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("session.animation.onionSkin")}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    2 back / 2 forward
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("session.animation.fadeProfile")}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                tone="neutral"
                onClick={() => setAnimationDialogOpen(false)}
              >
                {t("dialog.cancel")}
              </Button>
              <Button onClick={commitAnimationCreation}>
                {t("session.animation.create")}
              </Button>
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
            <AlertDialogTitle>{t("session.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteSession
                ? t("session.delete.description", { name: pendingDeleteSession.name })
                : t("session.delete.fallbackDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDeleteSession) return;
                removeCanvasSession(pendingDeleteSession.id);
                setPendingDeleteId(null);
              }}
            >
              {t("session.delete.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
