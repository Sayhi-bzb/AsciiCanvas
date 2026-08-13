import { useLocalStorageState } from "ahooks";
import { CanvasEditor } from "@/widgets/canvas-editor";
import { useCanvasRuntime, useCanvasState } from "@/domains/canvas/public";
import { Toolbar } from "@/widgets/toolbar/dock";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/sidebar";
import {
  Suspense,
  lazy,
  useCallback,
  useMemo,
  useState,
} from "react";
import { feedback } from "@/shared/services/effects";
import { useShallow } from "zustand/react/shallow";
import { CanvasBreadcrumb } from "@/widgets/session-tabs/CanvasBreadcrumb";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { AppMenu } from "@/widgets/toolbar/app-menu";
import { getStaticGridViewState } from "@/domains/selection/public";
import { isStaticGridMode } from "@/domains/sessions/public";
import { useHandToolShortcuts } from "./useHandToolShortcuts";
import { useGlobalShortcutCommands } from "./useGlobalShortcutCommands";
import { ZoomControl } from "@/widgets/toolbar/zoom-control";
import { HelpControl } from "@/widgets/toolbar/help-control";
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
import { useEditor } from "@/domains/editor/public";
import { Toaster } from "@/shared/ui/sonner";
import {
  EditorChromeLayout,
  EditorChromeProvider,
  useEditorChromeLayout,
} from "@/widgets/editor-chrome/public";

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
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "b"
      ) {
        return;
      }
      toggleSidebar();
      return { claimed: true, preventDefault: true };
    },
  });
  return null;
}

function PhoneSidebarTrigger() {
  const { openMobile } = useSidebar();
  if (openMobile) return null;
  return <SidebarTrigger side="right" />;
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
  const { formFactor, sidebarPresentation, viewportFrame } =
    useEditorChromeLayout();
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
  const editor = useEditor();
  const canvas = useCanvasRuntime();
  const setTool = useCallback(
    (nextTool: typeof tool) => { editor.setCurrentTool(nextTool); },
    [editor]
  );
  const exitStaticGridTextEdit = canvas.commands.staticGrid.exitTextEdit;
  const setTextCursor = canvas.commands.interaction.setTextCursor;
  const setEditingStructuredTextNodeId =
    canvas.commands.interaction.setEditingStructuredTextNodeId;
  const setStructuredTextSelection =
    canvas.commands.interaction.setStructuredTextSelection;
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

  const [desktopSidebarOpen, setDesktopSidebarOpen] =
    useLocalStorageState<boolean>(
    "ui-right-panel-status",
    { defaultValue: true }
  );
  const [transientSidebar, setTransientSidebar] = useState({
    formFactor,
    open: false,
  });
  const transientSidebarOpen =
    transientSidebar.formFactor === formFactor && transientSidebar.open;

  const isRightPanelOpen =
    formFactor === "desktop"
      ? desktopSidebarOpen ?? true
      : transientSidebarOpen;
  const setIsRightPanelOpen = useCallback(
    (open: boolean) => {
      if (formFactor === "desktop") setDesktopSidebarOpen(open);
      else setTransientSidebar({ formFactor, open });
    }, [
      formFactor,
      setDesktopSidebarOpen,
      setTransientSidebar,
    ]
  );

  const handleUndo = () => {
    const changed = editor.history.undo();
    if (changed) feedback.dismiss();
    return changed;
  };

  const handleRedo = () => {
    return editor.history.redo();
  };

  useGlobalShortcutCommands({
    enabled: !isCollaborationReadOnly,
  });

  return (
    <SidebarProvider
      presentation={sidebarPresentation}
      open={isRightPanelOpen}
      onOpenChange={setIsRightPanelOpen}
      className="size-full overflow-hidden"
      style={{ "--sidebar-width": "24rem" } as React.CSSProperties}
    >
      <SidebarShortcutRegistration />
      <EditorChromeLayout
        sidebarOpen={isRightPanelOpen}
        topStart={
          <div
            data-canvas-ui="true"
            data-testid="app-top-bar"
            className="flex min-w-0 items-center gap-1 pointer-events-none"
          >
            <AppMenu />
            <CanvasBreadcrumb />
            <CollaborationControl />
          </div>
        }
        topEnd={formFactor === "phone" ? <PhoneSidebarTrigger /> : null}
        bottomStart={
          formFactor === "phone" ? null : (
            <ZoomControl viewportFrame={viewportFrame} formFactor={formFactor} />
          )
        }
        bottomCenter={
          <div inert={isCollaborationReadOnly} aria-disabled={isCollaborationReadOnly}>
            <Toolbar
              tool={tool}
              setTool={setTool}
              onUndo={handleUndo}
              isCanvasTextEditing={isCanvasTextEditing}
              onExitCanvasTextEditing={exitCanvasTextEditing}
              enabled={!isCollaborationReadOnly}
              formFactor={formFactor}
            />
          </div>
        }
        bottomEnd={
          <HelpControl />
        }
        sidebar={
          <Suspense fallback={null}>
            <SidebarRight />
          </Suspense>
        }
        canvas={
          <div
            data-onboarding-target="workspace"
            className="relative size-full overflow-hidden"
          >
            <div
              className="relative h-full w-full"
              inert={isCollaborationReadOnly}
              aria-busy={isCollaborationReadOnly}
            >
              <CanvasEditor
                onUndo={handleUndo}
                onRedo={handleRedo}
                interactionToolOverride={
                  isTemporaryPanActive ? "pan" : undefined
                }
                enabled={!isCollaborationReadOnly}
                viewportFrame={viewportFrame}
              />
              <RemotePresenceOverlay />
              {isCollaborationReadOnly && (
                <div className="absolute inset-0 z-(--layer-chrome) bg-background/20" />
              )}
            </div>
          </div>
        }
      />
      <Toaster />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <ShortcutProvider>
      <TooltipProvider>
        <OnboardingTourProvider>
          <CanvasEngineProvider>
            <EditorChromeProvider>
              <AppContent />
            </EditorChromeProvider>
          </CanvasEngineProvider>
        </OnboardingTourProvider>
      </TooltipProvider>
    </ShortcutProvider>
  );
}
