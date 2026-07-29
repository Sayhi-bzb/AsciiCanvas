"use client";

import { lazy, Suspense, useRef, useState } from "react";
import {
  CircleHelp,
  Download,
  Eye,
  EyeOff,
  Github,
  Languages,
  Map,
  Menu,
  Trash2,
  Upload,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import { runSidebarAction } from "@/domains/actions/public";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/shared/ui/popover";
import { useUiI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { uiClass } from "@/shared/styles/components";
import { useCanvasImport } from "@/widgets/import/useCanvasImport";

const ExportDialog = lazy(() =>
  import("@/widgets/export/export-dialog").then((module) => ({
    default: module.ExportDialog,
  }))
);
const HandbookDialog = lazy(() =>
  import("@/widgets/dialogs/handbook-dialog").then((module) => ({
    default: module.HandbookDialog,
  }))
);
const ClearCanvasDialog = lazy(() =>
  import("@/widgets/dialogs/clear-canvas-dialog").then((module) => ({
    default: module.ClearCanvasDialog,
  }))
);
const Minimap = lazy(() =>
  import("@/widgets/canvas-editor/Minimap").then((module) => ({
    default: module.Minimap,
  }))
);

type AppMenuProps = {
  containerSize?: { width: number; height: number };
};

export function AppMenu({ containerSize }: AppMenuProps) {
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
  const { language, t, toggleLanguage } = useUiI18n();
  const {
    fileInputRef,
    handleFileChange,
    isImporting,
    openFilePicker,
  } = useCanvasImport();
  const [exportOpen, setExportOpen] = useState(false);
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const minimapRequestedRef = useRef(false);
  const clearLabel =
    canvasMode === "animation"
      ? t("sidebar.clear.frame")
      : t("sidebar.clear.canvas");
  const clearDescription =
    canvasMode === "animation"
      ? t("sidebar.clear.frameDescription")
      : t("sidebar.clear.canvasDescription");
  const exportLabel =
    canvasMode === "animation"
      ? t("export.tooltip.animation")
      : t("export.tooltip.blueprint");
  const actionContext = {
    showGrid,
    setShowGrid,
    setZoom,
    setOffset,
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.cast,application/json,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      <Popover open={minimapOpen} onOpenChange={setMinimapOpen}>
        <PopoverAnchor asChild>
          <div
            data-canvas-ui="true"
            data-testid="app-menu-host"
            className="absolute left-3 top-3 z-50 pointer-events-auto"
          >
            <DropdownMenu
              open={menuOpen}
              onOpenChange={setMenuOpen}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  tone="subtle"
                  shape="square"
                  size="md"
                  className={cn(
                    "size-8 bg-muted text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground",
                    uiClass.hostControl
                  )}
                  aria-label={t("appMenu.open")}
                >
                  <Menu className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                aria-label={t("appMenu.open")}
                onCloseAutoFocus={(event) => {
                  if (!minimapRequestedRef.current) return;
                  event.preventDefault();
                  minimapRequestedRef.current = false;
                  setMinimapOpen(true);
                }}
              >
                <DropdownMenuItem
                  disabled={isImporting}
                  onSelect={openFilePicker}
                >
                  <Upload />
                  {isImporting ? t("import.importing") : t("import.tooltip")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setExportOpen(true)}>
                  <Download />
                  {exportLabel}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => runSidebarAction("toggle-grid", actionContext)}
                >
                  {showGrid ? <Eye className="text-primary" /> : <EyeOff />}
                  {showGrid ? t("sidebar.grid.hide") : t("action.toggleGrid")}
                </DropdownMenuItem>
                {canvasMode !== "animation" && (
                  <DropdownMenuItem
                    onSelect={() => {
                      minimapRequestedRef.current = true;
                    }}
                  >
                    <Map />
                    {t("sidebar.minimap")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setHandbookOpen(true)}>
                  <CircleHelp />
                  {t("manual.title")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setClearOpen(true)}
                >
                  <Trash2 />
                  {clearLabel}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleLanguage}>
                  <Languages />
                  {language === "en"
                    ? t("language.switchToChinese")
                    : t("language.switchToEnglish")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    runSidebarAction("open-source-code", actionContext)
                  }
                >
                  <Github />
                  {t("action.openSourceCode")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PopoverAnchor>
        {minimapOpen && (
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={8}
            className="w-auto overflow-hidden rounded-lg border-0 bg-muted p-0 shadow-none"
          >
            <Suspense fallback={<div className="size-48 bg-muted" />}>
              <Minimap containerSize={containerSize} />
            </Suspense>
          </PopoverContent>
        )}
      </Popover>

      <Suspense fallback={null}>
        {exportOpen && (
          <ExportDialog
            grid={grid}
            canvasMode={canvasMode}
            structuredScene={structuredScene}
            structuredComponents={structuredComponents}
            canvasBounds={canvasBounds}
            animationTimeline={animationTimeline}
            exportShowGrid={exportShowGrid}
            setExportShowGrid={setExportShowGrid}
            open={exportOpen}
            onOpenChange={setExportOpen}
            trigger={null}
          />
        )}
        {handbookOpen && (
          <HandbookDialog
            open={handbookOpen}
            onOpenChange={setHandbookOpen}
            trigger={null}
          />
        )}
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
