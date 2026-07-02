import type {
  Point,
  StructuredBoxNode,
  StructuredLineNode,
  StructuredNode,
  StructuredNodeStyle,
  StructuredSplitBoxNode,
  StructuredTextStyleRange,
} from "@/shared/types";

export type StructuredTemplateId =
  | "button"
  | "badge"
  | "input"
  | "checkbox"
  | "radio"
  | "divider"
  | "card"
  | "textarea"
  | "status"
  | "accordion"
  | "switch"
  | "alert"
  | "tabs"
  | "avatar"
  | "breadcrumb"
  | "calendar"
  | "barChart"
  | "lineChart"
  | "table"
  | "pagination"
  | "slider"
  | "progress"
  | "scrollArea";

export type StructuredTemplateBuildOptions = {
  brushColor: string;
  startOrder: number;
};

export type StructuredComponentFactory = {
  createText: (
    text: string,
    offset?: Point,
    orderOffset?: number,
    styleRanges?: StructuredTextStyleRange[],
    style?: StructuredNodeStyle
  ) => StructuredNode;
  createBg: (
    width: number,
    colorIndex: number,
    orderOffset?: number,
    offset?: Point,
    height?: number,
    color?: string
  ) => StructuredNode;
  createBox: (
    width: number,
    height: number,
    orderOffset?: number,
    offset?: Point,
    style?: StructuredNodeStyle
  ) => StructuredBoxNode;
  createLine: (
    width: number,
    orderOffset?: number,
    offset?: Point,
    style?: StructuredNodeStyle
  ) => StructuredLineNode;
  createSplitBox: (
    width: number,
    height: number,
    orderOffset?: number,
    offset?: Point,
    ratios?: {
      verticalSplitRatio: number;
      topSplitRatio: number;
      bottomSplitRatio: number;
    },
    style?: StructuredNodeStyle
  ) => StructuredSplitBoxNode;
};

export type StructuredComponentDefinition = {
  id: StructuredTemplateId;
  label: string;
  build: (factory: StructuredComponentFactory) => StructuredNode[];
};
