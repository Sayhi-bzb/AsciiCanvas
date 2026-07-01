import type { Point, StructuredNode } from "@/shared/types";
import { createStructuredNodeId } from "@/shared/utils/structured";

export const STRUCTURED_TEMPLATE_MIME =
  "application/x-ascii-canvas-structured-template";

export type StructuredTemplateId = "button";

export const STRUCTURED_TEMPLATE_TEXT_COLOR = "#000000";
export const STRUCTURED_TEMPLATE_FALLBACK_COLORS = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#e2e8f0",
] as const;

export const STRUCTURED_TEMPLATES: Array<{
  id: StructuredTemplateId;
  label: string;
  thumbnail: string;
  dragPreview: string;
}> = [
  {
    id: "button",
    label: "Button",
    thumbnail: "[BUTTON]",
    dragPreview: " BUTTON ",
  },
];

export const isStructuredTemplateId = (
  value: string | null
): value is StructuredTemplateId => value === "button";

export const buildStructuredTemplateNodes = (
  templateId: StructuredTemplateId,
  position: Point,
  options: {
    brushColor: string;
    startOrder: number;
  }
): StructuredNode[] => {
  if (templateId !== "button") return [];

  const bgId = createStructuredNodeId();
  const textId = createStructuredNodeId();

  return [
    {
      id: bgId,
      type: "bg",
      order: options.startOrder,
      start: { x: position.x, y: position.y },
      end: { x: position.x + 7, y: position.y },
      style: {
        color: STRUCTURED_TEMPLATE_TEXT_COLOR,
        bgColor: STRUCTURED_TEMPLATE_FALLBACK_COLORS[0],
      },
    },
    {
      id: textId,
      type: "text",
      order: options.startOrder + 1,
      position: { x: position.x + 1, y: position.y },
      text: "BUTTON",
      style: { color: STRUCTURED_TEMPLATE_TEXT_COLOR },
    },
  ];
};
