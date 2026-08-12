import { useLocalStorageState } from "ahooks";
import { CanvasEditor } from "@/widgets/canvas-editor";
import { canvasCommands, useCanvasState } from "@/domains/canvas/public";
import { AppLayout } from "./AppLayout";
import { Toolbar } from "@/widgets/toolbar/dock";
import { SidebarInset, SidebarProvider, useSidebar } from "@/shared/ui/sidebar";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { runRedo, runUndo } from "@/domains/actions/public";
import { runAction } from "@/domains/actions/public";
import { matchesActionShortcut } from "@/domains/actions/public";
import { feedback } from "@/shared/services/effects";
import { useShallow } from "zustand/react/shallow";
import { CanvasBreadcrumb } from "@/widgets/session-tabs/CanvasBreadcrumb";
import { useIsMobile, useSidebarAutoCollapseSignal } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { AppMenu } from "@/widgets/toolbar/app-menu";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { getStaticGridViewState } from "@/domains/selection/public";
import { isStaticGridMode } from "@/domains/sessions/public";
import { useHandToolShortcuts } from "./useHandToolShortcuts";
import { useGlobalShortcutCommands } from "./useGlobalShortcutCommands";
import { ZoomControl } from "@/widgets/toolbar/zoom-control";
import { HelpControl } from "@/widgets/toolbar/help-control";
import { useUiI18n } from "@/shared/i18n";
import {
  SHORTCUT_PRIORITY,
  ShortcutProvider,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";
import { useActiveCollaboration } from "./useActiveCollaboration";
import { useHorizontalWheelNavigationGuard } from "./useHorizontalWheelNavigationGuard";
import { CollaborationControl } from "@/widgets/collaboration/CollaborationControl";
import { RemotePresenceOverlay } from "@/widgets/collaboration/RemotePresenceOverlay";
import { useCollaborationSnapshot } from "@/widgets/collaboration/useCollaborationSnapshot";
import { sameCollaborationRoom } from "@/domains/collaboration/public";
import { OnboardingTourProvider } from "@/widgets/onboarding/new-user-tour";
import { CanvasEngineProvider } from "@/widgets/canvas-editor/engine/useCanvasEngineRuntime";

const SidebarRight = lazy(() =>
  import("@/widgets/toolbar/sidebar-right").then((module) => ({
    default: module.SidebarRight,
  }))
);

function SidebarShortcutRegistration() {
  const { toggleSidebar } = useSidebar();
  useShortcutLayer({
    id: "right-sidebar",
    priority: SHORTCUT_PRIORITY.chrome,
    onKeyDown: (event, context) => {
      if (
        context.targetKind === "editable" ||
        context.targetKind === "managed-canvas" ||
        context.targetKind === "overlay" ||
        !matchesActionShortcut("toggle-sidebar", event)
      ) {
        return;
      }
      const result = runAction("toggle-sidebar", {
        source: "global-hotkey",
        toggleSidebar,
      });
      return result.status === "succeeded"
        ? { claimed: true, preventDefault: true }
        : undefined;
    },
  });
  return null;
}

// Mobile sidebar trigger.
function MobileSidebarTrigger() {
  const OpenSidebarIcon = HOST_ICONOLOGY.chrome["open-right-sidebar"];
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { t } = useUiI18n();

  if (!isMobile) return null;

  return (
    <button
      onClick={() => setOpenMobile(true)}
      className={cn(
        "fixed bottom-24 right-4 z-50 size-10 rounded-xl",
        "bg-popover/95 border border-border shadow-lg",
        "flex items-center justify-center pointer-events-auto",
        "hover:bg-accent/45 transition-colors"
      )}
      aria-label={t("sidebar.open")}
    >
      <OpenSidebarIcon className="size-5" />
    </button>
  );
}

function AppContent() {
  useActiveCollaboration();
  useHorizontalWheelNavigationGuard();
  const collaborationSnapshot = useCollaborationSnapshot();
  const activeCollaboration = useCanvasState((state) =>
    state.canvasSessions.find((session) => session.id === state.activeCanvasId)?.collaboration
  );
  const isCollaborationReadOnly =
    !!activeCollaboration &&
    (!collaborationSnapshot.canEdit ||
      !sameCollaborationRoom(
        activeCollaboration,
        collaborationSnapshot.descriptor
      ));
  const [canvasContainerSize, setCanvasContainerSize] = useState<
    { width: number; height: number } | undefined
  >();
  const {
    tool,
    canvasMode,
    textCursor,
    staticGridSelection,
    staticGridEditMode,
    selections,
    editingStructuredTextNodeId,
    structuredTextSelection,
  } = useCanvasState(
    useShallow((state) => ({
      tool: state.tool,
      canvasMode: state.canvasMode,
      textCursor: state.textCursor,
      staticGridSelection: state.staticGridSelection,
      staticGridEditMode: state.staticGridEditMode,
      selections: state.selections,
      editingStructuredTextNodeId: state.editingStructuredTextNodeId,
      structuredTextSelection: state.structuredTextSelection,
    }))
  );
  const setTool = canvasCommands.tools.set;
  const exitStaticGridTextEdit = canvasCommands.staticGrid.exitTextEdit;
  const setTextCursor = canvasCommands.interaction.setTextCursor;
  const setEditingStructuredTextNodeId =
    canvasCommands.interaction.setEditingStructuredTextNodeId;
  const setStructuredTextSelection =
    canvasCommands.interaction.setStructuredTextSelection;
  const staticGridView = useMemo(
    () =>
      getStaticGridViewState({
        selection: staticGridSelection,
        editMode: staticGridEditMode,
        textCursor,
        selections,
      }),
    [selections, staticGridEditMode, staticGridSelection, textCursor]
  );
  const isCanvasTextEditing =
    isStaticGridMode(canvasMode)
      ? !!staticGridView.textCursor
      : !!textCursor ||
        !!editingStructuredTextNodeId ||
        !!structuredTextSelection;
  const exitCanvasTextEditing = useCallback(() => {
    exitStaticGridTextEdit();
    setTextCursor(null);
    setEditingStructuredTextNodeId(null);
    setStructuredTextSelection(null);
  }, [
    exitStaticGridTextEdit,
    setEditingStructuredTextNodeId,
    setStructuredTextSelection,
    setTextCursor,
  ]);
  const isTemporaryPanActive = useHandToolShortcuts({
    isCanvasTextEditing,
  });

  const [isRightPanelOpen, setIsRightPanelOpen] = useLocalStorageState<boolean>(
    "ui-right-panel-status",
    { defaultValue: true }
  );

  const sidebarAutoCollapseSignal = useSidebarAutoCollapseSignal();

  useEffect(() => {
    if (sidebarAutoCollapseSignal === 0) return;
    setIsRightPanelOpen(false);
  }, [sidebarAutoCollapseSignal, setIsRightPanelOpen]);

  const handleUndo = () => {
    const changed = runUndo();
    if (changed) feedback.dismiss();
    return changed;
  };

  const handleRedo = () => {
    return runRedo();
  };

  useGlobalShortcutCommands({
    onUndo: handleUndo,
    onRedo: handleRedo,
    enabled: !isCollaborationReadOnly,
  });

  return (
    <SidebarProvider className="flex h-full w-full overflow-hidden">
      <SidebarInset
        data-onboarding-target="workspace"
        className="relative flex flex-1 flex-col overflow-hidden"
      >
        <div
          data-canvas-ui="true"
          data-testid="app-top-bar"
          className="absolute left-3 top-3 z-50 flex min-w-0 items-center gap-1 pointer-events-none"
        >
          <AppMenu />
          <CanvasBreadcrumb />
          <CollaborationControl />
        </div>
        <ZoomControl containerSize={canvasContainerSize} />
        <AppLayout
          canvas={
            <div
              className="relative h-full w-full"
              inert={isCollaborationReadOnly}
              aria-busy={isCollaborationReadOnly}
            >
              <CanvasEditor
                onUndo={handleUndo}
                onRedo={handleRedo}
                onContainerSizeChange={setCanvasContainerSize}
                interactionToolOverride={
                  isTemporaryPanActive ? "pan" : undefined
                }
                enabled={!isCollaborationReadOnly}
              />
              {isCollaborationReadOnly && (
                <div className="absolute inset-0 z-50 bg-background/20" />
              )}
            </div>
          }
        >
          <div inert={isCollaborationReadOnly} aria-disabled={isCollaborationReadOnly}>
            <Toolbar
              tool={tool}
              setTool={setTool}
              onUndo={handleUndo}
              isCanvasTextEditing={isCanvasTextEditing}
              onExitCanvasTextEditing={exitCanvasTextEditing}
              enabled={!isCollaborationReadOnly}
            />
          </div>
        </AppLayout>
        <RemotePresenceOverlay />

        <div className="absolute top-0 right-0 h-full pointer-events-none z-50">
          <SidebarProvider
            open={isRightPanelOpen}
            onOpenChange={setIsRightPanelOpen}
            className="h-full items-end"
            style={
              { "--sidebar-width": "24rem" } as React.CSSProperties
            }
          >
            <SidebarShortcutRegistration />
            <MobileSidebarTrigger />
            <HelpControl />
            <Suspense fallback={<div className="w-0" />}>
              <SidebarRight />
            </Suspense>
          </SidebarProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <ShortcutProvider>
      <TooltipProvider>
        <OnboardingTourProvider>
          <CanvasEngineProvider>
            <AppContent />
          </CanvasEngineProvider>
        </OnboardingTourProvider>
      </TooltipProvider>
    </ShortcutProvider>
  );
}
