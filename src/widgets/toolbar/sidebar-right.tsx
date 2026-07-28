"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import {
  Boxes,
  Clapperboard,
  Eye,
  EyeOff,
  Github,
  Languages,
  LayoutTemplate,
  Library,
  Map,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import {
  SidebarHeader,
  SidebarStandard,
  SidebarTrigger,
  useSidebar,
} from "@/shared/ui/sidebar";
import { CharLibrary } from "@/widgets/character-library/char-library";
import { SearchForm } from "@/widgets/character-library/search-form";
import {
  useLibraryStore,
  type CharacterViewId,
} from "@/domains/character-library/public";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { ExportDialog } from "@/widgets/export/export-dialog";
import { ImportButton } from "@/widgets/import/ImportButton";
import { HandbookDialog, ClearCanvasDialog } from "@/widgets/dialogs";
import { useShallow } from "zustand/react/shallow";
import { useUiI18n } from "@/shared/i18n";
import { uiClass } from "@/shared/styles/components";
import { AnimationSidebarContent } from "./animation-sidebar-content";
import { Minimap } from "@/widgets/canvas-editor/Minimap";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";

type StructuredSidebarTab = "template" | "components";

const STRUCTURED_SIDEBAR_TABS: Array<{
  id: StructuredSidebarTab;
  labelKey: "sidebar.tab.template" | "sidebar.tab.components";
  icon: LucideIcon;
}> = [
  {
    id: "template",
    labelKey: "sidebar.tab.template",
    icon: LayoutTemplate,
  },
  {
    id: "components",
    labelKey: "sidebar.tab.components",
    icon: Boxes,
  },
];

type SidebarView<ViewId extends string> = {
  id: ViewId;
  label: string;
  icon: LucideIcon;
};

const CHARACTER_VIEWS = [
  { id: "essentials", label: "Essentials", icon: Library },
  { id: "nerd", label: "Nerd Icons", icon: Terminal },
  { id: "emoji", label: "Emoji", icon: Sparkles },
  { id: "unicode", label: "Unicode", icon: Languages },
] as const satisfies ReadonlyArray<SidebarView<CharacterViewId>>;

function SidebarViewRail<ViewId extends string>({
  views,
  activeView,
  orientation,
  onSelect,
  ariaLabel,
  testIdPrefix,
}: {
  views: ReadonlyArray<SidebarView<ViewId>>;
  activeView: ViewId;
  orientation: "horizontal" | "vertical";
  onSelect: (view: ViewId) => void;
  ariaLabel: string;
  testIdPrefix: string;
}) {
  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      data-testid={`${testIdPrefix}-view-rail-${orientation}`}
      className={cn(
        "flex rounded-lg bg-muted p-[3px]",
        orientation === "vertical"
          ? "w-full flex-col gap-1"
          : "w-full items-center gap-1"
      )}
    >
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        return (
          <Tooltip key={view.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={view.label}
                onClick={() => onSelect(view.id)}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                  uiClass.hostControl,
                  orientation === "horizontal" && "flex-1",
                  isActive && "bg-accent text-foreground"
                )}
              >
                <Icon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={orientation === "vertical" ? "left" : "bottom"}>
              {view.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

type SidebarRightProps = {
  containerSize?: { width: number; height: number };
};

const FOOTER_FADE_OUT_MS = 90;

function SidebarFooterAction({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center">
      {children}
    </div>
  );
}

export function SidebarRight({ containerSize }: SidebarRightProps) {
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

  const { loadMainPacks, searchUnicode, unicodeSearchLoading } =
    useLibraryStore(
      useShallow((library) => ({
        loadMainPacks: library.loadMainPacks,
        searchUnicode: library.searchUnicode,
        unicodeSearchLoading: library.unicodeSearchLoading,
      }))
    );
  const { state, isMobile, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const shouldReduceMotion = useReducedMotion();
  const { language, t, toggleLanguage } = useUiI18n();
  const [structuredSidebarTab, setStructuredSidebarTab] =
    useState<StructuredSidebarTab>("components");
  const [structuredLibraryQuery, setStructuredLibraryQuery] = useState("");
  const [activeCharacterView, setActiveCharacterView] =
    useState<CharacterViewId>("essentials");
  const [unicodeQuery, setUnicodeQuery] = useState("");
  const [footerLayoutCollapsed, setFooterLayoutCollapsed] =
    useState(isCollapsed);
  const footerIsTransitioning = footerLayoutCollapsed !== isCollapsed;
  const isFooterVisible = shouldReduceMotion || !footerIsTransitioning;
  const effectiveFooterLayoutCollapsed = shouldReduceMotion
    ? isCollapsed
    : footerLayoutCollapsed;
  const footerTooltipSide = effectiveFooterLayoutCollapsed ? "left" : "top";
  const activeCharacterViewMeta =
    CHARACTER_VIEWS.find((view) => view.id === activeCharacterView) ??
    CHARACTER_VIEWS[0];
  const structuredViews = STRUCTURED_SIDEBAR_TABS.map((view) => ({
    id: view.id,
    label: t(view.labelKey),
    icon: view.icon,
  }));
  const activeStructuredViewMeta =
    structuredViews.find((view) => view.id === structuredSidebarTab) ??
    structuredViews[0];

  useEffect(() => {
    if (!footerIsTransitioning) return;

    const timeout = window.setTimeout(
      () => {
        setFooterLayoutCollapsed(isCollapsed);
      },
      shouldReduceMotion ? 0 : FOOTER_FADE_OUT_MS
    );

    return () => window.clearTimeout(timeout);
  }, [footerIsTransitioning, isCollapsed, shouldReduceMotion]);

  useEffect(() => {
    if (canvasMode !== "freeform") return;
    void loadMainPacks();
  }, [canvasMode, loadMainPacks]);

  const stopCanvasUiEvent = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  const selectCharacterView = (view: CharacterViewId) => {
    setActiveCharacterView(view);
    if (isCollapsed) setOpen(true);
  };

  const selectStructuredView = (view: StructuredSidebarTab) => {
    setStructuredSidebarTab(view);
    if (isCollapsed) setOpen(true);
  };

  const viewRail =
    canvasMode === "freeform" ? (
      <SidebarViewRail
        views={CHARACTER_VIEWS}
        activeView={activeCharacterView}
        orientation={isMobile ? "horizontal" : "vertical"}
        onSelect={selectCharacterView}
        ariaLabel="Character library views"
        testIdPrefix="character"
      />
    ) : canvasMode === "structured" ? (
      <SidebarViewRail
        views={structuredViews}
        activeView={structuredSidebarTab}
        orientation={isMobile ? "horizontal" : "vertical"}
        onSelect={selectStructuredView}
        ariaLabel="Structured library views"
        testIdPrefix="structured"
      />
    ) : null;

  const viewContent =
    canvasMode === "freeform" ? (
      <div
        role="tabpanel"
        aria-label={`${activeCharacterViewMeta.label} characters`}
      >
        <CharLibrary view={activeCharacterView} />
      </div>
    ) : canvasMode === "structured" ? (
      <div
        role="tabpanel"
        aria-label={activeStructuredViewMeta.label}
        className="p-2"
      >
        {structuredSidebarTab === "template" ? (
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
        )}
      </div>
    ) : null;

  const sidebarBody =
    canvasMode === "animation" ? (
      <AnimationSidebarContent />
    ) : (
      <div
        data-testid="sidebar-mode-layout"
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-hidden",
          isMobile
            ? "flex flex-col"
            : "grid grid-cols-[minmax(0,1fr)_3rem]"
        )}
      >
        <div
          data-testid="sidebar-view-rail-column"
          className={cn(
            "shrink-0",
            isMobile
              ? "p-1 pb-0"
              : "col-start-2 row-start-1 px-[3px] py-1"
          )}
        >
          {viewRail}
        </div>
        <ScrollArea
          data-testid="sidebar-view-content"
          aria-hidden={isCollapsed || undefined}
          inert={isCollapsed || undefined}
          className={cn(
            "min-h-0 min-w-0 flex-1 transition-opacity duration-200",
            !isMobile && "col-start-1 row-start-1",
            isCollapsed
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          )}
        >
          {viewContent}
        </ScrollArea>
      </div>
    );

  const headerContent =
    canvasMode === "structured" ? (
      <input
        type="search"
        aria-label={t("sidebar.search.structured")}
        value={structuredLibraryQuery}
        onChange={(event) => setStructuredLibraryQuery(event.target.value)}
        placeholder={t("sidebar.search.placeholder")}
        className={cn(
          "h-8 min-w-0 flex-1 rounded-md border-0 bg-accent/60 px-2 text-xs outline-none",
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
      <SearchForm
        view={activeCharacterView}
        unicodeQuery={unicodeQuery}
        unicodeLoading={unicodeSearchLoading}
        onUnicodeQueryChange={setUnicodeQuery}
        onUnicodeSubmit={() => void searchUnicode(unicodeQuery)}
        className="min-w-0 flex-1"
      />
    );

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
        canvasMode !== "animation" && "[scrollbar-gutter:auto]",
        canvasMode === "freeform" && "gap-0 p-0",
        canvasMode === "structured" && "gap-0 p-0",
        canvasMode === "animation" && "p-2"
      )}
      collapsedContent={canvasMode === "animation" ? undefined : sidebarBody}
      header={
        <SidebarHeader
          className={cn(
            "h-12 shrink-0 items-center py-0",
            isMobile
              ? "flex flex-row gap-2 px-3"
              : "grid grid-cols-[minmax(0,1fr)_3rem] gap-0 px-0"
          )}
        >
          <div
            data-testid="sidebar-header-content"
            aria-hidden={isCollapsed || undefined}
            inert={isCollapsed || undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center overflow-hidden transition-opacity duration-200",
              !isMobile && "pl-3 pr-2",
              isCollapsed
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            )}
          >
            {headerContent}
          </div>
          <div
            data-testid="sidebar-toggle-column"
            className={cn(
              "flex h-full items-center justify-center",
              !isMobile && "col-start-2 row-start-1"
            )}
          >
            <SidebarTrigger className="size-8 shrink-0" />
          </div>
        </SidebarHeader>
      }
      footer={
        <div
          data-testid="sidebar-footer-layout"
          data-layout={
            effectiveFooterLayoutCollapsed ? "collapsed" : "expanded"
          }
          aria-hidden={!isFooterVisible || undefined}
          inert={!isFooterVisible || undefined}
          className={cn(
            "flex w-full items-center justify-between px-1 transition-opacity ease-linear motion-reduce:transition-none",
            effectiveFooterLayoutCollapsed && "flex-col gap-1",
            isFooterVisible
              ? "opacity-100 duration-[110ms]"
              : "pointer-events-none opacity-0 duration-[90ms]"
          )}
        >
          <div
            className={cn(
              "grid items-center justify-items-center gap-1",
              canvasMode === "animation" ? "grid-cols-6" : "grid-cols-7",
              effectiveFooterLayoutCollapsed && "grid-cols-1"
            )}
            data-testid="sidebar-footer-actions"
          >
              <SidebarFooterAction>
                <ImportButton tooltipSide={footerTooltipSide} />
              </SidebarFooterAction>

              <SidebarFooterAction>
                <ExportDialog
                  grid={grid}
                  canvasMode={canvasMode}
                  structuredScene={structuredScene}
                  structuredComponents={structuredComponents}
                  canvasBounds={canvasBounds}
                  animationTimeline={animationTimeline}
                  exportShowGrid={exportShowGrid}
                  setExportShowGrid={setExportShowGrid}
                  tooltipSide={footerTooltipSide}
                />
              </SidebarFooterAction>

              <SidebarFooterAction>
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
                  <TooltipContent side={footerTooltipSide}>
                    {showGrid
                      ? t("sidebar.grid.hide")
                      : t("action.toggleGrid")}
                  </TooltipContent>
                </Tooltip>
              </SidebarFooterAction>

              {canvasMode !== "animation" && (
                <SidebarFooterAction>
                  <Popover key={canvasMode}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <PopoverTrigger asChild>
                            <Button
                              tone="subtle"
                              shape="square"
                              size="md"
                              className={cn(
                                "size-8 text-muted-foreground transition-colors",
                                "data-[state=open]:bg-accent data-[state=open]:text-foreground"
                              )}
                              aria-label={t("sidebar.minimap")}
                            >
                              <Map className="size-4" />
                            </Button>
                          </PopoverTrigger>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side={footerTooltipSide}>
                        {t("sidebar.minimap")}
                      </TooltipContent>
                    </Tooltip>
                    <PopoverContent
                      side="left"
                      align="end"
                      sideOffset={8}
                      className="w-auto overflow-hidden rounded-lg border-0 bg-muted p-0 shadow-none"
                    >
                      <Minimap containerSize={containerSize} />
                    </PopoverContent>
                  </Popover>
                </SidebarFooterAction>
              )}

              <SidebarFooterAction>
                <HandbookDialog tooltipSide={footerTooltipSide} />
              </SidebarFooterAction>

              <SidebarFooterAction>
                <ClearCanvasDialog
                  isCollapsed={effectiveFooterLayoutCollapsed}
                  iconOnly
                  label={
                    canvasMode === "animation"
                      ? t("sidebar.clear.frame")
                      : t("sidebar.clear.canvas")
                  }
                  tooltipSide={footerTooltipSide}
                  description={
                    canvasMode === "animation"
                      ? t("sidebar.clear.frameDescription")
                      : t("sidebar.clear.canvasDescription")
                  }
                  onConfirm={clearCanvas}
                />
              </SidebarFooterAction>

              <SidebarFooterAction>
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
                  <TooltipContent side={footerTooltipSide}>
                    {language === "en"
                      ? t("language.switchToChinese")
                      : t("language.switchToEnglish")}
                  </TooltipContent>
                </Tooltip>
              </SidebarFooterAction>
            </div>

            <div
              data-testid="sidebar-footer-github"
              className={cn(
                "shrink-0",
                effectiveFooterLayoutCollapsed && "mt-1"
              )}
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
                <TooltipContent side={footerTooltipSide}>
                  {t("action.openSourceCode")}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
      }
    >
      {sidebarBody}
    </SidebarStandard>
  );
}
