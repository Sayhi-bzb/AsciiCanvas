import type { GridCell } from "@/shared/types";
import type { AnimationFrame } from "@/domains/animation/public";
import type {
  AnimationGeneratorConfig,
  AnimationGeneratorInput,
  GeneratedAnimation,
} from "./types";

const clampInt = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, Math.round(value)));
};

const frameId = (kind: string, index: number) => {
  return `${kind}-${Date.now().toString(36)}-${index}`;
};

const parseKey = (key: string) => {
  const [x, y] = key.split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

const cloneGrid = (grid: [string, GridCell][]) => {
  return grid.map(([key, cell]) => [key, { ...cell }] as [string, GridCell]);
};

const createFrame = (
  kind: AnimationGeneratorConfig["kind"],
  index: number,
  grid: [string, GridCell][]
): AnimationFrame => ({
  id: frameId(kind, index),
  name: `${kind.replaceAll("-", " ")} ${index + 1}`,
  grid,
});

const getBounds = (grid: [string, GridCell][]) => {
  const points = grid
    .map(([key]) => parseKey(key))
    .filter((point): point is { x: number; y: number } => !!point);
  if (points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
};

const normalizeHex = (value: string, fallback: string) => {
  const full = /^#([\da-f]{6})$/i.exec(value);
  if (full) return `#${full[1].toLowerCase()}`;
  const short = /^#([\da-f]{3})$/i.exec(value);
  if (!short) return fallback;
  const [r, g, b] = short[1].split("");
  return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
};

const hexToRgb = (value: string) => {
  const hex = normalizeHex(value, "#ffffff").slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return `#${[r, g, b]
    .map((value) => clampInt(value, 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
};

const mixColor = (from: string, to: string, amount: number) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount
  );
};

const buildSpinner = (
  input: AnimationGeneratorInput,
  config: Extract<AnimationGeneratorConfig, { kind: "spinner" }>
) => {
  const sequence = Array.from(config.sequence || "|/-\\");
  const loops = clampInt(config.loops, 1, 12);
  const color = normalizeHex(config.color, input.fallbackColor);
  const frames: AnimationFrame[] = [];

  for (let loop = 0; loop < loops; loop += 1) {
    sequence.forEach((char) => {
      frames.push(
        createFrame("spinner", frames.length, [
          ...cloneGrid(input.grid),
          [`${config.x},${config.y}`, { char, color }],
        ])
      );
    });
  }

  return frames;
};

const buildSweepHighlight = (
  input: AnimationGeneratorInput,
  config: Extract<AnimationGeneratorConfig, { kind: "sweep-highlight" }>
) => {
  const bounds = getBounds(input.grid);
  const frameCount = clampInt(config.frameCount, 2, 96);
  const width = clampInt(config.width, 1, 24);
  const highlightColor = normalizeHex(config.highlightColor, input.fallbackColor);
  const span = Math.max(1, bounds.maxX - bounds.minX + 1);

  return Array.from({ length: frameCount }, (_, index) => {
    const progress = frameCount === 1 ? 0 : index / (frameCount - 1);
    const sweepX =
      config.direction === "left-to-right"
        ? bounds.minX + Math.round(progress * (span - 1))
        : bounds.maxX - Math.round(progress * (span - 1));
    const grid = input.grid.map(([key, cell]) => {
      const point = parseKey(key);
      if (!point) return [key, { ...cell }] as [string, GridCell];
      const distance = Math.abs(point.x - sweepX);
      const color =
        distance < width
          ? highlightColor
          : config.preserveBaseColor
          ? cell.color
          : input.fallbackColor;
      return [key, { ...cell, color }] as [string, GridCell];
    });
    return createFrame("sweep-highlight", index, grid);
  });
};

const buildReveal = (
  input: AnimationGeneratorInput,
  config: Extract<AnimationGeneratorConfig, { kind: "reveal" }>
) => {
  const sorted = [...input.grid].sort(([a], [b]) => {
    const pa = parseKey(a);
    const pb = parseKey(b);
    if (!pa || !pb) return a.localeCompare(b);
    if (config.direction === "top-to-bottom") {
      if (pa.y !== pb.y) return pa.y - pb.y;
      return pa.x - pb.x;
    }
    if (pa.x !== pb.x) return pa.x - pb.x;
    return pa.y - pb.y;
  });
  const frameCount = clampInt(config.frameCount, 2, 96);

  return Array.from({ length: frameCount }, (_, index) => {
    const visibleCount = Math.ceil(((index + 1) / frameCount) * sorted.length);
    return createFrame("reveal", index, cloneGrid(sorted.slice(0, visibleCount)));
  });
};

const buildColorFlow = (
  input: AnimationGeneratorInput,
  config: Extract<AnimationGeneratorConfig, { kind: "color-flow" }>
) => {
  const bounds = getBounds(input.grid);
  const frameCount = clampInt(config.frameCount, 2, 96);
  const fromColor = normalizeHex(config.fromColor, input.fallbackColor);
  const toColor = normalizeHex(config.toColor, "#ffffff");
  const axisSpan =
    config.direction === "top-to-bottom"
      ? Math.max(1, bounds.maxY - bounds.minY)
      : Math.max(1, bounds.maxX - bounds.minX);

  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const phase = frameIndex / frameCount;
    const grid = input.grid.map(([key, cell]) => {
      const point = parseKey(key);
      if (!point) return [key, { ...cell }] as [string, GridCell];
      const axisProgress =
        config.direction === "top-to-bottom"
          ? (point.y - bounds.minY) / axisSpan
          : (point.x - bounds.minX) / axisSpan;
      const amount = (axisProgress + phase) % 1;
      return [
        key,
        {
          ...cell,
          color: mixColor(fromColor, toColor, amount),
        },
      ] as [string, GridCell];
    });
    return createFrame("color-flow", frameIndex, grid);
  });
};

export const generateAnimationFrames = (
  input: AnimationGeneratorInput,
  config: AnimationGeneratorConfig
): GeneratedAnimation => {
  switch (config.kind) {
    case "spinner":
      return { frames: buildSpinner(input, config) };
    case "sweep-highlight":
      return { frames: buildSweepHighlight(input, config) };
    case "reveal":
      return { frames: buildReveal(input, config) };
    case "color-flow":
      return { frames: buildColorFlow(input, config) };
  }
};
