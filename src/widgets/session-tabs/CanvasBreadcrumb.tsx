"use client";

import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { useUiI18n, type I18nKey } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { uiClass } from "@/shared/styles/components";
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
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const AnimationModeIcon = HOST_ICONOLOGY.canvasMode.animation;
const SessionExpandIcon = HOST_ICONOLOGY.sessionAction.expand;
const SessionMoreIcon = HOST_ICONOLOGY.sessionAction.more;
const SessionRenameIcon = HOST_ICONOLOGY.sessionAction.rename;
const SessionCreateIcon = HOST_ICONOLOGY.sessionAction.create;
const SessionCloseIcon = HOST_ICONOLOGY.sessionAction.close;

const ANIMATION_SIZE_PRESETS = [
  { labelKey: "session.animation.preset.classicTerminal", width: 80, height: 25 },
  { labelKey: "session.animation.preset.square64", width: 64, height: 64 },
  { labelKey: "session.animation.preset.poster128", width: 128, height: 128 },
] satisfies Array<{
  labelKey: I18nKey;
  width: number;
  height: number;
}>;

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

export function CanvasBreadcrumb() {
  const { t } = useUiI18n();
  const menuContentRef = useRef<HTMLDivElement>(null);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsOpenId, setActionsOpenId] = useState<string | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameMenuWidth, setRenameMenuWidth] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [animationDialogOpen, setAnimationDialogOpen] = useState(false);
  const [animationWidth, setAnimationWidth] = useState("80");
  const [animationHeight, setAnimationHeight] = useState("25");

  const activeSession =
    canvasSessions.find((session) => session.id === activeCanvasId) ??
    canvasSessions[0];
  const pendingDeleteSession = pendingDeleteId
    ? canvasSessions.find((session) => session.id === pendingDeleteId) ?? null
    : null;
  const ActiveModeIcon =
    HOST_ICONOLOGY.canvasMode[activeSession?.mode ?? "freeform"];
  const canRemove = canvasSessions.length > 1;

  const createSession = (mode: "freeform" | "structured") => {
    createCanvasSession(mode);
    setMenuOpen(false);
  };

  const openRename = (id: string, name: string) => {
    setRenameMenuWidth(menuContentRef.current?.getBoundingClientRect().width ?? null);
    setActionsOpenId(null);
    setRenameTargetId(id);
    setRenameName(name);
  };

  const commitRename = () => {
    if (!renameTargetId) return;
    const nextName = renameName.trim();
    if (nextName) renameCanvasSession(renameTargetId, nextName);
    setRenameTargetId(null);
    setRenameMenuWidth(null);
  };

  const cancelRename = () => {
    setRenameTargetId(null);
    setRenameMenuWidth(null);
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
  };

  return (
    <div
      data-canvas-ui="true"
      data-canvas-breadcrumb-host="true"
      className="pointer-events-auto min-w-0"
    >
      <DropdownMenu
        modal={false}
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) {
            setActionsOpenId(null);
            setRenameMenuWidth(null);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            tone="subtle"
            size="md"
            className={cn(
              "max-w-[min(14rem,calc(100vw-5.5rem))] justify-start gap-1.5 bg-transparent px-2",
              "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
              uiClass.hostControl
            )}
            aria-label={t("session.select")}
            title={activeSession?.name ?? t("session.fallbackName")}
          >
            <ActiveModeIcon className="size-4 shrink-0" />
            <span className="truncate">
              {activeSession?.name ?? t("session.fallbackName")}
            </span>
            <SessionExpandIcon className="size-4 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          ref={menuContentRef}
          align="start"
          className="w-max min-w-40 max-w-[min(14rem,calc(100vw-1.5rem))]"
          style={
            renameMenuWidth === null
              ? undefined
              : { width: renameMenuWidth }
          }
          aria-label={t("session.select")}
          onEscapeKeyDown={(event) => {
            if (!renameTargetId) return;
            event.preventDefault();
            cancelRename();
          }}
        >
          {canvasSessions.map((session) => {
            const ModeIcon = HOST_ICONOLOGY.canvasMode[session.mode];
            const manageLabel = t("session.manage", { name: session.name });
            const isActive = session.id === activeCanvasId;
            const isEditing = session.id === renameTargetId;
            return (
              <div
                key={session.id}
                role="none"
                data-canvas-session-row={session.id}
                data-active={isActive ? "true" : undefined}
                className={cn(
                  "group/session-row flex min-w-0 items-center rounded-md transition-colors",
                  "has-[[data-highlighted]]:bg-accent has-[[data-state=open]]:bg-accent",
                  isActive && "bg-accent text-accent-foreground"
                )}
              >
                {isEditing ? (
                  <div
                    role="none"
                    className="flex h-7 min-w-0 flex-1 items-center gap-2 px-2"
                  >
                    <ModeIcon className="size-4 shrink-0" />
                    <Input
                      value={renameName}
                      onChange={(event) => setRenameName(event.target.value)}
                      onBlur={commitRename}
                      onFocus={(event) => event.currentTarget.select()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitRename();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          cancelRename();
                        }
                      }}
                      className="h-6 min-w-0 flex-1 px-1.5 py-0"
                      aria-label={t("session.renameLabel")}
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    <DropdownMenuItem
                      onSelect={() => {
                        switchCanvasSession(session.id);
                        setMenuOpen(false);
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "min-w-0 flex-1 bg-transparent pr-1 focus:bg-transparent data-[highlighted]:bg-transparent",
                        "group-has-[[data-highlighted]]/session-row:text-accent-foreground group-has-[[data-state=open]]/session-row:text-accent-foreground"
                      )}
                    >
                      <ModeIcon className="size-4 shrink-0" />
                      <span className="truncate">{session.name}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSub
                      open={actionsOpenId === session.id}
                      onOpenChange={(open) =>
                        setActionsOpenId(open ? session.id : null)
                      }
                    >
                      <DropdownMenuSubTrigger
                        data-session-actions="true"
                        aria-label={manageLabel}
                        title={manageLabel}
                        className={cn(
                          "size-7 shrink-0 justify-center bg-transparent p-0 focus:bg-transparent data-[highlighted]:bg-transparent data-[state=open]:bg-transparent",
                          "[&>svg:last-child]:hidden group-has-[[data-highlighted]]/session-row:text-accent-foreground group-has-[[data-state=open]]/session-row:text-accent-foreground"
                        )}
                      >
                        <SessionMoreIcon className="size-4" />
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent aria-label={manageLabel}>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            openRename(session.id, session.name);
                          }}
                        >
                          <SessionRenameIcon />
                          {t("session.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!canRemove}
                          onSelect={() => {
                            setMenuOpen(false);
                            setPendingDeleteId(session.id);
                          }}
                        >
                          <SessionCloseIcon />
                          {t("session.closeAction")}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
              </div>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SessionCreateIcon />
              {t("session.createNew")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent aria-label={t("session.createNew")}>
              {createOptionMeta.map((option) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuItem
                    key={option.mode}
                    onSelect={() => {
                      if (option.mode === "animation") {
                        setMenuOpen(false);
                        setAnimationDialogOpen(true);
                      } else {
                        createSession(option.mode);
                      }
                    }}
                  >
                    <Icon />
                    {t(option.labelKey)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

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
              <Button tone="neutral" onClick={() => setAnimationDialogOpen(false)}>
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
