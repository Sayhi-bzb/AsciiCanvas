"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/domains/canvas/public";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { ColorPickerPanel } from "@/widgets/toolbar/dock/submenus";
import { cn } from "@/shared/lib/utils";
import type {
  AnimationGeneratorConfig,
  AnimationGeneratorKind,
  GeneratedAnimationApplyMode,
} from "@/domains/animation/public";
import { generateAnimationFrames } from "@/domains/animation/public";
import { HOST_ICONOLOGY } from "@/shared/icons/iconology";

const PRESET_LABELS: Record<AnimationGeneratorKind, string> = {
  spinner: "Spinner",
  "sweep-highlight": "Sweep",
  reveal: "Reveal",
  "color-flow": "Color Flow",
};

const createDefaultConfigs = (
  brushColor: string
): Record<AnimationGeneratorKind, AnimationGeneratorConfig> => ({
  spinner: {
    kind: "spinner",
    sequence: "|/-\\",
    x: 0,
    y: 0,
    color: brushColor,
    loops: 2,
  },
  "sweep-highlight": {
    kind: "sweep-highlight",
    direction: "left-to-right",
    highlightColor: brushColor,
    width: 2,
    frameCount: 12,
    preserveBaseColor: true,
  },
  reveal: {
    kind: "reveal",
    direction: "left-to-right",
    frameCount: 12,
  },
  "color-flow": {
    kind: "color-flow",
    fromColor: brushColor,
    toColor: "#f97316",
    direction: "left-to-right",
    frameCount: 16,
  },
});

const fieldClassName = "h-7 rounded-md border-border bg-background px-2 text-xs";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
      </Label>
      <Input
        inputMode="numeric"
        value={String(value)}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10) || 0)}
        className={fieldClassName}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
      </Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClassName}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-7 w-full items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-xs text-muted-foreground hover:bg-accent/45"
          >
            <span
              className="size-4 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: value }}
            />
            <span className="truncate">Pick color</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-auto p-0">
          <ColorPickerPanel
            value={value}
            onPick={onChange}
            showCustomInput={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function AnimationEffectsPanel() {
  const GenerateFramesIcon = HOST_ICONOLOGY.animationAction["generate-frames"];
  const {
    grid,
    brushColor,
    canvasBounds,
    applyGeneratedAnimationFrames,
  } = useEditorStore(
    useShallow((state) => ({
      grid: state.grid,
      brushColor: state.brushColor,
      canvasBounds: state.canvasBounds,
      applyGeneratedAnimationFrames: state.applyGeneratedAnimationFrames,
    }))
  );
  const [kind, setKind] = useState<AnimationGeneratorKind>("sweep-highlight");
  const [configs, setConfigs] = useState(() => createDefaultConfigs(brushColor));
  const [applyMode, setApplyMode] =
    useState<GeneratedAnimationApplyMode>("insert-after-current");
  const activeConfig = configs[kind];
  const generated = useMemo(
    () =>
      generateAnimationFrames(
        {
          grid: Array.from(grid.entries()),
          fallbackColor: brushColor,
        },
        activeConfig
      ),
    [activeConfig, brushColor, grid]
  );

  const updateConfig = (patch: Partial<AnimationGeneratorConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], ...patch } as AnimationGeneratorConfig,
    }));
  };

  const applyFrames = () => {
    applyGeneratedAnimationFrames(generated.frames, applyMode, {
      fps: 12,
      size: canvasBounds ?? undefined,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="grid grid-cols-2 gap-1">
        {(Object.keys(PRESET_LABELS) as AnimationGeneratorKind[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setKind(item)}
            className={cn(
              "h-8 rounded-md px-2 text-left text-xs font-semibold transition-colors",
              kind === item
                ? "bg-primary text-primary-foreground"
                : "bg-muted/35 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {PRESET_LABELS[item]}
          </button>
        ))}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 pr-1">
        {activeConfig.kind === "spinner" && (
          <>
            <TextField
              label="Sequence"
              value={activeConfig.sequence}
              onChange={(sequence) => updateConfig({ sequence })}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="X" value={activeConfig.x} onChange={(x) => updateConfig({ x })} />
              <NumberField label="Y" value={activeConfig.y} onChange={(y) => updateConfig({ y })} />
            </div>
            <ColorField label="Color" value={activeConfig.color} onChange={(color) => updateConfig({ color })} />
            <NumberField label="Loops" value={activeConfig.loops} onChange={(loops) => updateConfig({ loops })} />
          </>
        )}

        {activeConfig.kind === "sweep-highlight" && (
          <>
            <ColorField
              label="Highlight"
              value={activeConfig.highlightColor}
              onChange={(highlightColor) => updateConfig({ highlightColor })}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Width" value={activeConfig.width} onChange={(width) => updateConfig({ width })} />
              <NumberField label="Frames" value={activeConfig.frameCount} onChange={(frameCount) => updateConfig({ frameCount })} />
            </div>
            <button
              type="button"
              onClick={() =>
                updateConfig({
                  direction:
                    activeConfig.direction === "left-to-right"
                      ? "right-to-left"
                      : "left-to-right",
                })
              }
              className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:bg-accent/45"
            >
              {activeConfig.direction}
            </button>
          </>
        )}

        {activeConfig.kind === "reveal" && (
          <>
            <NumberField label="Frames" value={activeConfig.frameCount} onChange={(frameCount) => updateConfig({ frameCount })} />
            <button
              type="button"
              onClick={() =>
                updateConfig({
                  direction:
                    activeConfig.direction === "left-to-right"
                      ? "top-to-bottom"
                      : "left-to-right",
                })
              }
              className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:bg-accent/45"
            >
              {activeConfig.direction}
            </button>
          </>
        )}

        {activeConfig.kind === "color-flow" && (
          <>
            <ColorField label="From" value={activeConfig.fromColor} onChange={(fromColor) => updateConfig({ fromColor })} />
            <ColorField label="To" value={activeConfig.toColor} onChange={(toColor) => updateConfig({ toColor })} />
            <NumberField label="Frames" value={activeConfig.frameCount} onChange={(frameCount) => updateConfig({ frameCount })} />
          </>
        )}
        </div>
      </ScrollArea>

      <div className="space-y-2 border-t border-accent pt-3">
        <div className="grid grid-cols-3 gap-1">
          {([
            ["insert-after-current", "Insert"],
            ["append-to-end", "Append"],
            ["replace-animation", "Replace"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setApplyMode(value)}
              className={cn(
                "h-7 rounded-md text-[11px] font-medium",
                applyMode === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/35 text-muted-foreground hover:bg-accent/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          tone="primary"
          size="md"
          className="h-9 w-full rounded-md border border-primary/50 font-semibold shadow-sm shadow-primary/15 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:transform-none disabled:shadow-none"
          onClick={applyFrames}
          disabled={generated.frames.length === 0}
        >
          <GenerateFramesIcon className="size-4" />
          Generate {generated.frames.length} Frames
        </Button>
      </div>
    </div>
  );
}
