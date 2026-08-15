"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { EDITOR_COMMAND_META } from "@/domains/actions/public";
import { useCanvasRuntime, useCanvasState } from "@/domains/canvas/public";
import { useEditor } from "@/domains/editor/public";
import { useUiI18n } from "@/shared/i18n";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";
import { Button } from "@/shared/ui/button";
import { ContentScrollArea } from "@/shared/ui/content-scroll-area";
import { ColorSwatch } from "@/shared/ui/color-swatch";
import { Surface } from "@/shared/ui/surface";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { ColorPickerPanel } from "@/widgets/color-picker";
import type { EditorFormFactor } from "@/widgets/editor-chrome/public";
import { deriveCanvasInspectorModel } from "./model";

type CanvasInspectorControlProps = {
  formFactor: EditorFormFactor;
  readOnly?: boolean;
  onBeforeOpen?: () => void;
};

const actionIds = [
  "structured-send-to-back",
  "structured-send-backward",
  "structured-bring-forward",
  "structured-bring-to-front",
] as const;

export function CanvasInspectorControl({
  formFactor,
  readOnly = false,
  onBeforeOpen,
}: CanvasInspectorControlProps) {
  const canvas = useCanvasRuntime();
  const editor = useEditor();
  const { t } = useUiI18n();
  const state = useCanvasState(
    useShallow((value) => ({
      canvasMode: value.canvasMode,
      tool: value.tool,
      brushColor: value.brushColor,
      brushBackgroundColor: value.brushBackgroundColor,
      canvasColorPickerTarget: value.canvasColorPickerTarget,
      hasGridSelection: value.selections.length > 0,
      structuredScene: value.structuredScene,
      selectedStructuredNodeIds: value.selectedStructuredNodeIds,
      structuredTextSelection: value.structuredTextSelection,
    }))
  );
  const model = useMemo(
    () =>
      deriveCanvasInspectorModel({
        canvasMode: state.canvasMode,
        tool: state.tool,
        brushColor: state.brushColor,
        brushBackgroundColor: state.brushBackgroundColor,
        hasGridSelection: state.hasGridSelection,
        structuredScene: state.structuredScene,
        selectedStructuredNodeIds: state.selectedStructuredNodeIds,
        structuredTextSelection: state.structuredTextSelection,
      }),
    [
      state.brushBackgroundColor,
      state.brushColor,
      state.canvasMode,
      state.hasGridSelection,
      state.selectedStructuredNodeIds,
      state.structuredScene,
      state.structuredTextSelection,
      state.tool,
    ]
  );
  const [panelState, setPanelState] = useState({
    formFactor,
    open: formFactor !== "phone",
    userSet: false,
    tool: state.tool,
  });
  const open =
    panelState.formFactor === formFactor || panelState.userSet
      ? panelState.open
      : formFactor !== "phone";
  const panelOpen = open && state.tool !== "pan";

  if (panelState.tool !== state.tool) {
    setPanelState({
      ...panelState,
      open: state.tool === "pan" ? false : open,
      userSet: state.tool === "pan" ? true : panelState.userSet,
      tool: state.tool,
    });
  }

  const close = useCallback(() => {
    setPanelState({
      formFactor,
      open: false,
      userSet: true,
      tool: state.tool,
    });
    canvas.commands.interaction.setColorPickerTarget(null);
  }, [canvas, formFactor, state.tool]);

  const setOpenState = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) onBeforeOpen?.();
      setPanelState({
        formFactor,
        open: nextOpen,
        userSet: true,
        tool: state.tool,
      });
      if (!nextOpen) {
        canvas.commands.interaction.setColorPickerTarget(null);
      }
    },
    [canvas, formFactor, onBeforeOpen, state.tool]
  );

  useEffect(() => {
    canvas.commands.interaction.setColorPickerTarget(null);
    return () => canvas.commands.interaction.setColorPickerTarget(null);
  }, [canvas, state.canvasMode, state.tool]);

  useShortcutLayer({
    id: "canvas-inspector",
    priority: SHORTCUT_PRIORITY.dynamicCanvasCommand,
    enabled: state.tool !== "pan",
    onKeyDown: (event, context) => {
      if (
        context.targetKind === "editable" ||
        context.targetKind === "overlay"
      ) {
        return;
      }
      if (event.key === "Escape" && (panelOpen || state.canvasColorPickerTarget)) {
        close();
        return { claimed: true, preventDefault: true };
      }
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.code === "Digit6"
      ) {
        setOpenState(!panelOpen);
        return { claimed: true, preventDefault: true };
      }
    },
  });

  const applyColor = (color: string) => {
    if (readOnly) return;
    if (model.mode === "grid") {
      if (model.canvasPickDestination === "background") {
        canvas.commands.preferences.setBrushBackgroundColor(color);
        if (model.hasSelection) {
          canvas.commands.selection.setBackgroundColor(color);
        }
      } else {
        canvas.commands.preferences.setBrushColor(color);
        if (model.hasSelection) {
          canvas.commands.selection.setForegroundColor(color);
        }
      }
      return;
    }

    canvas.commands.preferences.setBrushColor(color);
    if (model.structured.target === "text-range") {
      canvas.commands.structured.setTextColor(color);
    } else if (model.structured.target === "nodes") {
      canvas.commands.structured.setSelectionPrimaryColor(color);
    }
  };

  const execute = (id: (typeof actionIds)[number]) => {
    if (readOnly) return;
    editor.commands.execute(id, { source: "inspector" }, "inspector");
  };

  const renderAction = (id: (typeof actionIds)[number]) => {
    const meta = EDITOR_COMMAND_META[id];
    const Icon = meta.icon;
    const enabled =
      !readOnly && editor.commands.canExecute(id, undefined, "availability");
    return (
      <Tooltip key={id}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            tone={meta.destructive ? "danger" : "subtle"}
            shape="square"
            size="sm"
            aria-label={meta.label}
            disabled={!enabled}
            className="size-7 w-full"
            onClick={() => execute(id)}
          >
            {Icon && <Icon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{meta.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="pointer-events-auto relative flex-none">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            tone="subtle"
            shape="square"
            size="md"
            open={panelOpen}
            aria-label={t("inspector.toggle")}
            aria-controls="canvas-inspector-panel"
            aria-keyshortcuts="Alt+6"
            disabled={state.tool === "pan"}
            onClick={() => setOpenState(!panelOpen)}
          >
            <ColorSwatch
              data-testid="canvas-inspector-swatch"
              aria-hidden="true"
              color={model.activeColor}
              className="size-5"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("inspector.title")}</TooltipContent>
      </Tooltip>

      {panelOpen && (
        <Surface kind="floating" asChild>
          <section
            id="canvas-inspector-panel"
            data-testid="canvas-inspector-panel"
            aria-label={t("inspector.title")}
            className="absolute left-[calc(100%+0.5rem)] top-0 w-[min(10rem,calc(100vw-2rem))] overflow-hidden"
            onPointerDown={(event) => event.stopPropagation()}
          >
          <ContentScrollArea className="max-h-[min(32rem,calc(100vh-5rem))]">
            <div
              data-testid="canvas-inspector-content"
              inert={readOnly}
              aria-disabled={readOnly}
              className="flex flex-col gap-2 px-1 py-2"
            >
              <ColorPickerPanel
                value={model.activeColor}
                onPick={applyColor}
                defaultColor={COLOR_PRIMARY_TEXT}
                canvasPickDestination={model.canvasPickDestination}
                className="w-full px-0"
              />

              {model.mode === "structured" &&
                model.structured.target === "nodes" && (
                  <section aria-label={t("inspector.arrange")}>
                    <div className="grid grid-cols-4 gap-1">
                      {actionIds.map(renderAction)}
                    </div>
                  </section>
                )}
            </div>
          </ContentScrollArea>
          </section>
        </Surface>
      )}
    </div>
  );
}
