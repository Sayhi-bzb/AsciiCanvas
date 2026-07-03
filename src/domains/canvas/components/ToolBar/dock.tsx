"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Square,
  SquareSplitVertical,
  Minus,
  LineSquiggle,
  Circle as CircleIcon,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ToolType } from "@/shared/types";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import {
  TOOLBAR_ACTION_META,
  TOOLBAR_ACTION_ORDER,
  runToolbarAction,
} from "@/domains/actions/core";
import { resolveActiveToolbarAction } from "@/domains/actions/core/handlers";
import type { ToolbarActionId } from "@/domains/actions/core/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { uiClass } from "@/shared/styles/components";
import {
  BrushSubmenu,
  ColorSubmenu,
  ShapeSubmenu,
} from "./dock/submenus";
import { MATERIAL_PRESETS, SHAPE_TOOLS } from "./dock/constants";
import { useShallow } from "zustand/react/shallow";
import { AnimationTimeline } from "@/domains/animation/components/AnimationTimeline";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUiI18n } from "@/shared/i18n";

interface ToolbarProps {
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  onUndo: () => void;
}

const submenuOptionClass = (active: boolean) =>
  cn(
    "w-full flex items-center gap-2 h-9 px-2 rounded-md transition-all outline-none shrink-0",
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  );

const FREEFORM_ACTION_ORDER: ToolbarActionId[] = [
  "select",
  "shape-group",
  "bg",
  "fill",
  "color",
];

const STRUCTURED_ACTION_ORDER: ToolbarActionId[] = [
  "select",
  "shape-group",
  "bg",
  "color",
];

export function Toolbar({ tool, setTool, onUndo }: ToolbarProps) {
  const { t } = useUiI18n();
  const {
    brushChar,
    setBrushChar,
    brushColor,
    setBrushColor,
    canvasMode,
    structuredTextSelection,
    setStructuredTextColor,
  } = useCanvasStore(
    useShallow((state) => ({
      brushChar: state.brushChar,
      setBrushChar: state.setBrushChar,
      brushColor: state.brushColor,
      setBrushColor: state.setBrushColor,
      canvasMode: state.canvasMode,
      structuredTextSelection: state.structuredTextSelection,
      setStructuredTextColor: state.setStructuredTextColor,
    }))
  );
  const [lastUsedShape, setLastUsedShape] = useState<ToolType>("box");
  const [openSubMenuId, setOpenSubMenuId] = useState<null | string>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [customChar, setCustomChar] = useState(() =>
    MATERIAL_PRESETS.includes(brushChar) ? "" : brushChar
  );

  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isMobile = useIsMobile();

  const getToolMeta = useCallback((type: ToolType) => {
    switch (type) {
      case "box":
        return { icon: Square, label: t("shape.box") };
      case "splitBox":
        return { icon: SquareSplitVertical, label: t("shape.splitBox") };
      case "circle":
        return { icon: CircleIcon, label: t("shape.circle") };
      case "line":
        return { icon: Minus, label: t("shape.line") };
      case "stepline":
        return { icon: LineSquiggle, label: t("shape.curve") };
      default:
        return { icon: Square, label: t("toolbar.shape") };
    }
  }, [t]);

  useEffect(() => {
    if (tool === "pan" && (!isMobile || canvasMode === "animation")) {
      setTool("select");
      return;
    }
    if (canvasMode === "structured" && tool === "text") {
      setTool("select");
      return;
    }
    if (canvasMode === "freeform" && (tool === "brush" || tool === "eraser")) {
      setTool("select");
    }
  }, [canvasMode, isMobile, setTool, tool]);

  const visibleActionOrder = useMemo<ToolbarActionId[]>(() => {
    const baseOrder =
      canvasMode === "structured"
        ? STRUCTURED_ACTION_ORDER
        : canvasMode === "freeform"
          ? FREEFORM_ACTION_ORDER
          : TOOLBAR_ACTION_ORDER;

    if (!isMobile || canvasMode === "animation") return baseOrder;
    return ["pan", ...baseOrder];
  }, [canvasMode, isMobile]);

  const structuredShapeTools = useMemo<ToolType[]>(() => {
    if (canvasMode === "structured") return ["box", "splitBox", "line"];
    if (canvasMode === "animation") return ["box", "circle", "line", "stepline"];
    return SHAPE_TOOLS;
  }, [canvasMode]);
  const isShapeGroupActive = structuredShapeTools.includes(tool);

  const activeShapeMeta = useMemo(
    () => getToolMeta(isShapeGroupActive ? tool : lastUsedShape),
    [isShapeGroupActive, tool, lastUsedShape, getToolMeta]
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

  useEffect(() => {
    const updateIndicator = () => {
      const activeEl = itemRefs.current[activeIndex];
      const container = activeEl?.closest("nav");
      if (activeEl && container) {
        const rect = activeEl.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        const width = 20;
        const left = rect.left - contRect.left + (rect.width - width) / 2;
        setIndicatorStyle({ width, left });
      }
    };
    updateIndicator();
    const timer = setTimeout(updateIndicator, 16);
    window.addEventListener("resize", updateIndicator);
    return () => {
      window.removeEventListener("resize", updateIndicator);
      clearTimeout(timer);
    };
  }, [activeIndex]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div
          className={cn(
            uiClass.toolbarShell,
            canvasMode === "animation" && "flex-col items-center gap-2 p-2.5",
            isMobile && "scale-90 origin-bottom"
          )}
        >
          <nav className="relative flex items-center justify-center gap-1">
            {navItems.map((item, index) => {
              const isActive = index === activeIndex;
              const Icon = item.icon;
              const isColorTab = item.id === "color";

              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex items-center rounded-lg transition-all",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        ref={(el) => {
                          itemRefs.current[index] = el;
                        }}
                        onClick={() =>
                          runToolbarAction(item.id as ToolbarActionId, {
                            tool,
                            isShapeGroupActive,
                            lastUsedShape,
                            setTool,
                            onUndo,
                          })
                        }
                        aria-label={item.label}
                        className={cn(
                          "flex items-center justify-center h-9 px-3 outline-none rounded-l-lg transition-colors",
                          !item.hasSub && "rounded-lg",
                          !isActive && "hover:bg-muted/50",
                          isColorTab && "px-2"
                        )}
                      >
                        {isColorTab ? (
                          <div
                            className="size-5 rounded-full border border-border shadow-sm"
                            style={{ backgroundColor: brushColor }}
                          />
                        ) : Icon ? (
                          <Icon className="size-5" />
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>

                  {item.hasSub && (
                    <Popover
                      open={openSubMenuId === item.id}
                      onOpenChange={(o) => setOpenSubMenuId(o ? item.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          className={cn(
                            "flex items-center justify-center h-9 px-1 border-l border-transparent hover:border-border outline-none rounded-r-lg opacity-30 hover:opacity-100 transition-all",
                            openSubMenuId === item.id && "bg-muted/50 opacity-100"
                          )}
                        >
                          <ChevronDown className="size-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="top"
                        align={isColorTab ? "end" : "start"}
                        sideOffset={12}
                        className={uiClass.submenuPanel}
                      >
                        {item.id === "brush" ? (
                          <BrushSubmenu
                            brushChar={brushChar}
                            customChar={customChar}
                            setCustomChar={setCustomChar}
                            setBrushChar={setBrushChar}
                            setTool={setTool}
                            inputRef={inputRef}
                            submenuOptionClass={submenuOptionClass}
                          />
                        ) : item.id === "color" ? (
                          <ColorSubmenu
                            brushColor={brushColor}
                            setBrushColor={setBrushColor}
                            applyStructuredTextColor={
                              canvasMode === "structured" && structuredTextSelection
                                ? setStructuredTextColor
                                : undefined
                            }
                            onPicked={() => setOpenSubMenuId(null)}
                          />
                        ) : (
                          <ShapeSubmenu
                            tool={tool}
                            shapeTools={structuredShapeTools}
                            setTool={setTool}
                            setLastUsedShape={setLastUsedShape}
                            getToolMeta={getToolMeta}
                            submenuOptionClass={submenuOptionClass}
                          />
                        )}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              );
            })}

            <div
              className="absolute bottom-1 left-0 bg-primary rounded-full transition-all duration-300 ease-out pointer-events-none"
              style={{
                width: `${indicatorStyle.width}px`,
                transform: `translateX(${indicatorStyle.left}px)`,
                height: "2px",
              }}
            />
          </nav>

          {canvasMode === "animation" && <AnimationTimeline embedded />}
        </div>
      </div>
    </TooltipProvider>
  );
}
