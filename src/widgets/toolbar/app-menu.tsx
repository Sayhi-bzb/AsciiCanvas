"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { canvasCommands, useCanvasState } from "@/domains/canvas/public";
import { runSidebarAction } from "@/domains/actions/public";
import {
  getAvailableExportFormats,
  type ExportContext,
} from "@/domains/export/public";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { useUiI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { uiClass } from "@/shared/styles/components";
import { useCanvasImport } from "@/widgets/import/useCanvasImport";
import { useAppMenuExport } from "@/widgets/export/use-app-menu-export";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";

const AppMenuTriggerIcon = HOST_ICONOLOGY.appMenu.trigger;
const ImportIcon = HOST_ICONOLOGY.appMenu.import;
const ExportIcon = HOST_ICONOLOGY.appMenu.export;
const CopyIcon = HOST_ICONOLOGY.appMenu.copy;
const GithubIcon = HOST_ICONOLOGY.appMenu.github;
const LanguageIcon = HOST_ICONOLOGY.appMenu.language;
const ClearIcon = HOST_ICONOLOGY.appMenu.clear;
const ClearCanvasDialog = lazy(() =>
  import("@/widgets/dialogs/clear-canvas-dialog").then((module) => ({
    default: module.ClearCanvasDialog,
  }))
);
export function AppMenu() {
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
  const clearCanvas = canvasCommands.grid.clear;
  const documentName = canvasSessions.find(
    (session) => session.id === activeCanvasId
  )?.name;
  const { language, setLanguage, t } = useUiI18n();
  const {
    fileInputRef,
    handleFileChange,
    isImporting,
    openFilePicker,
  } = useCanvasImport();
  const [clearOpen, setClearOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectLanguage = (value: "en" | "zh") => setLanguage(value);
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
        accept=".chardesk,.json,.md,application/vnd.chardesk+json,application/json,text/markdown,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      <div
        data-canvas-ui="true"
        data-testid="app-menu-host"
        className="relative z-50 pointer-events-auto"
      >
            <DropdownMenu
              modal={false}
              open={menuOpen}
              onOpenChange={setMenuOpen}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  tone="subtle"
                  shape="square"
                  size="md"
                  className={cn(
                    uiClass.hostIconControl,
                    "data-[state=open]:bg-accent data-[state=open]:text-foreground"
                  )}
                  aria-label={t("appMenu.open")}
                >
                  <AppMenuTriggerIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                aria-label={t("appMenu.open")}
              >
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
                  <DropdownMenuSubContent aria-label={exportLabel}>
                    {availableExportFormats.map((definition) =>
                      definition.format === "chardesk" ? (
                        <DropdownMenuItem
                          key={definition.format}
                          onSelect={(event) => {
                            event.preventDefault();
                            void exportActions.save(definition.format);
                          }}
                        >
                          {t("appMenu.project")}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuSub key={definition.format}>
                          <DropdownMenuSubTrigger>
                            {definition.label}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent
                            aria-label={definition.label}
                          >
                            {definition.supportsClipboard && (
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault();
                                  void exportActions.copy(definition.format);
                                }}
                              >
                                <CopyIcon />
                                {t("export.copy")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onSelect={(event) => {
                                event.preventDefault();
                                void exportActions.save(definition.format);
                              }}
                            >
                              <ExportIcon />
                              {t("export.save")}
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )
                    )}
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
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <LanguageIcon />
                    {t("appMenu.language")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent aria-label={t("appMenu.language")}>
                    <DropdownMenuRadioGroup value={language}>
                      <DropdownMenuRadioItem
                        value="en"
                        onSelect={(event) => {
                          event.preventDefault();
                          selectLanguage("en");
                        }}
                      >
                        {t("appMenu.english")}
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="zh"
                        onSelect={(event) => {
                          event.preventDefault();
                          selectLanguage("zh");
                        }}
                      >
                        {t("appMenu.chinese")}
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    runSidebarAction("open-source-code", {})
                  }
                >
                  <GithubIcon />
                  {t("appMenu.github")}
                </DropdownMenuItem>
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
      </Suspense>
    </>
  );
}
