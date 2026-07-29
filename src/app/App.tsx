import { useKeyPress, useLocalStorageState } from "ahooks";
import { AsciiCanvas } from "@/widgets/canvas-editor";
import { useEditorStore } from "@/domains/canvas/public";
import { AppLayout } from "./AppLayout";
import { Toolbar } from "@/widgets/toolbar/dock";
import { SidebarInset, SidebarProvider, useSidebar } from "@/shared/ui/sidebar";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { runRedo, runUndo } from "@/domains/actions/public";
import { runAction } from "@/domains/actions/public";
import { resolveFillHotkeyChar } from "@/domains/actions/public";
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
import { useHandToolShortcuts } from "./useHandToolShortcuts";
import { ZoomControl } from "@/widgets/toolbar/zoom-control";

const SidebarRight = lazy(() =>
  import("@/widgets/toolbar/sidebar-right").then((module) => ({
    default: module.SidebarRight,
  }))
);

// Mobile sidebar trigger.
function MobileSidebarTrigger() {
  const OpenSidebarIcon = HOST_ICONOLOGY.chrome["open-right-sidebar"];
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();

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
      aria-label="Open library"
    >
      <OpenSidebarIcon className="size-5" />
    </button>
  );
}

function AppContent() {
  const [canvasContainerSize, setCanvasContainerSize] = useState<
    { width: number; height: number } | undefined
  >();
  const {
    tool,
    setTool,
    canvasMode,
    textCursor,
    staticGridSelection,
    staticGridEditMode,
    selections,
    editingStructuredTextNodeId,
    structuredTextSelection,
  } = useEditorStore(
    useShallow((state) => ({
      tool: state.tool,
      setTool: state.setTool,
      canvasMode: state.canvasMode,
      textCursor: state.textCursor,
      staticGridSelection: state.staticGridSelection,
      staticGridEditMode: state.staticGridEditMode,
      selections: state.selections,
      editingStructuredTextNodeId: state.editingStructuredTextNodeId,
      structuredTextSelection: state.structuredTextSelection,
    }))
  );
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
    canvasMode === "freeform"
      ? !!staticGridView.textCursor
      : !!textCursor ||
        !!editingStructuredTextNodeId ||
        !!structuredTextSelection;
  const isTemporaryPanActive = useHandToolShortcuts({
    canvasMode,
    isCanvasTextEditing,
    setTool,
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
    runUndo();
    feedback.dismiss();
  };

  const handleRedo = () => {
    runRedo();
  };

  const runGlobalCommand = (command: "undo" | "redo", event: KeyboardEvent) => {
    const result = runAction(command, {
      source: "global-hotkey",
      onUndo: handleUndo,
      onRedo: handleRedo,
    });
    if (result.succeeded) event.preventDefault();
  };

  useKeyPress((e) => matchesActionShortcut("undo", e), (e) => {
    runGlobalCommand("undo", e);
  });

  useKeyPress((e) => matchesActionShortcut("redo", e), (e) => {
    runGlobalCommand("redo", e);
  });

  useKeyPress(
    (event) =>
      !event.defaultPrevented && resolveFillHotkeyChar(event) !== null,
    (event) => {
      if (event.defaultPrevented) return;
      const fillChar = resolveFillHotkeyChar(event);
      if (!fillChar) return;
      const result = runAction("fill-selection-char", {
        source: "global-hotkey",
        fillChar,
      });
      if (result.succeeded) event.preventDefault();
    },
    {
      events: ["keydown"],
    }
  );

  return (
    <SidebarProvider className="flex h-full w-full overflow-hidden">
      <SidebarInset className="relative flex flex-1 flex-col overflow-hidden">
        <div
          data-canvas-ui="true"
          data-testid="app-top-bar"
          className="absolute left-3 top-3 z-50 flex min-w-0 items-center gap-1 pointer-events-none"
        >
          <AppMenu />
          <CanvasBreadcrumb />
        </div>
        <ZoomControl containerSize={canvasContainerSize} />
        <AppLayout
          canvas={
            <AsciiCanvas
              onUndo={handleUndo}
              onRedo={handleRedo}
              onContainerSizeChange={setCanvasContainerSize}
              interactionToolOverride={
                isTemporaryPanActive ? "pan" : undefined
              }
            />
          }
        >
          <Toolbar
            tool={tool}
            setTool={setTool}
            onUndo={handleUndo}
          />
        </AppLayout>

        <div className="absolute top-0 right-0 h-full pointer-events-none z-50">
          <SidebarProvider
            open={isRightPanelOpen}
            onOpenChange={setIsRightPanelOpen}
            className="h-full items-end"
            style={
              { "--sidebar-width": "24rem" } as React.CSSProperties
            }
          >
            <MobileSidebarTrigger />
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
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
  );
}
