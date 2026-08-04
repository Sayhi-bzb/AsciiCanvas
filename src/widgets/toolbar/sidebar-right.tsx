"use client";

import { useEffect, useState } from "react";
import { type LucideIcon } from "lucide-react";
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
import { cn } from "@/shared/lib/utils";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { useShallow } from "zustand/react/shallow";
import { useUiI18n } from "@/shared/i18n";
import { uiClass } from "@/shared/styles/components";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";

type StructuredSidebarTab = "template" | "components";

const STRUCTURED_SIDEBAR_TABS: Array<{
  id: StructuredSidebarTab;
  labelKey: "sidebar.tab.template" | "sidebar.tab.components";
  icon: LucideIcon;
}> = [
  {
    id: "template",
    labelKey: "sidebar.tab.template",
    icon: HOST_ICONOLOGY.structuredView.template,
  },
  {
    id: "components",
    labelKey: "sidebar.tab.components",
    icon: HOST_ICONOLOGY.structuredView.components,
  },
];

type SidebarView<ViewId extends string> = {
  id: ViewId;
  label: string;
  icon: LucideIcon;
};

const CHARACTER_VIEWS = [
  { id: "essentials", labelKey: "character.view.essentials", icon: HOST_ICONOLOGY.characterView.essentials },
  { id: "nerd", labelKey: "character.view.nerd", icon: HOST_ICONOLOGY.characterView.nerd },
  { id: "emoji", labelKey: "character.view.emoji", icon: HOST_ICONOLOGY.characterView.emoji },
  { id: "unicode", labelKey: "character.view.unicode", icon: HOST_ICONOLOGY.characterView.unicode },
] as const;

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
        uiClass.iconRail,
        orientation === "vertical"
          ? "w-full flex-col gap-1"
          : "w-full items-center justify-center gap-1"
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
                  uiClass.iconRailItem,
                  isActive && uiClass.hostControlActive
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

export function SidebarRight() {
  const canvasMode = useEditorStore((state) => state.canvasMode);

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
  const { t } = useUiI18n();
  const [structuredSidebarTab, setStructuredSidebarTab] =
    useState<StructuredSidebarTab>("components");
  const [structuredLibraryQuery, setStructuredLibraryQuery] = useState("");
  const [activeCharacterView, setActiveCharacterView] =
    useState<CharacterViewId>("essentials");
  const [unicodeQuery, setUnicodeQuery] = useState("");
  const characterViews: ReadonlyArray<SidebarView<CharacterViewId>> =
    CHARACTER_VIEWS.map((view) => ({
      id: view.id,
      label: t(view.labelKey),
      icon: view.icon,
    }));
  const activeCharacterViewMeta =
    characterViews.find((view) => view.id === activeCharacterView) ??
    characterViews[0];
  const structuredViews = STRUCTURED_SIDEBAR_TABS.map((view) => ({
    id: view.id,
    label: t(view.labelKey),
    icon: view.icon,
  }));
  const activeStructuredViewMeta =
    structuredViews.find((view) => view.id === structuredSidebarTab) ??
    structuredViews[0];

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
        views={characterViews}
        activeView={activeCharacterView}
        orientation={isMobile ? "horizontal" : "vertical"}
        onSelect={selectCharacterView}
        ariaLabel={t("sidebar.characterViews")}
        testIdPrefix="character"
      />
    ) : canvasMode === "structured" ? (
      <SidebarViewRail
        views={structuredViews}
        activeView={structuredSidebarTab}
        orientation={isMobile ? "horizontal" : "vertical"}
        onSelect={selectStructuredView}
        ariaLabel={t("sidebar.structuredViews")}
        testIdPrefix="structured"
      />
    ) : null;

  const viewContent =
    canvasMode === "freeform" ? (
      <div
        role="tabpanel"
        aria-label={t("sidebar.characterPanel", {
          name: activeCharacterViewMeta.label,
        })}
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

  const sidebarBody = (
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
      collapsedAppearance="trigger"
      className="pointer-events-auto"
      data-canvas-ui="true"
      onPointerDown={stopCanvasUiEvent}
      onMouseDown={stopCanvasUiEvent}
      onClick={stopCanvasUiEvent}
      onContextMenu={stopCanvasUiEvent}
      contentClassName={cn(
        "min-h-0 overflow-hidden",
        "[scrollbar-gutter:auto]",
        canvasMode === "freeform" && "gap-0 p-0",
        canvasMode === "structured" && "gap-0 p-0",
        !isMobile && "pb-12"
      )}
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
              "flex min-w-0 flex-1 items-center overflow-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none",
              !isMobile && "pl-3 pr-2",
              isCollapsed
                ? "pointer-events-none translate-x-2 opacity-0"
                : "translate-x-0 opacity-100 delay-[60ms]"
            )}
          >
            {headerContent}
          </div>
          <div
            data-testid="sidebar-toggle-column"
            className={cn(
              "flex h-full items-center justify-center",
              !isMobile && "col-start-2 row-start-1",
              isCollapsed && "pointer-events-auto"
            )}
          >
            <SidebarTrigger side="right" className="shrink-0" />
          </div>
        </SidebarHeader>
      }
    >
      {sidebarBody}
    </SidebarStandard>
  );
}
