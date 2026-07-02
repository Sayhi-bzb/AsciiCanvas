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
  | "safari"
  | "textarea"
  | "status"
  | "accordion"
  | "switch"
  | "alert"
  | "tabs"
  | "avatar"
  | "breadcrumb"
  | "filetree"
  | "timeline"
  | "snippet"
  | "terminal"
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
  templateId?: StructuredTemplateId;
};

export type StructuredComponentFactory = {
  createText: (
    text: string,
    offset?: Point,
    orderOffset?: number,
    styleRanges?: StructuredTextStyleRange[],
    style?: StructuredNodeStyle,
    role?: string
  ) => StructuredNode;
  createBg: (
    width: number,
    colorIndex: number,
    orderOffset?: number,
    offset?: Point,
    height?: number,
    color?: string,
    role?: string
  ) => StructuredNode;
  createBox: (
    width: number,
    height: number,
    orderOffset?: number,
    offset?: Point,
    style?: StructuredNodeStyle,
    role?: string
  ) => StructuredBoxNode;
  createLine: (
    width: number,
    orderOffset?: number,
    offset?: Point,
    style?: StructuredNodeStyle,
    role?: string,
    axis?: "vertical" | "horizontal"
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
    style?: StructuredNodeStyle,
    role?: string
  ) => StructuredSplitBoxNode;
};

export type StructuredComponentDefinition = {
  id: StructuredTemplateId;
  label: string;
  build: (factory: StructuredComponentFactory) => StructuredNode[];
};
