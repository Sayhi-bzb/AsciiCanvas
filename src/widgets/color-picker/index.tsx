"use client";

import {
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { Check, Pipette } from "lucide-react";
import { useCanvasRuntime, useCanvasState } from "@/domains/canvas/public";
import type { CanvasColorPickerTarget } from "@/domains/canvas/public";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";
import { useUiI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { uiClass } from "@/shared/styles/components";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { PopoverContent } from "@/shared/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

type ColorPickerPanelProps = {
  value: string;
  onPick: (color: string) => void;
  showCustomInput?: boolean;
  onCanvasPickStarted?: () => void;
};

type ColorPickerPopoverContentProps = Omit<
  ComponentProps<typeof PopoverContent>,
  "onOpenAutoFocus" | "ref" | "tabIndex"
>;

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

export function ColorPickerPopoverContent({
  "aria-label": ariaLabel,
  children,
  ...props
}: ColorPickerPopoverContentProps) {
  const { t } = useUiI18n();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <PopoverContent
      {...props}
      ref={contentRef}
      tabIndex={-1}
      aria-label={ariaLabel ?? t("toolbar.color")}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        contentRef.current?.focus({ preventScroll: true });
      }}
    >
      {children}
    </PopoverContent>
  );
}

export function ColorPickerPanel({
  value,
  onPick,
  showCustomInput = true,
  onCanvasPickStarted,
}: ColorPickerPanelProps) {
  const canvas = useCanvasRuntime();
  const { t } = useUiI18n();
  const [customColor, setCustomColor] = useState(value);
  const [activePaletteTab, setActivePaletteTab] = useState<
    "ansi16" | "presets"
  >("ansi16");
  const [eyedropperOpen, setEyedropperOpen] = useState(false);
  const normalizedCustomColor = normalizeHexColor(customColor);
  const canvasColorPickerTarget = useCanvasState(
    (state) => state.canvasColorPickerTarget
  );
  const setCanvasColorPickerTarget = canvas.commands.interaction.setColorPickerTarget;

  const pickColor = (color: string) => {
    setCustomColor(color);
    onPick(color);
  };

  const toggleCanvasColorPicker = (target: CanvasColorPickerTarget) => {
    const nextTarget = canvasColorPickerTarget === target ? null : target;
    setCanvasColorPickerTarget(nextTarget);
    if (nextTarget) onCanvasPickStarted?.();
  };

  const paletteTabs = [
    {
      id: "ansi16",
      label: t("color.ansi16"),
      icon: HOST_ICONOLOGY.colorPalette.ansi16,
      colors: ANSI_16_COLORS,
      colorLabelKey: "color.pickAnsi",
      gridClassName: "grid-cols-8",
    },
    {
      id: "presets",
      label: t("color.presets"),
      icon: HOST_ICONOLOGY.colorPalette.presets,
      colors: PRESET_COLORS,
      colorLabelKey: "color.pickPreset",
      gridClassName: "grid-cols-10",
    },
  ] as const;

  return (
    <Tabs
      value={activePaletteTab}
      onValueChange={(tab) =>
        setActivePaletteTab(tab as "ansi16" | "presets")
      }
      orientation="vertical"
      className="w-[22rem] flex-row items-start gap-1.5 px-1 py-1.5"
    >
      <div
        data-testid="color-picker-content-frame"
        className={cn(
          "min-w-0 flex-1",
          showCustomInput ? "h-[8.875rem]" : "h-[6.375rem]"
        )}
      >
        {paletteTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-3">
            {showCustomInput && (
              <div
                data-color-picker-tools="true"
                className="flex items-center gap-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className="size-7 shrink-0 rounded-lg border border-border shadow-inner"
                    style={{ backgroundColor: normalizedCustomColor ?? value }}
                  />
                  <Input
                    value={customColor}
                    onChange={(event) => setCustomColor(event.target.value)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter" && normalizedCustomColor) {
                        pickColor(normalizedCustomColor);
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    placeholder="#00ffcc"
                    maxLength={7}
                    className="h-7 flex-1 rounded-md bg-muted/40 px-2 font-mono text-xs uppercase shadow-none"
                  />
                  <Button
                    type="button"
                    tone="primary"
                    shape="square"
                    size="sm"
                    disabled={!normalizedCustomColor}
                    onClick={() =>
                      normalizedCustomColor && pickColor(normalizedCustomColor)
                    }
                    aria-label={t("color.use")}
                    title={t("color.use")}
                    className="size-7 shrink-0"
                  >
                    <Check className="size-3.5" />
                  </Button>
                </div>

                <DropdownMenu
                  open={eyedropperOpen}
                  onOpenChange={setEyedropperOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      tone="subtle"
                      shape="square"
                      size="sm"
                      aria-label={t("color.pickFromCanvas")}
                      title={t("color.pickFromCanvas")}
                      aria-pressed={canvasColorPickerTarget !== null}
                      className={cn(
                        "size-7 shrink-0",
                        canvasColorPickerTarget !== null &&
                          "bg-accent text-foreground"
                      )}
                    >
                      <Pipette className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="bottom"
                    align="end"
                    sideOffset={6}
                    className={cn(uiClass.dropdownSubPanel, "w-36")}
                  >
                    {(["char", "bg"] as const).map((target) => {
                      const isActive = canvasColorPickerTarget === target;
                      const label =
                        target === "char"
                          ? t("color.pickChar")
                          : t("color.pickBg");
                      return (
                        <DropdownMenuItem
                          key={target}
                          aria-label={label}
                          onSelect={() => toggleCanvasColorPicker(target)}
                          className={cn(
                            "text-muted-foreground",
                            isActive && "bg-accent text-foreground"
                          )}
                        >
                          <span className="flex size-3.5 items-center justify-center">
                            {isActive && <Check className="size-3.5" />}
                          </span>
                          <span>
                            {target === "char" ? t("color.char") : t("color.bg")}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div
              data-testid="color-palette-grid"
              className={cn("grid gap-0.5", tab.gridClassName)}
            >
              {tab.colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={t(tab.colorLabelKey, { color })}
                  onClick={() => pickColor(color)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-[0.45rem] border border-black/10 shadow-sm transition-transform hover:scale-110 active:scale-95",
                    value === color &&
                      "ring-2 ring-primary ring-offset-1 ring-offset-popover"
                  )}
                  style={{ backgroundColor: color }}
                >
                  {value === color && (
                    <Check className="size-3 text-white mix-blend-difference" />
                  )}
                </button>
              ))}
            </div>
          </TabsContent>
        ))}
      </div>

      <TabsList
        aria-label={t("color.paletteTabs")}
        className={cn(
          uiClass.iconRail,
          "w-fit shrink-0 flex-col gap-1"
        )}
      >
        {paletteTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <TabsTrigger
                  value={tab.id}
                  aria-label={tab.label}
                  className={cn(
                    uiClass.iconRailItem,
                    "group-data-[orientation=vertical]/tabs:w-8 group-data-[orientation=vertical]/tabs:justify-center",
                    "focus-visible:border-transparent focus-visible:outline-0 focus-visible:outline-transparent focus-visible:outline-none",
                    "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none dark:data-[state=active]:border-transparent",
                    activePaletteTab === tab.id && uiClass.hostControlActive
                  )}
                >
                  <Icon className="size-4" />
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">{tab.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
