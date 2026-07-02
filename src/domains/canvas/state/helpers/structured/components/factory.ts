import type {
  Point,
  StructuredBoxNode,
  StructuredLineNode,
  StructuredNode,
  StructuredNodeStyle,
  StructuredSplitBoxNode,
  StructuredTextStyleRange,
} from "@/shared/types";
import { createStructuredNodeId } from "@/shared/utils/structured";
import { createDefaultSplitBoxRoot } from "@/shared/utils/shapes";
import type {
  StructuredComponentFactory,
  StructuredTemplateBuildOptions,
} from "./types";

export const STRUCTURED_TEMPLATE_TEXT_COLOR = "#000000";
export const STRUCTURED_TEMPLATE_FALLBACK_COLORS = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#e2e8f0",
] as const;

const getTemplateBgColor = (index: number) =>
  STRUCTURED_TEMPLATE_FALLBACK_COLORS[
    index % STRUCTURED_TEMPLATE_FALLBACK_COLORS.length
  ];

export const createStructuredComponentFactory = (
  position: Point,
  options: StructuredTemplateBuildOptions
): StructuredComponentFactory => {
  const textStyle = { color: STRUCTURED_TEMPLATE_TEXT_COLOR };

  const createText = (
    text: string,
    offset: Point = { x: 0, y: 0 },
    orderOffset = 0,
    styleRanges?: StructuredTextStyleRange[],
    style: StructuredNodeStyle = textStyle
  ): StructuredNode => ({
    id: createStructuredNodeId(),
    type: "text",
    order: options.startOrder + orderOffset,
    position: { x: position.x + offset.x, y: position.y + offset.y },
    text,
    style,
    ...(styleRanges ? { styleRanges } : {}),
  });

  const createBg = (
    width: number,
    colorIndex: number,
    orderOffset = 0,
    offset: Point = { x: 0, y: 0 },
    height = 1,
    color: string = getTemplateBgColor(colorIndex)
  ): StructuredNode => ({
    id: createStructuredNodeId(),
    type: "bg",
    order: options.startOrder + orderOffset,
    start: { x: position.x + offset.x, y: position.y + offset.y },
    end: {
      x: position.x + offset.x + width - 1,
      y: position.y + offset.y + height - 1,
    },
    style: {
      color: STRUCTURED_TEMPLATE_TEXT_COLOR,
      bgColor: color,
    },
  });

  const createBox = (
    width: number,
    height: number,
    orderOffset = 0,
    offset: Point = { x: 0, y: 0 },
    style: StructuredNodeStyle = textStyle
  ): StructuredBoxNode => ({
    id: createStructuredNodeId(),
    type: "box",
    order: options.startOrder + orderOffset,
    start: { x: position.x + offset.x, y: position.y + offset.y },
    end: {
      x: position.x + offset.x + width - 1,
      y: position.y + offset.y + height - 1,
    },
    style,
  });

  const createLine = (
    width: number,
    orderOffset = 0,
    offset: Point = { x: 0, y: 0 },
    style: StructuredNodeStyle = textStyle
  ): StructuredLineNode => ({
    id: createStructuredNodeId(),
    type: "line",
    order: options.startOrder + orderOffset,
    start: { x: position.x + offset.x, y: position.y + offset.y },
    end: { x: position.x + offset.x + width - 1, y: position.y + offset.y },
    axis: "horizontal",
    style,
  });

  const createSplitBox = (
    width: number,
    height: number,
    orderOffset = 0,
    offset: Point = { x: 0, y: 0 },
    ratios = {
      verticalSplitRatio: 0.36,
      topSplitRatio: 0.25,
      bottomSplitRatio: 0.75,
    },
    style: StructuredNodeStyle = textStyle
  ): StructuredSplitBoxNode => ({
    id: createStructuredNodeId(),
    type: "splitBox",
    order: options.startOrder + orderOffset,
    start: { x: position.x + offset.x, y: position.y + offset.y },
    end: {
      x: position.x + offset.x + width - 1,
      y: position.y + offset.y + height - 1,
    },
    verticalSplitRatio: ratios.verticalSplitRatio,
    topSplitRatio: ratios.topSplitRatio,
    bottomSplitRatio: ratios.bottomSplitRatio,
    root: createDefaultSplitBoxRoot(ratios),
    style,
  });

  return { createText, createBg, createBox, createLine, createSplitBox };
};
