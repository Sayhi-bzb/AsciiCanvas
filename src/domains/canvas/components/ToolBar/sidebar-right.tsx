"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Github, Target } from "lucide-react";
import { SidebarHeader, SidebarStandard, SidebarTrigger, useSidebar } from "@/shared/ui/sidebar";
import { CharLibrary, SearchForm, useLibraryStore } from "@/domains/character-library";
import { StructuredTemplateLibrary } from "./structured-template-library";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import { SIDEBAR_ACTION_META, runSidebarAction } from "@/domains/actions/core";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { ExportDialog } from "@/domains/export";
import { ImportButton } from "@/domains/import";
import { HandbookDialog, ClearCanvasDialog } from "@/domains/canvas/components/dialogs";
import { useShallow } from "zustand/react/shallow";

type StructuredSidebarTab = "template" | "components";

const STRUCTURED_SIDEBAR_TABS: Array<{
  id: StructuredSidebarTab;
  label: string;
}> = [
  { id: "template", label: "Template" },
  { id: "components", label: "Components" },
];

export function SidebarRight() {
  const {
    grid,
    canvasMode,
    structuredScene,
    structuredComponents,
    canvasBounds,
    animationTimeline,
    clearCanvas,
    showGrid,
    setShowGrid,
    exportShowGrid,
    setExportShowGrid,
    setOffset,
    setZoom,
  } = useCanvasStore(
    useShallow((state) => ({
      grid: state.grid,
      canvasMode: state.canvasMode,
      structuredScene: state.structuredScene,
      structuredComponents: state.structuredComponents,
      canvasBounds: state.canvasBounds,
      animationTimeline: state.animationTimeline,
      clearCanvas: state.clearCanvas,
      showGrid: state.showGrid,
      setShowGrid: state.setShowGrid,
      exportShowGrid: state.exportShowGrid,
      setExportShowGrid: state.setExportShowGrid,
      setOffset: state.setOffset,
      setZoom: state.setZoom,
    }))
  );

  const { fetchLibrary } = useLibraryStore();
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const canResetView = canvasMode !== "animation";
  const [structuredSidebarTab, setStructuredSidebarTab] =
    useState<StructuredSidebarTab>("components");
  const [structuredLibraryQuery, setStructuredLibraryQuery] = useState("");

  useEffect(() => {
    if (canvasMode === "structured") return;
    fetchLibrary();
  }, [canvasMode, fetchLibrary]);

  return (
    <SidebarStandard
      variant="floating"
      side="right"
      className="pointer-events-auto"
      contentClassName={canvasMode === "structured" ? "gap-0 p-2" : undefined}
      header={
        <SidebarHeader
          className={cn(
            "border-b transition-all duration-200",
            isCollapsed
              ? "items-center justify-center px-0 py-4"
              : "flex-row items-center gap-2 px-3 py-2"
          )}
        >
          {!isCollapsed &&
            (canvasMode === "structured" ? (
              <input
                type="search"
                aria-label="Search structured library"
                value={structuredLibraryQuery}
                onChange={(event) => setStructuredLibraryQuery(event.target.value)}
                placeholder="Search"
                className={cn(
                  "h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none",
                  "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
              />
            ) : (
              <SearchForm className="min-w-0 flex-1" />
            ))}
          <SidebarTrigger className="size-8 shrink-0" />
        </SidebarHeader>
      }
      footer={
        <div className={cn("flex w-full flex-col gap-2", isCollapsed && "items-center")}>
          <div
            className={cn(
              "flex items-center justify-between w-full px-1",
              isCollapsed && "flex-col gap-2"
            )}
          >
            <div className={cn("flex items-center gap-1", isCollapsed && "flex-col")}>
              <ImportButton />

              <ExportDialog
                grid={grid}
                canvasMode={canvasMode}
                structuredScene={structuredScene}
                structuredComponents={structuredComponents}
                canvasBounds={canvasBounds}
                animationTimeline={animationTimeline}
                exportShowGrid={exportShowGrid}
                setExportShowGrid={setExportShowGrid}
              />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      tone="subtle"
                      shape="square"
                      size="md"
                      className={cn(
                        "size-8 transition-colors",
                        showGrid ? "text-primary" : "text-muted-foreground"
                      )}
                      onClick={() =>
                        runSidebarAction("toggle-grid", {
                          showGrid,
                          setShowGrid,
                          setZoom,
                          setOffset,
                        })
                      }
                    >
                      {showGrid ? (
                        <Eye className="size-4" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {showGrid
                      ? "Hide Workspace Grid"
                      : SIDEBAR_ACTION_META["toggle-grid"].label}
                  </TooltipContent>
                </Tooltip>

                {canResetView && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        tone="subtle"
                        shape="square"
                        size="md"
                        className="size-8 text-muted-foreground"
                        onClick={() =>
                          runSidebarAction("reset-view", {
                            showGrid,
                            setShowGrid,
                            setZoom,
                            setOffset,
                          })
                        }
                      >
                        <Target className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {SIDEBAR_ACTION_META["reset-view"].label}
                    </TooltipContent>
                  </Tooltip>
                )}

                <HandbookDialog />

                <ClearCanvasDialog
                  isCollapsed={isCollapsed}
                  iconOnly
                  label={canvasMode === "animation" ? "Clear Frame" : "Clear Canvas"}
                  description={
                    canvasMode === "animation"
                      ? "This will completely clear the current animation frame."
                      : "This will completely clear the current blueprint."
                  }
                  onConfirm={clearCanvas}
                />
              </TooltipProvider>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    tone="subtle"
                    shape="square"
                    size="md"
                    className="size-8 text-muted-foreground"
                    onClick={() =>
                      runSidebarAction("open-source-code", {
                        showGrid,
                        setShowGrid,
                        setZoom,
                        setOffset,
                      })
                    }
                  >
                    <Github className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {SIDEBAR_ACTION_META["open-source-code"].label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {canvasMode === "structured" && !isCollapsed && (
          <div className="border-b px-2 pb-2 pt-1">
            <div
              className="flex items-end gap-4"
              role="tablist"
              aria-label="Structured library sections"
            >
              {STRUCTURED_SIDEBAR_TABS.map((tab) => {
                const isActive = structuredSidebarTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={cn(
                      "relative h-7 px-0 text-xs font-medium transition-colors outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring/50",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setStructuredSidebarTab(tab.id)}
                  >
                    {tab.label}
                    {isActive && (
                      <span
                        data-testid="structured-sidebar-active-tab-line"
                        className="absolute inset-x-0 -bottom-px h-px bg-foreground"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <ScrollArea className="flex-1">
          {canvasMode === "structured" ? (
            structuredSidebarTab === "components" ? (
              <StructuredTemplateLibrary query={structuredLibraryQuery} />
            ) : (
              <div className="px-2 py-4 text-xs text-muted-foreground">
                No templates yet
              </div>
            )
          ) : (
            <CharLibrary />
          )}
        </ScrollArea>
      </div>
    </SidebarStandard>
  );
}



