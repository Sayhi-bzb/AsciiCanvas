import {
  DEFAULT_ANIMATION_FPS,
  DEFAULT_ONION_SKIN,
  MAX_ANIMATION_FPS,
  createAnimationFrameId,
} from "@/domains/canvas/state/helpers/animationHelpers";
import type { ProtocolImportSnapshot } from "@/domains/protocol";
import { COLOR_PRIMARY_TEXT } from "@/shared/lib/constants";
import { getCellOccupancy, splitGraphemes } from "@/shared/metrics";
import type {
  AnimationCanvasSize,
  AnimationTimeline,
  GridCell,
} from "@/shared/types";
import { GridManager } from "@/shared/utils/grid";
import {
  parseSgrSequenceAt,
  styleStateToCell,
  type AnsiStyleState,
} from "@/shared/utils/ansi";

const ASCIINEMA_VERSION = 2;
const DEFAULT_CAST_COLOR = COLOR_PRIMARY_TEXT;

type CastHeader = {
  version: number;
  width: number;
  height: number;
  timestamp?: number;
  env?: Record<string, string>;
};

type CastOutputEvent = [number, "o", string];

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isCastHeader = (value: unknown): value is CastHeader => {
  return (
    isObject(value) &&
    value.version === ASCIINEMA_VERSION &&
    typeof value.width === "number" &&
    Number.isFinite(value.width) &&
    typeof value.height === "number" &&
    Number.isFinite(value.height)
  );
};

const isCastOutputEvent = (value: unknown): value is CastOutputEvent => {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    value[1] === "o" &&
    typeof value[2] === "string"
  );
};

const parseCastLines = (raw: string) => {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
};

export const isLikelyAsciinemaCast = (raw: string) => {
  const [headerLine] = parseCastLines(raw);
  if (!headerLine?.trim()) return false;

  try {
    const parsed = JSON.parse(headerLine) as unknown;
    return isCastHeader(parsed);
  } catch {
    return false;
  }
};

const parseCsiSequenceAt = (input: string, index: number) => {
  if (input[index] !== "\u001b" || input[index + 1] !== "[") return null;

  let end = index + 2;
  while (end < input.length && !/[A-Za-z~]/.test(input[end])) {
    end += 1;
  }

  if (end >= input.length) return null;

  const finalByte = input[end];
  const body = input.slice(index + 2, end);
  return {
    body,
    finalByte,
    nextIndex: end + 1,
  };
};

const ansiTextToGrid = (
  input: string,
  size: AnimationCanvasSize
): [string, GridCell][] => {
  const cells = new Map<string, GridCell>();
  let x = 0;
  let y = 0;
  let index = 0;
  const defaultStyle: AnsiStyleState = { color: DEFAULT_CAST_COLOR };
  let style: AnsiStyleState = { color: DEFAULT_CAST_COLOR };

  while (index < input.length) {
    const sgrSequence = parseSgrSequenceAt(input, index, style, defaultStyle);
    if (sgrSequence) {
      style = sgrSequence.style;
      index = sgrSequence.nextIndex;
      continue;
    }

    const sequence = parseCsiSequenceAt(input, index);
    if (sequence) {
      index = sequence.nextIndex;
      continue;
    }

    if (input[index] === "\r") {
      x = 0;
      index += 1;
      continue;
    }

    if (input[index] === "\n") {
      x = 0;
      y += 1;
      index += 1;
      continue;
    }

    const char = splitGraphemes(input.slice(index))[0] ?? input[index];
    const width = getCellOccupancy(char);

    if (char !== " " && x >= 0 && y >= 0 && x < size.width && y < size.height) {
      cells.set(GridManager.toKey(x, y), styleStateToCell(char, style));
    }

    x += width;
    index += char.length;
  }

  return Array.from(cells.entries());
};

const deriveFps = (times: number[]) => {
  const deltas = times
    .slice(1)
    .map((time, index) => time - times[index])
    .filter((delta) => Number.isFinite(delta) && delta > 0);

  if (deltas.length === 0) return DEFAULT_ANIMATION_FPS;

  const averageDelta =
    deltas.reduce((total, delta) => total + delta, 0) / deltas.length;
  return Math.max(1, Math.min(MAX_ANIMATION_FPS, Math.round(1 / averageDelta)));
};

export const parseAsciinemaCast = (raw: string): ProtocolImportSnapshot => {
  const lines = parseCastLines(raw).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("Invalid asciinema cast payload.");
  }

  const header = JSON.parse(lines[0]) as unknown;
  if (!isCastHeader(header)) {
    throw new Error("Invalid asciinema cast header.");
  }

  const size: AnimationCanvasSize = {
    width: Math.max(1, Math.min(512, Math.floor(header.width))),
    height: Math.max(1, Math.min(512, Math.floor(header.height))),
  };
  const events = lines
    .slice(1)
    .map((line) => JSON.parse(line) as unknown)
    .filter(isCastOutputEvent)
    .filter((event) => event[2].length > 0);

  if (events.length === 0) {
    throw new Error("Asciinema cast contains no output frames.");
  }

  const frames = events.map((event, index) => ({
    id: createAnimationFrameId(),
    name: `Frame ${index + 1}`,
    grid: ansiTextToGrid(event[2], size),
  }));
  const timeline: AnimationTimeline = {
    frames,
    currentFrameId: frames[0].id,
    fps: deriveFps(events.map((event) => event[0])),
    loop: true,
    onionSkin: {
      ...DEFAULT_ONION_SKIN,
      opacityFalloff: [...DEFAULT_ONION_SKIN.opacityFalloff],
    },
  };

  return {
    mode: "animation",
    scene: [],
    components: [],
    size,
    timeline,
    grid: frames[0].grid,
  };
};
