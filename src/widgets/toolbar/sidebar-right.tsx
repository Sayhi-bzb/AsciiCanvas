"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Eye, EyeOff, Github, Languages } from "lucide-react";
import {
  SidebarHeader,
  SidebarStandard,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/sidebar";
import { CharLibrary } from "@/widgets/character-library/char-library";
import { SearchForm } from "@/widgets/character-library/search-form";
import { useLibraryStore } from "@/domains/character-library/public";
import { StructuredTemplateLibrary } from "./structured-template-library";
import {
  STRUCTURED_COMPONENT_TEMPLATES,
  STRUCTURED_PAGE_TEMPLATES,
} from "@/domains/structured-content/public";
import { useEditorStore } from "@/domains/canvas/public";
import { runSidebarAction } from "@/domains/actions/public";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { ExportDialog } from "@/widgets/export/export-dialog";
import { ImportButton } from "@/widgets/import/ImportButton";
import { HandbookDialog, ClearCanvasDialog } from "@/widgets/dialogs";
import { useShallow } from "zustand/react/shallow";
import { useUiI18n } from "@/shared/i18n";
import { AnimationSidebarContent } from "./animation-sidebar-content";

type StructuredSidebarTab = "template" | "components";

const STRUCTURED_SIDEBAR_TABS: Array<{
  id: StructuredSidebarTab;
  labelKey: "sidebar.tab.template" | "sidebar.tab.components";
}> = [
  { id: "template", labelKey: "sidebar.tab.template" },
  { id: "components", labelKey: "sidebar.tab.components" },
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
  } = useEditorStore(
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
  const { language, t, toggleLanguage } = useUiI18n();
  const [structuredSidebarTab, setStructuredSidebarTab] =
    useState<StructuredSidebarTab>("components");
  const [structuredLibraryQuery, setStructuredLibraryQuery] = useState("");

  useEffect(() => {
    if (canvasMode !== "freeform") return;
    fetchLibrary();
  }, [canvasMode, fetchLibrary]);

  const stopCanvasUiEvent = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  return (
    <SidebarStandard
      variant="floating"
      side="right"
      className="pointer-events-auto"
      data-canvas-ui="true"
      onPointerDown={stopCanvasUiEvent}
      onMouseDown={stopCanvasUiEvent}
      onClick={stopCanvasUiEvent}
      onContextMenu={stopCanvasUiEvent}
      contentClassName={cn(
        "min-h-0 overflow-hidden",
        canvasMode === "structured" && "gap-0 p-2",
        canvasMode === "animation" && "p-2"
      )}
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
                aria-label={t("sidebar.search.structured")}
                value={structuredLibraryQuery}
                onChange={(event) => setStructuredLibraryQuery(event.target.value)}
                placeholder={t("sidebar.search.placeholder")}
                className={cn(
                  "h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none",
                  "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
              />
            ) : canvasMode === "animation" ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent">
                  <Clapperboard className="size-4 text-accent-foreground" />
                </div>
                <span className="truncate text-sm font-semibold">Frames</span>
              </div>
            ) : (
              <SearchForm className="min-w-0 flex-1" />
            ))}
          <SidebarTrigger className="size-8 shrink-0" />
        </SidebarHeader>
      }
      footer={
        <TooltipProvider>
          <div
            className={cn(
              "flex w-full items-center justify-between px-1",
              isCollapsed && "flex-col gap-1"
            )}
          >
            <div
              data-testid="sidebar-footer-actions"
              className={cn(
                "grid grid-cols-6 items-center justify-items-center gap-1",
                isCollapsed && "grid-cols-1"
              )}
            >
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
                    aria-label={
                      showGrid
                        ? t("sidebar.grid.hide")
                        : t("action.toggleGrid")
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
                    ? t("sidebar.grid.hide")
                    : t("action.toggleGrid")}
                </TooltipContent>
              </Tooltip>

              <HandbookDialog />

              <ClearCanvasDialog
                isCollapsed={isCollapsed}
                iconOnly
                label={
                  canvasMode === "animation"
                    ? t("sidebar.clear.frame")
                    : t("sidebar.clear.canvas")
                }
                description={
                  canvasMode === "animation"
                    ? t("sidebar.clear.frameDescription")
                    : t("sidebar.clear.canvasDescription")
                }
                onConfirm={clearCanvas}
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    tone="subtle"
                    shape="square"
                    size="md"
                    className="size-8 text-muted-foreground"
                    onClick={toggleLanguage}
                    aria-label={t("language.switch")}
                  >
                    <Languages className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {language === "en"
                    ? t("language.switchToChinese")
                    : t("language.switchToEnglish")}
                </TooltipContent>
              </Tooltip>
            </div>

            <div
              data-testid="sidebar-footer-github"
              className={cn("shrink-0", isCollapsed && "mt-1")}
            >
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
                    aria-label={t("action.openSourceCode")}
                  >
                    <Github className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {t("action.openSourceCode")}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      }
    >
      {canvasMode === "animation" ? (
        <AnimationSidebarContent />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {canvasMode === "structured" && !isCollapsed && (
            <div className="shrink-0 border-b px-2 pb-2 pt-1">
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
                      {t(tab.labelKey)}
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
          <ScrollArea className="min-h-0 min-w-0 flex-1">
            {canvasMode === "structured" ? (
              structuredSidebarTab === "template" ? (
                <StructuredTemplateLibrary
                  templates={STRUCTURED_PAGE_TEMPLATES}
                  query={structuredLibraryQuery}
                  emptyLabel={t("sidebar.empty.templates")}
                />
              ) : (
                <StructuredTemplateLibrary
                  templates={STRUCTURED_COMPONENT_TEMPLATES}
                  query={structuredLibraryQuery}
                  emptyLabel={t("sidebar.empty.components")}
                />
              )
            ) : (
              <CharLibrary />
            )}
          </ScrollArea>
        </div>
      )}
    </SidebarStandard>
  );
}



