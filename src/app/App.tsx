import { useKeyPress, useLocalStorageState } from "ahooks";
import { Library } from "lucide-react";
import { AsciiCanvas } from "@/widgets/canvas-editor";
import { useEditorStore } from "@/domains/canvas/public";
import { AppLayout } from "./AppLayout";
import { Toolbar } from "@/widgets/toolbar/dock";
import { SidebarInset, SidebarProvider, useSidebar } from "@/shared/ui/sidebar";
import { Suspense, lazy, useEffect, useState } from "react";
import { runRedo, runUndo } from "@/domains/actions/public";
import { runAction } from "@/domains/actions/public";
import { resolveFillHotkeyChar } from "@/domains/actions/public";
import { feedback } from "@/shared/services/effects";
import { useShallow } from "zustand/react/shallow";
import { SessionTabs } from "@/widgets/session-tabs/SessionTabs";
import { useIsMobile, useSidebarAutoCollapseSignal } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";
import { TooltipProvider } from "@/shared/ui/tooltip";

const SidebarRight = lazy(() =>
  import("@/widgets/toolbar/sidebar-right").then((module) => ({
    default: module.SidebarRight,
  }))
);

// Mobile sidebar trigger.
function MobileSidebarTrigger() {
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
      <Library className="size-5" />
    </button>
  );
}

function AppContent() {
  const [canvasContainerSize, setCanvasContainerSize] = useState<
    { width: number; height: number } | undefined
  >();
  const { tool, setTool } = useEditorStore(
    useShallow((state) => ({
      tool: state.tool,
      setTool: state.setTool,
    }))
  );

  const [isRightPanelOpen, setIsRightPanelOpen] = useLocalStorageState<boolean>(
    "ui-right-panel-status",
    { defaultValue: true }
  );

  const sidebarAutoCollapseSignal = useSidebarAutoCollapseSignal();
  const isMobile = useIsMobile();
  const topBarLeftInset = isMobile ? "3.75rem" : "4rem";
  const topBarRightInset = isMobile ? "0.5rem" : "4rem";

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

  useKeyPress(["meta.z", "ctrl.z"], (e) => {
    runGlobalCommand("undo", e);
  });

  useKeyPress(["meta.shift.z", "ctrl.shift.z", "meta.y", "ctrl.y"], (e) => {
    runGlobalCommand("redo", e);
  });

  useKeyPress(
    (event) => resolveFillHotkeyChar(event) !== null,
    (event) => {
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
        <SessionTabs
          leftInset={topBarLeftInset}
          rightInset={topBarRightInset}
        />
        <AppLayout
          canvas={
            <AsciiCanvas
              onUndo={handleUndo}
              onRedo={handleRedo}
              onContainerSizeChange={setCanvasContainerSize}
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
              <SidebarRight containerSize={canvasContainerSize} />
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

