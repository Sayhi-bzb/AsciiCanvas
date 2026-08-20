"use client";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useCanvasRuntime, useCanvasState } from "@/domains/canvas/public";
import {
  getAvailableExportFormats,
  type ExportContext,
  type ExportFormat,
} from "@/domains/export/public";
import { Button } from "@/shared/ui/button";
import { StatusText } from "@/shared/ui/status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
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

const AppMenuTriggerIcon = HOST_ICONOLOGY.appMenu.trigger;
const ImportIcon = HOST_ICONOLOGY.appMenu.import;
const ExportIcon = HOST_ICONOLOGY.appMenu.export;
const GitHubIcon = HOST_ICONOLOGY.appMenu.github;
const GitHubStarIcon = HOST_ICONOLOGY.appMenu.githubStar;
const SettingsIcon = HOST_ICONOLOGY.appMenu.settings;
const ClearIcon = HOST_ICONOLOGY.appMenu.clear;
type ExportFeedbackTarget = {
  format: ExportFormat;
  errorCode?: AppMenuExportErrorCode;
};
const ClearCanvasDialog = lazy(() =>
  import("@/widgets/dialogs/clear-canvas-dialog").then((module) => ({
    default: module.ClearCanvasDialog,
  }))
);
const SettingsDialog = lazy(() =>
  import("@/widgets/dialogs/settings-dialog").then((module) => ({
    default: module.SettingsDialog,
  }))
);
export function AppMenu() {
  const canvas = useCanvasRuntime();
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
  const {
    fileInputRef,
    handleFileChange,
    isImporting,
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
      grid,
      slideDeck,
      documentName,
      structuredScene,
      structuredComponents,
      includeColor: true,
      showGrid: false,
    }),
    [
      canvasMode,
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
        accept=".chardesk,.md,text/markdown,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      <div
        data-canvas-ui="true"
        data-testid="app-menu-host"
        className="relative z-(--layer-chrome) pointer-events-auto"
      >
            <DropdownMenu
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
                  <DropdownMenuItem
                    disabled={isImporting}
                    onSelect={openFilePicker}
                  >
                    <ImportIcon />
                    {isImporting ? t("import.importing") : t("appMenu.import")}
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
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setClearOpen(true)}
                  >
                    <ClearIcon />
                    {t("appMenu.clear")}
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
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
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
    </>
  );
}
