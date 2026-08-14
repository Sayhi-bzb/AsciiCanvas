"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/shared/lib/utils";
import {
  isToolAllowedForMode,
  type ToolType,
} from "@/domains/canvas/public";
import { useCanvasRuntime, useCanvasState } from "@/domains/canvas/public";
import {
  TOOLBAR_ACTION_META,
} from "@/domains/actions/public";
import { resolveActiveToolbarAction } from "@/domains/actions/public";
import type { ToolbarActionId } from "@/domains/actions/public";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
} from "@/shared/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { rx } from "@/shared/styles/recipes"
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { Kbd } from "@/shared/ui/kbd";

import {
  BrushSubmenu,
  ColorSubmenu,
  ShapeSubmenu,
} from "./dock/submenus";
import { MATERIAL_PRESETS, SHAPE_TOOLS } from "./dock/constants";
import { useShallow } from "zustand/react/shallow";
import { ColorPickerPopoverContent } from "@/widgets/color-picker";
import { useUiI18n } from "@/shared/i18n";
import {
  SHORTCUT_PRIORITY,
  useShortcutLayer,
} from "@/shared/shortcuts/dispatcher";
import {
  getDockShortcutAriaLabel,
  getDockShortcutLabel,
  resolveDockShortcutIndex,
} from "./dock/shortcuts";
import type { EditorFormFactor } from "@/widgets/editor-chrome/public";

const ToolbarSubmenuIcon = HOST_ICONOLOGY.chrome["toolbar-submenu"];

interface ToolbarProps {
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  onUndo: () => void;
  isCanvasTextEditing: boolean;
  onExitCanvasTextEditing: () => void;
  enabled?: boolean;
  formFactor?: EditorFormFactor;
}

const FREEFORM_ACTION_ORDER: ToolbarActionId[] = [
  "pan",
  "select",
  "shape-group",
  "bg",
  "fill",
];

const STRUCTURED_ACTION_ORDER: ToolbarActionId[] = [
  "pan",
  "select",
  "shape-group",
  "bg",
  "color",
];

const DIRECT_TOOL_BY_ACTION: Partial<Record<ToolbarActionId, ToolType>> = {
  pan: "pan",
  select: "select",
  text: "text",
  brush: "brush",
  bg: "bg",
  fill: "fill",
  eraser: "eraser",
};

export function Toolbar({
  tool,
  setTool,
  onUndo,
  isCanvasTextEditing,
  onExitCanvasTextEditing,
  enabled = true,
  formFactor = "desktop",
}: ToolbarProps) {
  const canvas = useCanvasRuntime();
  const { t } = useUiI18n();
  const {
    brushChar,
    brushColor,
    canvasMode,
    structuredTextSelection,
  } = useCanvasState(
    useShallow((state) => ({
      brushChar: state.brushChar,
      brushColor: state.brushColor,
      canvasMode: state.canvasMode,
      structuredTextSelection: state.structuredTextSelection,
    }))
  );
  const setBrushChar = canvas.commands.preferences.setBrushChar;
  const setBrushColor = canvas.commands.preferences.setBrushColor;
  const setStructuredTextColor = canvas.commands.structured.setTextColor;
  const [lastUsedShape, setLastUsedShape] = useState<ToolType>("box");
  const [openSubMenuId, setOpenSubMenuId] = useState<null | string>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [customChar, setCustomChar] = useState(() =>
    MATERIAL_PRESETS.includes(brushChar) ? "" : brushChar
  );

  const getToolMeta = useCallback((type: ToolType) => {
    switch (type) {
      case "box":
        return { icon: HOST_ICONOLOGY.shapeTool.box, label: t("shape.box") };
      case "splitBox":
        return { icon: HOST_ICONOLOGY.shapeTool.splitBox, label: t("shape.splitBox") };
      case "circle":
        return { icon: HOST_ICONOLOGY.shapeTool.circle, label: t("shape.circle") };
      case "line":
        return { icon: HOST_ICONOLOGY.shapeTool.line, label: t("shape.line") };
      case "arrowLine":
        return { icon: HOST_ICONOLOGY.shapeTool.arrowLine, label: t("shape.arrowLine") };
      case "stepline":
        return { icon: HOST_ICONOLOGY.shapeTool.stepline, label: t("shape.curve") };
      default:
        return { icon: HOST_ICONOLOGY.shapeTool.box, label: t("toolbar.shape") };
    }
  }, [t]);

  useEffect(() => {
    if (canvasMode === "structured" && tool === "text") {
      setTool("select");
      return;
    }
    if (canvasMode !== "structured" && tool === "arrowLine") {
      setTool("select");
      return;
    }
    if (canvasMode === "freeform" && (tool === "brush" || tool === "eraser")) {
      setTool("select");
    }
  }, [canvasMode, setTool, tool]);

  const visibleActionOrder = useMemo<ToolbarActionId[]>(() => {
    const baseOrder =
      canvasMode === "structured"
        ? STRUCTURED_ACTION_ORDER
        : FREEFORM_ACTION_ORDER;

    return baseOrder.filter((actionId) => {
      const directTool = DIRECT_TOOL_BY_ACTION[actionId];
      return !directTool || isToolAllowedForMode(directTool, canvasMode);
    });
  }, [canvasMode]);

  const structuredShapeTools = useMemo<ToolType[]>(() => {
    const candidates =
      canvasMode === "structured"
        ? (["box", "splitBox", "line", "arrowLine"] as ToolType[])
        : SHAPE_TOOLS;
    return candidates.filter((shapeTool) =>
      isToolAllowedForMode(shapeTool, canvasMode)
    );
  }, [canvasMode]);
  const isShapeGroupActive = structuredShapeTools.includes(tool);
  const availableLastUsedShape = structuredShapeTools.includes(lastUsedShape)
    ? lastUsedShape
    : structuredShapeTools[0] ?? "box";

  const activeShapeMeta = useMemo(
    () => getToolMeta(isShapeGroupActive ? tool : availableLastUsedShape),
    [availableLastUsedShape, getToolMeta, isShapeGroupActive, tool]
  );

  const navItems = useMemo(() => {
    return visibleActionOrder.map((id) => {
      const meta = TOOLBAR_ACTION_META[id];
      const labelById: Partial<Record<ToolbarActionId, string>> = {
        select: t("toolbar.select"),
        text: t("toolbar.text"),
        brush: t("toolbar.brush"),
        "shape-group": t("toolbar.shape"),
        bg: t("toolbar.background"),
        fill: t("toolbar.paintCharColor"),
        eraser: t("toolbar.eraser"),
        undo: t("toolbar.undo"),
        color: t("toolbar.color"),
        pan: t("toolbar.pan"),
      };
      if (id === "brush") {
        return { ...meta, label: t("toolbar.brushWithChar", { char: brushChar }) };
      }
      if (id === "shape-group") {
        return { ...meta, label: activeShapeMeta.label, icon: activeShapeMeta.icon };
      }
      return { ...meta, label: labelById[id] ?? meta.label };
    });
  }, [visibleActionOrder, brushChar, activeShapeMeta, t]);

  const activeIndex = useMemo(() => {
    const currentId = resolveActiveToolbarAction(tool, isShapeGroupActive);
    const idx = navItems.findIndex((item) => item.id === currentId);
    return idx !== -1 ? idx : 0;
  }, [tool, isShapeGroupActive, navItems]);

  const activateToolbarItem = useCallback((id: ToolbarActionId) => {
    if (id === "color") return false;
    if (id === "undo") {
      onUndo();
      return true;
    }
    if (id === "shape-group") {
      setTool(isShapeGroupActive ? tool : availableLastUsedShape);
      return true;
    }
    setTool(id);
    return true;
  }, [availableLastUsedShape, isShapeGroupActive, onUndo, setTool, tool]);

  useShortcutLayer({
    id: "dock-tools",
    priority: SHORTCUT_PRIORITY.dynamicCanvasCommand,
    enabled: enabled && openSubMenuId === null,
    onKeyDown: (event, context) => {
      if (
        context.targetKind === "editable" ||
        context.targetKind === "overlay"
      ) {
        return;
      }
      const shortcutIndex = resolveDockShortcutIndex(event, navItems.length);
      if (shortcutIndex === null) return;
      const item = navItems[shortcutIndex];
      if (!item) return;

      if (isCanvasTextEditing) onExitCanvasTextEditing();

      if (item.id === "color") {
        setOpenSubMenuId("color");
        return { claimed: true, preventDefault: true };
      }

      return activateToolbarItem(item.id as ToolbarActionId)
        ? { claimed: true, preventDefault: true }
        : undefined;
    },
  });

  return (
    <div
      data-testid="tool-dock"
      data-density={formFactor === "desktop" ? "default" : "compact"}
      className={rx.toolbarShell}
    >
          <nav
            role="toolbar"
            aria-label={t("toolbar.group")}
            className="relative flex items-center justify-center gap-1"
          >
            {navItems.map((item, index) => {
              const isActive = index === activeIndex;
              const Icon = item.icon;
              const isColorTab = item.id === "color";
              const shortcutLabel = getDockShortcutLabel(index);
              const shortcutAriaLabel = getDockShortcutAriaLabel(index);
              const submenuTrigger = (
                <button
                  data-toolbar-submenu-trigger="true"
                  aria-label={t("toolbar.openSubmenu", { label: item.label })}
                  className={cn(
                    rx.hostIconControl,
                    "rounded-l-none opacity-30 hover:opacity-100",
                    openSubMenuId === item.id &&
                      "bg-accent text-foreground opacity-100"
                  )}
                >
                  <ToolbarSubmenuIcon />
                </button>
              );

              return (
                <div
                  key={item.id}
                  data-toolbar-item={item.id}
                  className={cn(
                    "relative flex items-center rounded-lg transition-colors has-[[data-toolbar-submenu-trigger]:hover]:bg-accent has-[[data-toolbar-submenu-trigger]:hover]:text-foreground",
                    isActive || openSubMenuId === item.id
                      ? rx.hostControlActive
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => activateToolbarItem(item.id as ToolbarActionId)}
                        aria-label={item.label}
                        aria-keyshortcuts={shortcutAriaLabel}
                        className={cn(
                          rx.hostIconControl,
                          item.hasSub && "rounded-r-none"
                        )}
                      >
                        {isColorTab ? (
                          <div
                            className="size-5 rounded-full border border-border shadow-sm"
                            style={{ backgroundColor: brushColor }}
                          />
                        ) : Icon ? (
                          <Icon />
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="flex items-center gap-2 text-xs"
                    >
                      <span>{item.label}</span>
                      <Kbd>
                        {shortcutLabel}
                      </Kbd>
                    </TooltipContent>
                  </Tooltip>

                  {item.hasSub &&
                    (isColorTab ? (
                      <Popover
                        open={openSubMenuId === item.id}
                        onOpenChange={(open) =>
                          setOpenSubMenuId(open ? item.id : null)
                        }
                      >
                        <PopoverTrigger asChild>{submenuTrigger}</PopoverTrigger>
                        <ColorPickerPopoverContent
                          side="top"
                          align="end"
                          sideOffset={12}
                          className={cn(rx.dropdownPanel, "w-auto")}
                        >
                          <ColorSubmenu
                            brushColor={brushColor}
                            setBrushColor={setBrushColor}
                            applyStructuredTextColor={
                              canvasMode === "structured" &&
                              structuredTextSelection
                                ? setStructuredTextColor
                                : undefined
                            }
                            onPicked={() => setOpenSubMenuId(null)}
                          />
                        </ColorPickerPopoverContent>
                      </Popover>
                    ) : (
                      <DropdownMenu
                        open={openSubMenuId === item.id}
                        onOpenChange={(open) =>
                          setOpenSubMenuId(open ? item.id : null)
                        }
                      >
                        <DropdownMenuTrigger asChild>
                          {submenuTrigger}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="top"
                          align="start"
                          sideOffset={12}
                          className={cn(
                            item.id === "shape-group" && "min-w-40"
                          )}
                        >
                          {item.id === "brush" ? (
                            <BrushSubmenu
                              brushChar={brushChar}
                              customChar={customChar}
                              setCustomChar={setCustomChar}
                              setBrushChar={setBrushChar}
                              setTool={setTool}
                              inputRef={inputRef}
                            />
                          ) : (
                            <ShapeSubmenu
                              tool={tool}
                              shapeTools={structuredShapeTools}
                              setTool={setTool}
                              setLastUsedShape={setLastUsedShape}
                              getToolMeta={getToolMeta}
                            />
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ))}
                </div>
              );
            })}

          </nav>

      </div>
  );
}
