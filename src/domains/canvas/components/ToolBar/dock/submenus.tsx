"use client";

import { useState, type ComponentType, type RefObject } from "react";
import { Check, Pipette } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import type { ToolType } from "@/shared/types";
import { getFirstGrapheme } from "@/shared/utils/characters";
import { MATERIAL_PRESETS } from "./constants";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import type { CanvasColorPickerTarget } from "@/domains/canvas/state/interfaces";
import { useShallow } from "zustand/react/shallow";
import { useUiI18n } from "@/shared/i18n";

type SubmenuOptionClass = (active: boolean) => string;

type BrushSubmenuProps = {
  brushChar: string;
  customChar: string;
  setCustomChar: (value: string) => void;
  setBrushChar: (value: string) => void;
  setTool: (tool: ToolType) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  submenuOptionClass: SubmenuOptionClass;
};

export function BrushSubmenu({
  brushChar,
  customChar,
  setCustomChar,
  setBrushChar,
  setTool,
  inputRef,
  submenuOptionClass,
}: BrushSubmenuProps) {
  const { t } = useUiI18n();

  return (
    <>
      <button
        onClick={() => {
          setBrushChar(customChar);
          setTool("brush");
          inputRef.current?.focus();
        }}
        className={submenuOptionClass(brushChar === customChar && customChar !== "")}
      >
        <div className="size-3.5 flex items-center justify-center shrink-0">
          {brushChar === customChar && customChar !== "" && (
            <Check className="size-3.5 stroke-[3]" />
          )}
        </div>
        <div className="flex-1 px-1">
          <Input
            ref={inputRef}
            className="h-6 w-14 text-center p-0 font-mono text-base font-bold border-none shadow-none ring-0 focus-visible:ring-0 bg-muted/40 hover:bg-muted/60 rounded-sm text-inherit placeholder:text-muted-foreground/50"
            placeholder={t("input.custom")}
            maxLength={12}
            value={customChar}
            onChange={(e) => {
              const raw = e.target.value;
              const val = raw ? getFirstGrapheme(raw) : "";
              setCustomChar(val);
              if (val) {
                setBrushChar(val);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </button>
      {MATERIAL_PRESETS.map((char) => (
        <button
          key={char}
          onClick={() => {
            setBrushChar(char);
            setTool("brush");
          }}
          className={submenuOptionClass(brushChar === char)}
        >
          <div className="size-3.5 flex items-center justify-center shrink-0">
            {brushChar === char && <Check className="size-3.5 stroke-[3]" />}
          </div>
          <span className="flex-1 font-mono font-bold text-lg text-center leading-none">
            {char}
          </span>
        </button>
      ))}
    </>
  );
}

type ShapeSubmenuProps = {
  tool: ToolType;
  shapeTools: ToolType[];
  setTool: (tool: ToolType) => void;
  setLastUsedShape: (tool: ToolType) => void;
  getToolMeta: (type: ToolType) => { icon: ComponentType<{ className?: string }>; label: string };
  submenuOptionClass: SubmenuOptionClass;
};

export function ShapeSubmenu({
  tool,
  shapeTools,
  setTool,
  setLastUsedShape,
  getToolMeta,
  submenuOptionClass,
}: ShapeSubmenuProps) {
  return (
    <>
      {shapeTools.map((st) => {
        const meta = getToolMeta(st);
        const isSubActive = tool === st;
        return (
          <button
            key={st}
            onClick={() => {
              setTool(st);
              setLastUsedShape(st);
            }}
            className={submenuOptionClass(isSubActive)}
          >
            <div className="size-3.5 flex items-center justify-center shrink-0">
              {isSubActive && <Check className="size-3.5 stroke-[3]" />}
            </div>
            <meta.icon className="size-4 shrink-0" />
            <span className="ml-1 flex-1 whitespace-nowrap pr-4 text-left text-xs font-medium">
              {meta.label}
            </span>
          </button>
        );
      })}
    </>
  );
}

type ColorSubmenuProps = {
  brushColor: string;
  setBrushColor: (color: string) => void;
  applyStructuredTextColor?: (color: string) => void;
  onPicked: () => void;
};

type ColorPickerPanelProps = {
  value: string;
  onPick: (color: string) => void;
  showCustomInput?: boolean;
  onCanvasPickStarted?: () => void;
};

const ANSI_16_COLORS = [
  "#000000",
  "#800000",
  "#008000",
  "#808000",
  "#000080",
  "#800080",
  "#008080",
  "#c0c0c0",
  "#808080",
  "#ff0000",
  "#00ff00",
  "#ffff00",
  "#0000ff",
  "#ff00ff",
  "#00ffff",
  "#ffffff",
];

const PRESET_COLOR_MATRIX = [
  [
    "#7f1d1d",
    "#7c2d12",
    "#713f12",
    "#14532d",
    "#064e3b",
    "#164e63",
    "#1e3a8a",
    "#312e81",
    "#581c87",
    "#0f172a",
  ],
  [
    "#dc2626",
    "#ea580c",
    "#ca8a04",
    "#16a34a",
    "#10b981",
    "#06b6d4",
    "#3b82f6",
    "#6366f1",
    "#a855f7",
    "#475569",
  ],
  [
    "#f87171",
    "#fdba74",
    "#fde047",
    "#86efac",
    "#6ee7b7",
    "#67e8f9",
    "#93c5fd",
    "#a5b4fc",
    "#d8b4fe",
    "#94a3b8",
  ],
  [
    "#fee2e2",
    "#ffedd5",
    "#fef9c3",
    "#dcfce7",
    "#ccfbf1",
    "#cffafe",
    "#dbeafe",
    "#e0e7ff",
    "#f3e8ff",
    "#f8fafc",
  ],
] as const;

const PRESET_COLORS = PRESET_COLOR_MATRIX.flat();

const normalizeHexColor = (value: string) => {
  const trimmed = value.trim().replace(/^#?/, "#").toLowerCase();

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }

  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
};

export function ColorPickerPanel({
  value,
  onPick,
  showCustomInput = true,
  onCanvasPickStarted,
}: ColorPickerPanelProps) {
  const { t } = useUiI18n();
  const [customColor, setCustomColor] = useState(value);
  const [activePaletteTab, setActivePaletteTab] = useState<"ansi16" | "presets">("ansi16");
  const normalizedCustomColor = normalizeHexColor(customColor);
  const { canvasColorPickerTarget, setCanvasColorPickerTarget } = useCanvasStore(
    useShallow((state) => ({
      canvasColorPickerTarget: state.canvasColorPickerTarget,
      setCanvasColorPickerTarget: state.setCanvasColorPickerTarget,
    }))
  );

  const pickColor = (color: string) => {
    setCustomColor(color);
    onPick(color);
  };

  const toggleCanvasColorPicker = (target: CanvasColorPickerTarget) => {
    const nextTarget = canvasColorPickerTarget === target ? null : target;
    setCanvasColorPickerTarget(nextTarget);
    if (nextTarget) onCanvasPickStarted?.();
  };

  const visibleColors =
    activePaletteTab === "ansi16" ? ANSI_16_COLORS : PRESET_COLORS;
  const colorLabelKey =
    activePaletteTab === "ansi16" ? "color.pickAnsi" : "color.pickPreset";

  return (
    <div className="w-64 space-y-2 p-1.5">
      <div className="grid grid-cols-2 gap-1">
        {(["char", "bg"] as const).map((target) => {
          const isActive = canvasColorPickerTarget === target;
          const label =
            target === "char"
              ? t("color.pickChar")
              : t("color.pickBg");
          return (
            <button
              key={target}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => toggleCanvasColorPicker(target)}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Pipette className="size-3.5" />
              <span>{target === "char" ? t("color.char") : t("color.bg")}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div
          role="tablist"
          aria-label={t("color.paletteTabs")}
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted/35 p-1"
        >
          {([
            { id: "ansi16", label: t("color.ansi16") },
            { id: "presets", label: t("color.presets") },
          ] as const).map((tab) => {
            const isActive = activePaletteTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActivePaletteTab(tab.id)}
                className={cn(
                  "h-7 rounded-md px-2 text-[11px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-end px-0.5">
          <span className="font-mono text-[11px] text-muted-foreground">
            {value}
          </span>
        </div>
        <div
          data-testid="color-palette-grid"
          className={cn(
            "grid gap-1",
            activePaletteTab === "ansi16" ? "grid-cols-8" : "grid-cols-10"
          )}
        >
          {visibleColors.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={t(colorLabelKey, { color: c })}
              onClick={() => pickColor(c)}
              className={cn(
                "size-6 rounded-[0.45rem] border border-black/10 shadow-sm transition-transform hover:scale-110 active:scale-95 flex items-center justify-center",
                value === c && "ring-2 ring-primary ring-offset-1 ring-offset-popover"
              )}
              style={{ backgroundColor: c }}
            >
              {value === c && (
                <Check className="size-3 text-white mix-blend-difference" />
              )}
            </button>
          ))}
        </div>
      </div>

      {showCustomInput && (
        <div className="pt-1">
          <div className="flex items-center gap-2">
            <div
              className="size-7 shrink-0 rounded-lg border border-border shadow-inner"
              style={{ backgroundColor: normalizedCustomColor ?? value }}
            />
            <Input
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && normalizedCustomColor) {
                  pickColor(normalizedCustomColor);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="#00ffcc"
              maxLength={7}
              className="h-7 flex-1 rounded-md bg-muted/40 px-2 font-mono text-xs uppercase shadow-none"
            />
            <button
              type="button"
              disabled={!normalizedCustomColor}
              onClick={() => normalizedCustomColor && pickColor(normalizedCustomColor)}
              className="h-7 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-opacity disabled:pointer-events-none disabled:opacity-40"
            >
              {t("color.use")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ColorSubmenu({
  brushColor,
  setBrushColor,
  applyStructuredTextColor,
  onPicked,
}: ColorSubmenuProps) {
  return (
    <ColorPickerPanel
      value={brushColor}
      onPick={(color) => {
        setBrushColor(color);
        applyStructuredTextColor?.(color);
        onPicked();
      }}
      onCanvasPickStarted={onPicked}
    />
  );
}
