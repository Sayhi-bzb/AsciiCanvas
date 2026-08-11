"use client";

import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import { SLIDE_SIZE_PRESETS, type SlideSize } from "@/domains/slides/public";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { InlineRenameInput } from "@/shared/ui/inline-rename-input";
import { CustomSlideSizeDialog } from "@/widgets/dialogs/custom-slide-size-dialog";
import { useOnboardingTour } from "@/widgets/onboarding/onboarding-context";

const SessionExpandIcon = HOST_ICONOLOGY.sessionAction.expand;
const SessionMoreIcon = HOST_ICONOLOGY.sessionAction.more;
const SessionRenameIcon = HOST_ICONOLOGY.sessionAction.rename;
const SessionCreateIcon = HOST_ICONOLOGY.sessionAction.create;
const SessionCloseIcon = HOST_ICONOLOGY.sessionAction.close;
const SlideModeIcon = HOST_ICONOLOGY.canvasMode.slide;

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
] satisfies Array<{
  mode: "freeform" | "structured";
  labelKey: I18nKey;
  icon: (typeof HOST_ICONOLOGY.canvasMode)[keyof typeof HOST_ICONOLOGY.canvasMode];
}>;

export function CanvasBreadcrumb() {
  const { t } = useUiI18n();
  const { phase: onboardingPhase } = useOnboardingTour();
  const selectorTriggerRef = useRef<HTMLButtonElement>(null);
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
  const [renameMenuWidth, setRenameMenuWidth] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [customSlideSizeOpen, setCustomSlideSizeOpen] = useState(false);
  const keepCreateMenuOpen =
    onboardingPhase === "canvas-selector" ||
    onboardingPhase === "create-menu" ||
    onboardingPhase === "structured-create";

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

  const createSlideSession = (size: SlideSize) => {
    createCanvasSession("slide", { slideSize: size });
    setMenuOpen(false);
  };

  const openRename = (id: string) => {
    setRenameMenuWidth(menuContentRef.current?.getBoundingClientRect().width ?? null);
    setActionsOpenId(null);
    setRenameTargetId(id);
  };

  const commitRename = (name: string) => {
    if (!renameTargetId) return;
    renameCanvasSession(renameTargetId, name);
    setRenameTargetId(null);
    setRenameMenuWidth(null);
  };

  const cancelRename = () => {
    setRenameTargetId(null);
    setRenameMenuWidth(null);
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
          setMenuOpen(keepCreateMenuOpen ? true : open);
          if (!open) {
            setActionsOpenId(null);
            setRenameMenuWidth(null);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            ref={selectorTriggerRef}
            data-onboarding-target="canvas-selector"
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
          onCloseAutoFocus={(event) => {
            if (customSlideSizeOpen) event.preventDefault();
          }}
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
                    <InlineRenameInput
                      value={session.name}
                      onCommit={commitRename}
                      onCancel={cancelRename}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      className="flex-1 px-1.5"
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
                            openRename(session.id);
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
          <DropdownMenuSub
            open={
              onboardingPhase === "create-menu" ||
              onboardingPhase === "structured-create"
                ? true
                : undefined
            }
          >
            <DropdownMenuSubTrigger data-onboarding-target="create-menu">
              <SessionCreateIcon />
              {t("session.createNew")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent aria-label={t("session.createNew")}>
              {createOptionMeta.map((option) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuItem
                    key={option.mode}
                    data-onboarding-target={
                      option.mode === "structured" ? "create-structured" : undefined
                    }
                    onSelect={() => createSession(option.mode)}
                  >
                    <Icon />
                    {t(option.labelKey)}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <SlideModeIcon />
                  {t("session.newSlides")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent aria-label={t("session.newSlides")}>
                  <DropdownMenuItem onSelect={() => createSlideSession(SLIDE_SIZE_PRESETS.widescreen)}>
                    {t("session.slideWidescreen")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => createSlideSession(SLIDE_SIZE_PRESETS.classic)}>
                    {t("session.slideClassic")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setMenuOpen(false);
                      setCustomSlideSizeOpen(true);
                    }}
                  >
                    {t("session.slideCustom.item")}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {customSlideSizeOpen ? (
        <CustomSlideSizeDialog
          open={customSlideSizeOpen}
          onOpenChange={setCustomSlideSizeOpen}
          onConfirm={(size) => {
            createSlideSession(size);
            setCustomSlideSizeOpen(false);
          }}
          returnFocusRef={selectorTriggerRef}
        />
      ) : null}

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
