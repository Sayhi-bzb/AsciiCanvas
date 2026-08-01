"use client";

import type { ComponentType, RefObject } from "react";
import { Check } from "lucide-react";
import type { ToolType } from "@/domains/canvas/public";
import { useUiI18n } from "@/shared/i18n";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { getFirstGrapheme } from "@/shared/utils/characters";
import { ColorPickerPanel } from "@/widgets/color-picker";
import { MATERIAL_PRESETS } from "./constants";

type BrushSubmenuProps = {
  brushChar: string;
  customChar: string;
  setCustomChar: (value: string) => void;
  setBrushChar: (value: string) => void;
  setTool: (tool: ToolType) => void;
  inputRef: RefObject<HTMLInputElement | null>;
};

export function BrushSubmenu({
  brushChar,
  customChar,
  setCustomChar,
  setBrushChar,
  setTool,
  inputRef,
}: BrushSubmenuProps) {
  const { t } = useUiI18n();

  return (
    <>
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          if (customChar) {
            setBrushChar(customChar);
            setTool("brush");
          }
          inputRef.current?.focus();
        }}
        className="h-9"
      >
        <div className="size-3.5 flex items-center justify-center shrink-0">
          {brushChar === customChar && customChar !== "" && (
            <Check className="size-3.5 stroke-[3]" />
          )}
        </div>
        <Input
          ref={inputRef}
          className="h-6 w-14 p-0 text-center font-mono text-base font-bold text-inherit border-none bg-muted/40 shadow-none ring-0 hover:bg-muted/60 focus-visible:ring-0 rounded-sm placeholder:text-muted-foreground/50"
          placeholder={t("input.custom")}
          maxLength={12}
          value={customChar}
          onChange={(event) => {
            const raw = event.target.value;
            const value = raw ? getFirstGrapheme(raw) : "";
            setCustomChar(value);
            if (value) setBrushChar(value);
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </DropdownMenuItem>
      <DropdownMenuRadioGroup
        value={MATERIAL_PRESETS.includes(brushChar) ? brushChar : ""}
        onValueChange={(value) => {
          setBrushChar(value);
          setTool("brush");
        }}
      >
        {MATERIAL_PRESETS.map((char) => (
          <DropdownMenuRadioItem key={char} value={char} className="h-9">
            <span className="flex-1 text-center font-mono text-lg font-bold leading-none">
              {char}
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

type ShapeSubmenuProps = {
  tool: ToolType;
  shapeTools: ToolType[];
  setTool: (tool: ToolType) => void;
  setLastUsedShape: (tool: ToolType) => void;
  getToolMeta: (type: ToolType) => {
    icon: ComponentType<{ className?: string }>;
    label: string;
  };
};

export function ShapeSubmenu({
  tool,
  shapeTools,
  setTool,
  setLastUsedShape,
  getToolMeta,
}: ShapeSubmenuProps) {
  return (
    <DropdownMenuRadioGroup
      value={shapeTools.includes(tool) ? tool : ""}
      onValueChange={(value) => {
        const nextTool = value as ToolType;
        setTool(nextTool);
        setLastUsedShape(nextTool);
      }}
    >
      {shapeTools.map((shapeTool) => {
        const meta = getToolMeta(shapeTool);
        return (
          <DropdownMenuRadioItem
            key={shapeTool}
            value={shapeTool}
            className="gap-2"
          >
            <meta.icon className="size-4 shrink-0" />
            <span className="flex-1 whitespace-nowrap pr-4 text-left font-medium">
              {meta.label}
            </span>
          </DropdownMenuRadioItem>
        );
      })}
    </DropdownMenuRadioGroup>
  );
}

type ColorSubmenuProps = {
  brushColor: string;
  setBrushColor: (color: string) => void;
  applyStructuredTextColor?: (color: string) => void;
  onPicked: () => void;
};

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
