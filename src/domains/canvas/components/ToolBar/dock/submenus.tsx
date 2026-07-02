"use client";

import { useState, type ComponentType, type RefObject } from "react";
import { Check, Pipette } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { PALETTE } from "@/shared/lib/constants";
import type { ToolType } from "@/shared/types";
import { getFirstGrapheme } from "@/shared/utils/characters";
import { MATERIAL_PRESETS } from "./constants";
import { useCanvasStore } from "@/domains/canvas/state/canvasStore";
import type { CanvasColorPickerTarget } from "@/domains/canvas/state/interfaces";
import { useShallow } from "zustand/react/shallow";

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
            placeholder="Custom"
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
            <span className="flex-1 text-left text-sm font-medium pr-4 whitespace-nowrap ml-1">
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

const DIY_COLOR_GRID = [
  "#7f1d1d",
  "#991b1b",
  "#dc2626",
  "#f87171",
  "#831843",
  "#be185d",
  "#db2777",
  "#f9a8d4",
  "#7c2d12",
  "#c2410c",
  "#ea580c",
  "#fdba74",
  "#713f12",
  "#a16207",
  "#ca8a04",
  "#fde047",
  "#14532d",
  "#15803d",
  "#16a34a",
  "#86efac",
  "#064e3b",
  "#047857",
  "#10b981",
  "#6ee7b7",
  "#164e63",
  "#0e7490",
  "#06b6d4",
  "#67e8f9",
  "#1e3a8a",
  "#2563eb",
  "#3b82f6",
  "#93c5fd",
  "#312e81",
  "#4f46e5",
  "#6366f1",
  "#a5b4fc",
  "#581c87",
  "#7e22ce",
  "#a855f7",
  "#d8b4fe",
  "#111827",
  "#374151",
  "#6b7280",
  "#d1d5db",
  "#0f172a",
  "#475569",
  "#94a3b8",
  "#f8fafc",
];

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
  const [customColor, setCustomColor] = useState(value);
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

  return (
    <div className="w-64 space-y-2 p-1.5">
      <div className="grid grid-cols-2 gap-1">
        {(["char", "bg"] as const).map((target) => {
          const isActive = canvasColorPickerTarget === target;
          const label =
            target === "char"
              ? "Pick char color from canvas"
              : "Pick BG color from canvas";
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
              <span>{target === "char" ? "Char" : "BG"}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-5 gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Pick color ${c}`}
            onClick={() => pickColor(c)}
            className={cn(
              "size-7 rounded-md border border-border transition-transform hover:scale-110 active:scale-95 flex items-center justify-center",
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

      <div className="rounded-xl border border-border/80 bg-muted/20 p-2">
        <div className="mb-1.5 flex items-center justify-between px-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            DIY Grid
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {value}
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {DIY_COLOR_GRID.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Pick DIY color ${c}`}
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
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 p-1.5">
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
            className="h-8 flex-1 rounded-lg bg-muted/40 px-2 font-mono text-xs uppercase shadow-none"
          />
          <button
            type="button"
            disabled={!normalizedCustomColor}
            onClick={() => normalizedCustomColor && pickColor(normalizedCustomColor)}
            className="h-8 rounded-lg bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-opacity disabled:pointer-events-none disabled:opacity-40"
          >
            Use
          </button>
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
