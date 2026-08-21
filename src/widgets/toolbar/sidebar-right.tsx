"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type LucideIcon, X } from "lucide-react";
import {
  SidebarHeader,
  SidebarStandard,
  SidebarTrigger,
  useSidebar,
  cn,
  ContentScrollArea,
  Button,
  SurfaceContent,
  IconButton,
  Input,
  Surface,
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipTrigger,
} from "@chardesk/ui";
import { CharLibrary } from "@/widgets/character-library/char-library";
import { SearchForm } from "@/widgets/character-library/search-form";
import {
  useLibraryStore,
  type CharacterViewId,
} from "@/domains/character-library/public";
import { StructuredTemplateLibrary } from "./structured-template-library";
import { SlideAddButton, SlideNavigator } from "./slide-navigator";
import {
  STRUCTURED_COMPONENT_TEMPLATES,
  STRUCTURED_PAGE_TEMPLATES,
} from "@/domains/structured-content/public";
import { useCanvasState } from "@/domains/canvas/public";








import { useShallow } from "zustand/react/shallow";
import { useUiI18n } from "@/shared/i18n";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { isStaticGridMode } from "@/domains/sessions/public";
import { useOnboardingTour } from "@/widgets/onboarding/onboarding-context";

type StructuredSidebarTab = "template" | "components";
type SlideSidebarView = "slides" | CharacterViewId;

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
  const tooltipHandle = useMemo(
    () => TooltipCreateHandle<ReactNode>(),
    []
  );

  return (
    <Surface kind="embedded" asChild>
      <nav
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        data-onboarding-target={
          testIdPrefix === "character" ? "character-library" : undefined
        }
        data-testid={`${testIdPrefix}-view-rail-${orientation}`}
        className={cn(
          "flex p-[3px]",
          orientation === "vertical"
            ? "w-full flex-col items-center gap-1"
            : "w-full items-center justify-center gap-1"
        )}
      >
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = activeView === view.id;
        return (
          <TooltipTrigger
            key={view.id}
            handle={tooltipHandle}
            payload={view.label}
            render={
              <Button
                type="button"
                tone="subtle"
                shape="square"
                size="md"
                active={isActive}
                role="tab"
                aria-selected={isActive}
                aria-label={view.label}
                onClick={() => onSelect(view.id)}
              />
            }
            className={cn(
              "relative",
              orientation === "vertical"
                ? "after:absolute after:top-0 after:left-full after:h-full after:w-1 after:content-['']"
                : "after:absolute after:top-full after:left-0 after:h-1 after:w-full after:content-['']"
            )}
          >
            <Icon />
          </TooltipTrigger>
        );
      })}
      <Tooltip handle={tooltipHandle}>
        {({ payload }) => (
          <TooltipPopup
            side={orientation === "vertical" ? "right" : "bottom"}
          >
            {payload}
          </TooltipPopup>
        )}
      </Tooltip>
      </nav>
    </Surface>
  );
}

export function SidebarRight() {
  const canvasMode = useCanvasState((state) => state.canvasMode);

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
  const { phase: onboardingPhase } = useOnboardingTour();
  const [structuredSidebarTab, setStructuredSidebarTab] =
    useState<StructuredSidebarTab>("components");
  const [structuredLibraryQuery, setStructuredLibraryQuery] = useState("");
  const [activeCharacterView, setActiveCharacterView] =
    useState<CharacterViewId>("essentials");
  const [activeSlideView, setActiveSlideView] =
    useState<SlideSidebarView>("slides");
  const [unicodeQuery, setUnicodeQuery] = useState("");
  const structuredSearchRef = useRef<HTMLInputElement>(null);
  const characterViews: ReadonlyArray<SidebarView<CharacterViewId>> =
    CHARACTER_VIEWS.map((view) => ({
      id: view.id,
      label: t(view.labelKey),
      icon: view.icon,
    }));
  const activeCharacterViewMeta =
    characterViews.find((view) => view.id === activeCharacterView) ??
    characterViews[0];
  const slideViews: ReadonlyArray<SidebarView<SlideSidebarView>> = [
    { id: "slides", label: t("slide.sidebar.title"), icon: HOST_ICONOLOGY.canvasMode.slide },
    ...characterViews,
  ];
  const structuredViews = STRUCTURED_SIDEBAR_TABS.map((view) => ({
    id: view.id,
    label: t(view.labelKey),
    icon: view.icon,
  }));
  const activeStructuredViewMeta =
    structuredViews.find((view) => view.id === structuredSidebarTab) ??
    structuredViews[0];
  const orientation = isMobile ? "horizontal" : "vertical";
  const structuredLibrary =
    structuredSidebarTab === "template"
      ? {
          templates: STRUCTURED_PAGE_TEMPLATES,
          emptyLabel: t("sidebar.empty.templates"),
        }
      : {
          templates: STRUCTURED_COMPONENT_TEMPLATES,
          emptyLabel: t("sidebar.empty.components"),
        };

  useEffect(() => {
    if (!isStaticGridMode(canvasMode)) return;
    void loadMainPacks();
  }, [canvasMode, loadMainPacks]);

  useEffect(() => {
    if (onboardingPhase !== "character-library") return;
    setOpen(true);
  }, [onboardingPhase, setOpen]);

  useEffect(() => {
    if (onboardingPhase !== "preparing-template") return;
    const timeoutId = window.setTimeout(() => {
      setStructuredSidebarTab("components");
      setStructuredLibraryQuery("");
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [onboardingPhase, setOpen]);

  const selectCharacterView = (view: CharacterViewId) => {
    setActiveCharacterView(view);
    if (isCollapsed) setOpen(true);
  };

  const selectStructuredView = (view: StructuredSidebarTab) => {
    setStructuredSidebarTab(view);
    if (isCollapsed) setOpen(true);
  };

  const selectSlideView = (view: SlideSidebarView) => {
    setActiveSlideView(view);
    if (isCollapsed) setOpen(true);
  };

  function renderCharacterPanel(
    view: CharacterViewId,
    label: string
  ): ReactNode {
    return (
      <div
        role="tabpanel"
        aria-label={t("sidebar.characterPanel", {
          name: label,
        })}
      >
        <CharLibrary view={view} />
      </div>
    );
  }

  function renderSearchForm(view: CharacterViewId): ReactNode {
    return (
      <SearchForm
        view={view}
        unicodeQuery={unicodeQuery}
        unicodeLoading={unicodeSearchLoading}
        onUnicodeQueryChange={setUnicodeQuery}
        onUnicodeSubmit={() => void searchUnicode(unicodeQuery)}
        className="min-w-0 flex-1"
      />
    );
  }

  let viewRail: ReactNode;
  let viewContent: ReactNode;
  let headerContent: ReactNode;

  switch (canvasMode) {
    case "freeform":
      viewRail = (
        <SidebarViewRail
          views={characterViews}
          activeView={activeCharacterView}
          orientation={orientation}
          onSelect={selectCharacterView}
          ariaLabel={t("sidebar.characterViews")}
          testIdPrefix="character"
        />
      );
      viewContent = renderCharacterPanel(
        activeCharacterView,
        activeCharacterViewMeta.label
      );
      headerContent = renderSearchForm(activeCharacterView);
      break;
    case "structured":
      viewRail = (
        <SidebarViewRail
          views={structuredViews}
          activeView={structuredSidebarTab}
          orientation={orientation}
          onSelect={selectStructuredView}
          ariaLabel={t("sidebar.structuredViews")}
          testIdPrefix="structured"
        />
      );
      viewContent = (
        <SurfaceContent
          role="tabpanel"
          aria-label={activeStructuredViewMeta.label}
        >
          <StructuredTemplateLibrary
            templates={structuredLibrary.templates}
            query={structuredLibraryQuery}
            emptyLabel={structuredLibrary.emptyLabel}
          />
        </SurfaceContent>
      );
      headerContent = (
        <div className="relative min-w-0 flex-1">
          <Input
            ref={structuredSearchRef}
            type="search"
            aria-label={t("sidebar.search.structured")}
            value={structuredLibraryQuery}
            onChange={(event) => setStructuredLibraryQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape" || !structuredLibraryQuery) return;
              event.preventDefault();
              event.stopPropagation();
              setStructuredLibraryQuery("");
            }}
            placeholder={t("sidebar.search.placeholder")}
            appearance="search"
            className={cn(
              "h-8 w-full px-2 pr-9 [&::-webkit-search-cancel-button]:hidden"
            )}
          />
          {structuredLibraryQuery ? (
            <IconButton
              type="button"
              size="xs"
              aria-label={t("search.clear")}
              onClick={() => {
                setStructuredLibraryQuery("");
                structuredSearchRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <X />
            </IconButton>
          ) : null}
        </div>
      );
      break;
    case "slide": {
      viewRail = (
        <SidebarViewRail
          views={slideViews}
          activeView={activeSlideView}
          orientation={orientation}
          onSelect={selectSlideView}
          ariaLabel={t("slide.sidebar.title")}
          testIdPrefix="slide"
        />
      );
      if (activeSlideView === "slides") {
        viewContent = <SlideNavigator />;
        headerContent = <SlideAddButton />;
        break;
      }
      const activeSlideViewMeta = slideViews.find(
        (view) => view.id === activeSlideView
      );
      viewContent = renderCharacterPanel(
        activeSlideView,
        activeSlideViewMeta?.label ?? ""
      );
      headerContent = renderSearchForm(activeSlideView);
      break;
    }
  }

  const sidebarBody = (
    <div
      data-testid="sidebar-mode-layout"
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-hidden",
        isMobile
          ? "flex flex-col"
          : "grid grid-cols-[var(--sidebar-width-icon)_minmax(0,1fr)]"
      )}
    >
      <div
        data-testid="sidebar-view-rail-column"
        className={cn(
          "shrink-0",
          isMobile
            ? "p-1 pb-0"
            : "col-start-1 row-start-1 px-0 py-1"
        )}
      >
        {viewRail}
      </div>
      <ContentScrollArea
        data-testid="sidebar-view-content"
        aria-hidden={isCollapsed || undefined}
        inert={isCollapsed || undefined}
        viewportClassName={!isMobile ? "[&>div]:!block" : undefined}
        contentClassName={!isMobile ? "min-w-0 pr-1" : undefined}
        className={cn(
          "min-h-0 min-w-0 flex-1 transition-opacity duration-[var(--motion-standard)] motion-reduce:transition-none",
          !isMobile && "col-start-2 row-start-1",
          isCollapsed
            ? "pointer-events-none opacity-0"
            : "opacity-100"
        )}
      >
        {viewContent}
      </ContentScrollArea>
    </div>
  );

  return (
    <SidebarStandard
      variant="floating"
      side="right"
      collapsedAppearance="trigger"
      contentScroll="none"
      className="pointer-events-auto"
      data-canvas-ui="true"
      contentClassName="min-h-0 gap-0 overflow-hidden p-0"
      header={
        <SidebarHeader
          className={cn(
            "h-12 shrink-0 items-center py-0",
            isMobile
              ? "flex flex-row gap-2 px-3"
              : "grid grid-cols-[var(--sidebar-width-icon)_minmax(0,1fr)] gap-0 px-0"
          )}
        >
          <div
            data-testid="sidebar-header-content"
            aria-hidden={isCollapsed || undefined}
            inert={isCollapsed || undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center overflow-hidden py-px transition-[opacity,transform] duration-[var(--motion-standard)] ease-out motion-reduce:transition-none motion-reduce:transform-none",
              !isMobile && "col-start-2 row-start-1 pl-2 pr-3",
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
              !isMobile && "col-start-1 row-start-1",
              isCollapsed && "pointer-events-auto"
            )}
          >
            <SidebarTrigger
              side="right"
              aria-label={t("sidebar.toggle")}
              className="shrink-0"
            />
          </div>
        </SidebarHeader>
      }
    >
      {sidebarBody}
    </SidebarStandard>
  );
}
