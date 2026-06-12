import type {
  AnimationCanvasSize,
  AnimationFrame,
  AnimationTimeline,
  GridCell,
  GridPoint,
  Point,
  SelectionArea,
} from "@/shared/types";
import { DEFAULT_GRID_RENDER_METRICS } from "@/shared/metrics";

export const DEFAULT_ANIMATION_SIZE: AnimationCanvasSize = {
  width: 80,
  height: 25,
};

export const DEFAULT_ANIMATION_FPS = 10;
export const DEFAULT_ANIMATION_FRAME_NAME = "Frame";

export const DEFAULT_ONION_SKIN = {
  enabled: true,
  backwardLayers: 2,
  forwardLayers: 2,
  opacityFalloff: [0.5, 0.3, 0.1],
} satisfies AnimationTimeline["onionSkin"];

const clampNumber = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

export const createAnimationFrameId = () => {
  return `frame-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
};

const getTrimmedFrameName = (name: string | null | undefined) => {
  return typeof name === "string" ? name.trim() : "";
};

const buildFrameNameSet = (
  existingFrames: Array<Pick<AnimationFrame, "id" | "name">>,
  excludeFrameId?: string
) => {
  return new Set(
    existingFrames
      .filter((frame) => frame.id !== excludeFrameId)
      .map((frame) => getTrimmedFrameName(frame.name).toLocaleLowerCase())
      .filter(Boolean)
  );
};

export const getUniqueAnimationFrameName = (
  existingFrames: Array<Pick<AnimationFrame, "id" | "name">>,
  preferredName: string,
  excludeFrameId?: string
) => {
  const trimmedName = getTrimmedFrameName(preferredName);
  if (!trimmedName) {
    return createNextAnimationFrameName(existingFrames);
  }

  const usedNames = buildFrameNameSet(existingFrames, excludeFrameId);
  if (!usedNames.has(trimmedName.toLocaleLowerCase())) {
    return trimmedName;
  }

  let duplicateIndex = 2;
  while (usedNames.has(`${trimmedName} ${duplicateIndex}`.toLocaleLowerCase())) {
    duplicateIndex += 1;
  }
  return `${trimmedName} ${duplicateIndex}`;
};

export const createNextAnimationFrameName = (
  existingFrames: Array<Pick<AnimationFrame, "id" | "name">>
) => {
  const usedNames = buildFrameNameSet(existingFrames);
  let frameNumber = 1;
  while (
    usedNames.has(
      `${DEFAULT_ANIMATION_FRAME_NAME} ${frameNumber}`.toLocaleLowerCase()
    )
  ) {
    frameNumber += 1;
  }
  return `${DEFAULT_ANIMATION_FRAME_NAME} ${frameNumber}`;
};

export const createDuplicateAnimationFrameName = (
  existingFrames: Array<Pick<AnimationFrame, "id" | "name">>,
  sourceName: string
) => {
  const trimmedSourceName =
    getTrimmedFrameName(sourceName) || DEFAULT_ANIMATION_FRAME_NAME;
  return getUniqueAnimationFrameName(
    existingFrames,
    `${trimmedSourceName} Copy`
  );
};

export const normalizeAnimationCanvasSize = (
  size: Partial<AnimationCanvasSize> | null | undefined
): AnimationCanvasSize => {
  if (!size) return { ...DEFAULT_ANIMATION_SIZE };
  const width = Number.isFinite(size.width)
    ? clampNumber(Math.floor(size.width as number), 1, 512)
    : DEFAULT_ANIMATION_SIZE.width;
  const height = Number.isFinite(size.height)
    ? clampNumber(Math.floor(size.height as number), 1, 512)
    : DEFAULT_ANIMATION_SIZE.height;
  return { width, height };
};

export const cloneAnimationFrame = (frame: AnimationFrame): AnimationFrame => {
  return {
    id: frame.id,
    name: getTrimmedFrameName(frame.name) || DEFAULT_ANIMATION_FRAME_NAME,
    grid: frame.grid.map(([key, cell]) => [key, { ...cell }] satisfies [string, GridCell]),
  };
};

export const createEmptyAnimationFrame = (
  frameId = createAnimationFrameId(),
  name = DEFAULT_ANIMATION_FRAME_NAME
): AnimationFrame => {
  return {
    id: frameId,
    name: getTrimmedFrameName(name) || DEFAULT_ANIMATION_FRAME_NAME,
    grid: [],
  };
};

export const normalizeOpacityFalloff = (value: unknown) => {
  if (!Array.isArray(value)) return [...DEFAULT_ONION_SKIN.opacityFalloff];
  const normalized = value
    .map((entry) => (typeof entry === "number" ? entry : Number.NaN))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => clampNumber(entry, 0, 1));
  return normalized.length > 0
    ? normalized
    : [...DEFAULT_ONION_SKIN.opacityFalloff];
};

export const normalizeOnionSkinSettings = (
  value: unknown
): AnimationTimeline["onionSkin"] => {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<AnimationTimeline["onionSkin"]>)
      : {};
  return {
    enabled:
      typeof raw.enabled === "boolean"
        ? raw.enabled
        : DEFAULT_ONION_SKIN.enabled,
    backwardLayers:
      typeof raw.backwardLayers === "number"
        ? clampNumber(Math.floor(raw.backwardLayers), 0, 5)
        : DEFAULT_ONION_SKIN.backwardLayers,
    forwardLayers:
      typeof raw.forwardLayers === "number"
        ? clampNumber(Math.floor(raw.forwardLayers), 0, 5)
        : DEFAULT_ONION_SKIN.forwardLayers,
    opacityFalloff: normalizeOpacityFalloff(raw.opacityFalloff),
  };
};

export const cloneAnimationTimeline = (
  timeline: AnimationTimeline
): AnimationTimeline => {
  return {
    frames: timeline.frames.map((frame) => cloneAnimationFrame(frame)),
    currentFrameId: timeline.currentFrameId,
    fps: timeline.fps,
    loop: timeline.loop,
    onionSkin: {
      ...timeline.onionSkin,
      opacityFalloff: [...timeline.onionSkin.opacityFalloff],
    },
  };
};

export const normalizeAnimationTimeline = (
  timeline: Partial<AnimationTimeline> | null | undefined,
  fallbackGrid: [string, GridCell][] = []
): AnimationTimeline => {
  const rawFrames = Array.isArray(timeline?.frames) ? timeline.frames : [];
  const frames = rawFrames.reduce<AnimationFrame[]>((accumulator, frame) => {
    if (!frame || typeof frame !== "object" || typeof frame.id !== "string") {
      return accumulator;
    }
    accumulator.push({
      id: frame.id,
      name: getTrimmedFrameName(
        typeof frame.name === "string" ? frame.name : undefined
      )
        ? getUniqueAnimationFrameName(accumulator, frame.name)
        : createNextAnimationFrameName(accumulator),
      grid: Array.isArray(frame.grid)
        ? frame.grid
            .filter(
              (entry): entry is [string, GridCell] =>
                Array.isArray(entry) &&
                typeof entry[0] === "string" &&
                !!entry[1] &&
                typeof entry[1] === "object" &&
                typeof entry[1].char === "string" &&
                typeof entry[1].color === "string"
            )
            .map(
              ([key, cell]) =>
                [key, { char: cell.char, color: cell.color }] satisfies [
                  string,
                  GridCell,
                ]
            )
        : [],
    });
    return accumulator;
  }, []);

  const normalizedFrames =
    frames.length > 0
      ? frames
      : [
          {
            id: createAnimationFrameId(),
            name: createNextAnimationFrameName([]),
            grid: fallbackGrid.map(
              ([key, cell]) =>
                [key, { char: cell.char, color: cell.color }] satisfies [
                  string,
                  GridCell,
                ]
            ),
          },
        ];

  const currentFrameId =
    typeof timeline?.currentFrameId === "string" &&
    normalizedFrames.some((frame) => frame.id === timeline.currentFrameId)
      ? timeline.currentFrameId
      : normalizedFrames[0].id;

  return {
    frames: normalizedFrames.map((frame) => cloneAnimationFrame(frame)),
    currentFrameId,
    fps:
      typeof timeline?.fps === "number"
        ? clampNumber(Math.round(timeline.fps), 1, 24)
        : DEFAULT_ANIMATION_FPS,
    loop: typeof timeline?.loop === "boolean" ? timeline.loop : true,
    onionSkin: normalizeOnionSkinSettings(timeline?.onionSkin),
  };
};

export const getAnimationFrameIndex = (
  timeline: AnimationTimeline,
  frameId: string
) => {
  return timeline.frames.findIndex((frame) => frame.id === frameId);
};

export const getAnimationFrameEntries = (
  timeline: AnimationTimeline,
  frameId = timeline.currentFrameId
) => {
  const frame =
    timeline.frames.find((entry) => entry.id === frameId) ?? timeline.frames[0];
  return frame
    ? frame.grid.map(
        ([key, cell]) =>
          [key, { char: cell.char, color: cell.color }] satisfies [
            string,
            GridCell,
          ]
      )
    : [];
};

export const updateAnimationFrameEntries = (
  timeline: AnimationTimeline,
  frameId: string,
  grid: [string, GridCell][]
): AnimationTimeline => {
  const next = cloneAnimationTimeline(timeline);
  const targetIndex = getAnimationFrameIndex(next, frameId);
  if (targetIndex === -1) return next;
  next.frames[targetIndex] = {
    ...next.frames[targetIndex],
    grid: grid.map(
      ([key, cell]) =>
        [key, { char: cell.char, color: cell.color }] satisfies [string, GridCell]
    ),
  };
  return next;
};

export const clampPointToBounds = (
  point: Point,
  bounds: AnimationCanvasSize | null
): Point => {
  if (!bounds) return { ...point };
  return {
    x: clampNumber(point.x, 0, bounds.width - 1),
    y: clampNumber(point.y, 0, bounds.height - 1),
  };
};

export const isPointWithinBounds = (
  point: Point,
  bounds: AnimationCanvasSize | null
) => {
  if (!bounds) return true;
  return (
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < bounds.width &&
    point.y < bounds.height
  );
};

export const clampSelectionToBounds = (
  area: SelectionArea,
  bounds: AnimationCanvasSize | null
): SelectionArea => {
  if (!bounds) {
    return {
      start: { ...area.start },
      end: { ...area.end },
    };
  }
  return {
    start: clampPointToBounds(area.start, bounds),
    end: clampPointToBounds(area.end, bounds),
  };
};

export const filterPointsToBounds = (
  points: Point[],
  bounds: AnimationCanvasSize | null
) => {
  if (!bounds) return points.map((point) => ({ ...point }));
  return points.filter((point) => isPointWithinBounds(point, bounds));
};

export const filterGridPointsToBounds = (
  points: GridPoint[],
  bounds: AnimationCanvasSize | null
) => {
  if (!bounds) return points.map((point) => ({ ...point }));
  return points.filter((point) => isPointWithinBounds(point, bounds));
};

export const getCenteredAnimationOffset = (
  bounds: AnimationCanvasSize,
  containerSize: { width: number; height: number },
  zoom: number
): Point => {
  const { cellWidth, cellHeight } = DEFAULT_GRID_RENDER_METRICS;
  return {
    x: (containerSize.width - bounds.width * cellWidth * zoom) / 2,
    y: (containerSize.height - bounds.height * cellHeight * zoom) / 2,
  };
};
