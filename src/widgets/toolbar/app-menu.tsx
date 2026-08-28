"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  createGridSurfaceReader,
  materializeSlideDeckContent,
  useCanvasRuntime,
  useCanvasState,
} from "@/domains/canvas/public";
import {
  getAvailableExportFormats,
  type ExportContext,
  type ExportFormat,
} from "@/domains/export/public";
import {
  Button,
  StatusText,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@chardesk/ui";


import { useUiI18n } from "@/shared/i18n";
import { useCanvasImport } from "@/widgets/import/useCanvasImport";
import {
  useAppMenuExport,
  type AppMenuExportErrorCode,
} from "@/widgets/export/use-app-menu-export";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { useInPlaceFeedback } from "@/shared/hooks/use-in-place-feedback";
import { browser } from "@/shared/services/effects";
import { APP_SOURCE_URL } from "@/shared/lib/constants";
import { useGitHubStars } from "./use-github-stars";
import { useCanvasWorkspaceOptional } from "@/widgets/canvas-editor/engine/CanvasWorkspace";
import { useOnboardingTour } from "@/widgets/onboarding/onboarding-context";
import { useEditorPresentation } from "@/widgets/editor-chrome/public";
import { RecoverableLazyBoundary } from "@/shared/components/RecoverableLazyBoundary";
import { requireLoadedModule } from "@/shared/lib/moduleLoadRecovery";

const AppMenuTriggerIcon = HOST_ICONOLOGY.appMenu.trigger;
const FileIcon = HOST_ICONOLOGY.appMenu.file;
const ImportIcon = HOST_ICONOLOGY.appMenu.import;
const ExportIcon = HOST_ICONOLOGY.appMenu.export;
const SplitViewIcon = HOST_ICONOLOGY.appMenu.splitView;
const ZenModeIcon = HOST_ICONOLOGY.appMenu.zenMode;
const HelpIcon = HOST_ICONOLOGY.appMenu.help;
const GuideIcon = HOST_ICONOLOGY.appMenu.guide;
const DocumentationIcon = HOST_ICONOLOGY.appMenu.documentation;
const GitHubIcon = HOST_ICONOLOGY.appMenu.github;
const GitHubStarIcon = HOST_ICONOLOGY.appMenu.githubStar;
const SettingsIcon = HOST_ICONOLOGY.appMenu.settings;
const ClearIcon = HOST_ICONOLOGY.appMenu.clear;
type ExportFeedbackTarget = {
  format: ExportFormat;
  errorCode?: AppMenuExportErrorCode;
};
const ClearCanvasDialog = lazy(() =>
  import("@/widgets/dialogs/clear-canvas-dialog").then((loaded) => ({
    default: requireLoadedModule(loaded).ClearCanvasDialog,
  }))
);
const SettingsDialog = lazy(() =>
  import("@/widgets/dialogs/settings-dialog").then((loaded) => ({
    default: requireLoadedModule(loaded).SettingsDialog,
  }))
);

export function AppMenu() {
  const canvas = useCanvasRuntime();
  const workspace = useCanvasWorkspaceOptional();
  const { mode, setMode } = useEditorPresentation();
  const zenMode = mode === "zen";
  const {
    grid,
    canvasMode,
    slideDeck,
    structuredScene,
    structuredComponents,
    canvasSessions,
    activeCanvasId,
  } = useCanvasState(
    useShallow((state) => ({
      grid: state.grid,
      canvasMode: state.canvasMode,
      slideDeck: state.slideDeck,
      structuredScene: state.structuredScene,
      structuredComponents: state.structuredComponents,
      canvasSessions: state.canvasSessions,
      activeCanvasId: state.activeCanvasId,
    }))
  );
  const clearCanvas = canvas.commands.grid.clear;
  const documentName = canvasSessions.find(
    (session) => session.id === activeCanvasId
  )?.name;
  const { t } = useUiI18n();
  const { canStart: canStartTour, requestStart: requestTourStart } =
    useOnboardingTour();
  const {
    directoryInputRef,
    fileInputRef,
    handleBlackboardDirectoryChange,
    handleFileChange,
    isImporting,
    openBlackboardPicker,
    openFilePicker,
  } = useCanvasImport();
  const [clearOpen, setClearOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const githubStars = useGitHubStars(APP_SOURCE_URL, menuOpen);
  const formattedGitHubStars = useMemo(
    () =>
      githubStars === null ? null : new Intl.NumberFormat().format(githubStars),
    [githubStars]
  );
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const clearLabel = t("sidebar.clear.canvas");
  const clearDescription = t("sidebar.clear.canvasDescription");
  const exportLabel = t("appMenu.export");
  const availableExportFormats = useMemo(
    () => getAvailableExportFormats(canvasMode),
    [canvasMode]
  );
  const exportContext = useMemo<ExportContext>(
    () => ({
      canvasMode,
      surface:
        canvasMode === "structured"
          ? createGridSurfaceReader(grid)
          : canvas.documents.getContentReader(),
      slideDeck: slideDeck
        ? materializeSlideDeckContent(
            canvas.documents,
            activeCanvasId,
            slideDeck
          )
        : null,
      documentName,
      structuredScene,
      structuredComponents,
      includeColor: true,
      showGrid: false,
    }),
    [
      canvasMode,
      canvas.documents,
      activeCanvasId,
      documentName,
      grid,
      slideDeck,
      structuredComponents,
      structuredScene,
    ]
  );
  const exportActions = useAppMenuExport(exportContext);
  const {
    feedback: exportFeedback,
    run: runExportFeedback,
    clear: clearExportFeedback,
  } = useInPlaceFeedback<ExportFeedbackTarget>({ errorDurationMs: 4000 });
  const exportErrorDescription =
    exportFeedback?.status === "error"
      ? exportFeedback.target.errorCode === "image-too-large"
        ? t("export.imageTooLargeDescription")
        : t("export.saveFailedDescription", {
            format: exportFeedback.target.format.toUpperCase(),
          })
      : null;

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnWindowBlur = () => setMenuOpen(false);
    window.addEventListener("blur", closeOnWindowBlur);
    return () => window.removeEventListener("blur", closeOnWindowBlur);
  }, [menuOpen]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".chardesk,.slides.md,.ans,.txt"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />
      <input
        ref={(input) => {
          directoryInputRef.current = input;
          if (input) input.webkitdirectory = true;
        }}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleBlackboardDirectoryChange}
      />

      <div
        data-canvas-ui="true"
        data-testid="app-menu-host"
        className="relative z-(--layer-chrome) pointer-events-auto"
      >
            <DropdownMenu
              key={mode}
              modal={false}
              open={menuOpen}
              onOpenChange={(open) => {
                setMenuOpen(open);
                if (!open) clearExportFeedback();
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  ref={menuTriggerRef}
                  tone="subtle"
                  shape="square"
                  size="md"
                  aria-label={t("appMenu.open")}
                >
                  <AppMenuTriggerIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                className="w-48"
                aria-label={t("appMenu.open")}
              >
                <DropdownMenuGroup>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FileIcon />
                      {t("appMenu.file")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-40" aria-label={t("appMenu.file")}>
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          disabled={isImporting}
                          onSelect={openFilePicker}
                        >
                          <ImportIcon />
                          {isImporting ? t("import.importing") : t("appMenu.importFile")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isImporting}
                          onSelect={openBlackboardPicker}
                        >
                          <FileIcon />
                          {t("appMenu.importBlackboard")}
                        </DropdownMenuItem>
                        {availableExportFormats.length > 0 && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <ExportIcon />
                              {exportLabel}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-40" aria-label={exportLabel}>
                              <DropdownMenuGroup>
                                {availableExportFormats.map((definition) => (
                                  <DropdownMenuItem
                                    key={definition.format}
                                    feedback={
                                      exportFeedback?.target.format === definition.format
                                        ? exportFeedback.status
                                        : undefined
                                    }
                                    data-export-feedback={
                                      exportFeedback?.target.format === definition.format
                                        ? exportFeedback.status
                                        : undefined
                                    }
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      void runExportFeedback(
                                        { format: definition.format },
                                        async () => {
                                          const result = await exportActions.save(definition.format);
                                          return result.ok
                                            ? true
                                            : {
                                                success: false,
                                                target: {
                                                  format: definition.format,
                                                  errorCode: result.errorCode,
                                                },
                                              };
                                        }
                                      );
                                    }}
                                  >
                                    {definition.label}
                                    {exportFeedback?.target.format === definition.format &&
                                    exportFeedback.status === "success" ? (
                                      <span className="ml-auto">
                                        <Check />
                                      </span>
                                    ) : exportFeedback?.target.format === definition.format &&
                                      exportFeedback.status === "error" ? (
                                      <span className="ml-auto">
                                        <X />
                                      </span>
                                    ) : null}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuGroup>
                              {exportErrorDescription ? (
                                <StatusText tone="error" asChild>
                                  <div role="alert" className="px-2 py-1.5 text-[11px] leading-4">
                                    <div className="font-medium">{t("export.saveFailed")}</div>
                                    <div>{exportErrorDescription}</div>
                                  </div>
                                </StatusText>
                              ) : null}
                              <span role="status" className="sr-only">
                                {exportFeedback?.status === "success"
                                  ? t("export.saved", {
                                      format: exportFeedback.target.format.toUpperCase(),
                                    })
                                  : ""}
                              </span>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setClearOpen(true)}
                        >
                          <ClearIcon />
                          {t("appMenu.clear")}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  {workspace && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setMenuOpen(false);
                        window.setTimeout(
                          () => workspace.setSplitEnabled(!workspace.splitEnabled),
                          0
                        );
                      }}
                    >
                      <SplitViewIcon />
                      {workspace.splitEnabled
                        ? t("action.closeSplitView")
                        : t("action.splitView")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={() => {
                      setMenuOpen(false);
                      window.setTimeout(
                        () => setMode(zenMode ? "standard" : "zen"),
                        0
                      );
                    }}
                  >
                    <ZenModeIcon />
                    {t(zenMode ? "appMenu.exitZenMode" : "appMenu.zenMode")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setMenuOpen(false);
                      window.setTimeout(() => setSettingsOpen(true), 0);
                    }}
                  >
                    <SettingsIcon />
                    {t("appMenu.settings")}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <HelpIcon />
                      {t("appMenu.help")}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48" aria-label={t("appMenu.help")}>
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          disabled={!canStartTour}
                          onSelect={() => {
                            setMenuOpen(false);
                            if (zenMode) setMode("standard");
                            window.setTimeout(requestTourStart, 0);
                          }}
                        >
                          <GuideIcon />
                          {t("appMenu.guide")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => browser.openExternal("/docs")}
                        >
                          <DocumentationIcon />
                          {t("appMenu.documentation")}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    onSelect={() => browser.openExternal(APP_SOURCE_URL)}
                  >
                    <GitHubIcon />
                    {t("appMenu.github")}
                    {formattedGitHubStars !== null && (
                      <span className="ml-auto flex items-center gap-1 tabular-nums text-muted-foreground">
                        <GitHubStarIcon />
                        {formattedGitHubStars}
                      </span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
      </div>

      <RecoverableLazyBoundary
        resetKey={`${clearOpen}:${settingsOpen}`}
        onError={() => {
          setClearOpen(false);
          setSettingsOpen(false);
        }}
      >
        <Suspense fallback={null}>
          {clearOpen && (
            <ClearCanvasDialog
              isCollapsed={false}
              label={clearLabel}
              description={clearDescription}
              onConfirm={clearCanvas}
              open={clearOpen}
              onOpenChange={setClearOpen}
              trigger={null}
            />
          )}
          {settingsOpen && (
            <SettingsDialog
              open={settingsOpen}
              onOpenChange={(open) => {
                setSettingsOpen(open);
                if (!open) {
                  window.setTimeout(() => menuTriggerRef.current?.focus(), 0);
                }
              }}
            />
          )}
        </Suspense>
      </RecoverableLazyBoundary>
    </>
  );
}
