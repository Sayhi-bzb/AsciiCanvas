"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Plus, X } from "lucide-react";
import { useEditorStore } from "@/domains/canvas/public";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/shared/lib/utils";
import { uiClass } from "@/shared/styles/components";
import { Button } from "@/shared/ui/button";
import { useIsMobile } from "@/shared/hooks/use-mobile";
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
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";

const AnimationModeIcon = HOST_ICONOLOGY.canvasMode.animation;

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

function SessionModeIcon({
  mode,
  className,
}: {
  mode: "freeform" | "structured" | "animation" | undefined;
  className?: string;
}) {
  const Icon = HOST_ICONOLOGY.canvasMode[mode ?? "freeform"];
  return <Icon className={className} />;
}

const createOptionMeta = [
  {
    mode: "freeform" as const,
    labelKey: "session.newFreeform",
    icon: HOST_ICONOLOGY.canvasMode.freeform,
  },
  {
    mode: "structured" as const,
    labelKey: "session.newStructured",
    icon: HOST_ICONOLOGY.canvasMode.structured,
  },
  {
    mode: "animation" as const,
    labelKey: "session.newAnimation",
    icon: HOST_ICONOLOGY.canvasMode.animation,
  },
] satisfies Array<{
  mode: "freeform" | "structured" | "animation";
  labelKey: I18nKey;
  icon: (typeof HOST_ICONOLOGY.canvasMode)[keyof typeof HOST_ICONOLOGY.canvasMode];
}>;

export function SessionTabs({
  leftInset,
  rightInset,
}: {
  leftInset?: string;
  rightInset?: string;
}) {
  const { t } = useUiI18n();
  const {
    canvasSessions,
    activeCanvasId,
    createCanvasSession,
    switchCanvasSession,
    removeCanvasSession,
    renameCanvasSession,
  } = useEditorStore(
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
    ? `clamp(13rem, calc(${expandedNameLength}ch + ${expandedChromeWidthRem}rem), 820px)`
    : `clamp(14rem, calc(${expandedNameLength}ch + ${expandedChromeWidthRem}rem), 820px)`;
  const sessionTabsWidth = showExpandedTabs
    ? expandedSessionTabsWidth
    : collapsedSessionTabsWidth;
  const sessionTabsStyle = {
    "--session-tabs-width": sessionTabsWidth,
    width: "min(var(--session-tabs-width), 100%)",
    maxWidth: "100%",
  } as CSSProperties;
  const sessionTabsLaneStyle = {
    left: leftInset ?? (isMobile ? "3.75rem" : "4rem"),
    right: rightInset ?? (isMobile ? "0.5rem" : "4rem"),
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

  return (
    <div
      className={cn(
        "fixed top-3 z-[70] flex justify-center pointer-events-none transition-[left,right,top] duration-200 ease-out",
        isMobile && "top-2"
      )}
      style={sessionTabsLaneStyle}
      data-canvas-ui="true"
      data-session-tabs-lane="true"
    >
      <Tabs
        ref={shellRef}
        value={activeCanvasId}
        onValueChange={switchSession}
        style={sessionTabsStyle}
        data-session-tabs-shell="true"
        onPointerEnter={expandTabs}
        onPointerLeave={collapseTabsSoon}
        onFocusCapture={expandTabs}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          collapseTabsSoon();
        }}
        className="pointer-events-auto min-w-0 overflow-hidden transition-[width] duration-200 ease-out"
      >
        <div className="flex min-w-0 items-center">
          <div
            data-session-tabs-scroll="true"
            className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <TabsList variant="default">
              {(showExpandedTabs
                ? canvasSessions
                : activeSession
                  ? [activeSession]
                  : []
              ).map((session) => {
                const isActive = session.id === activeCanvasId;
                const sessionModeLabel = t(getModeLabelKey(session.mode));
                return (
                  <div
                    key={session.id}
                    data-session-tab-item={session.id}
                    className={cn(
                      "group/session flex shrink-0 items-center rounded-md transition-colors has-[[data-session-close]:hover]:bg-accent",
                      isActive && "bg-accent"
                    )}
                  >
                    {editingId === session.id ? (
                      <Input
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
                        className="h-7 w-28"
                      />
                    ) : (
                      <TabsTrigger
                        value={session.id}
                        className={cn(
                          uiClass.hostControl,
                          "group-has-[[data-session-close]:hover]/session:text-foreground"
                        )}
                        onClick={showExpandedTabs ? undefined : expandTabs}
                        onDoubleClick={() =>
                          startRename(session.id, session.name)
                        }
                        title={`${session.name} (${sessionModeLabel})`}
                        aria-label={
                          showExpandedTabs ? undefined : t("session.expand")
                        }
                      >
                      <SessionModeIcon
                        mode={session.mode}
                          className="size-3.5"
                      />
                        <span
                          className={cn(
                            "truncate",
                            isMobile ? "max-w-[60px]" : "max-w-32"
                          )}
                        >
                          {session.name}
                        </span>
                      </TabsTrigger>
                    )}

                    {showExpandedTabs && (
                      <Button
                        data-session-close="true"
                        tone="subtle"
                        shape="square"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          expandTabs();
                          setPendingDeleteId(session.id);
                        }}
                        disabled={!canRemove}
                        className="size-7 shrink-0"
                        aria-label={t("session.close", {
                          name: session.name,
                        })}
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
              <Popover open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    tone="subtle"
                    shape="square"
                    size="sm"
                    className="size-7 shrink-0"
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
                        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="font-medium">{t(option.labelKey)}</span>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </TabsList>
          </div>
        </div>
      </Tabs>

      <Dialog open={animationDialogOpen} onOpenChange={setAnimationDialogOpen}>
        <DialogContent className="max-w-md overflow-hidden border-none p-0 shadow-2xl">
          <div className="border-b bg-muted/30 px-4 py-3">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AnimationModeIcon className="size-4 text-primary" />
                {t("session.animation.title")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("session.animation.description")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-3 bg-background px-4 py-4">
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">
                {t("session.animation.presets")}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ANIMATION_SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.labelKey}
                    type="button"
                    onClick={() => {
                      setAnimationWidth(String(preset.width));
                      setAnimationHeight(String(preset.height));
                    }}
                    className="rounded-md border border-border bg-muted/25 px-2.5 py-2 text-left transition-colors hover:bg-accent/45"
                  >
                    <div className="text-[11px] font-semibold text-foreground">
                      {preset.width} x {preset.height}
                    </div>
                    <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {t(preset.labelKey)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="animation-width">{t("session.animation.width")}</Label>
                <Input
                  id="animation-width"
                  inputMode="numeric"
                  value={animationWidth}
                  onChange={(event) => setAnimationWidth(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="animation-height">{t("session.animation.height")}</Label>
                <Input
                  id="animation-height"
                  inputMode="numeric"
                  value={animationHeight}
                  onChange={(event) => setAnimationHeight(event.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/25 px-3 py-2.5">
              <div className="text-[11px] font-medium text-muted-foreground">
                {t("session.animation.startupDefaults")}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-background/80 px-2.5 py-2">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {t("session.animation.playback")}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-foreground">10 FPS</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("session.animation.loopEnabled")}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background/80 px-2.5 py-2">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {t("session.animation.onionSkin")}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-foreground">
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
