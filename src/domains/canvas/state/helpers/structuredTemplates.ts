import type { Point, StructuredBoxNode, StructuredNode } from "@/shared/types";
import { createStructuredNodeId } from "@/shared/utils/structured";

export const STRUCTURED_TEMPLATE_MIME =
  "application/x-ascii-canvas-structured-template";

export type StructuredTemplateId =
  | "button"
  | "label"
  | "badge"
  | "input"
  | "checkbox"
  | "radio"
  | "divider"
  | "card"
  | "textarea"
  | "select"
  | "link"
  | "listItem"
  | "field"
  | "formRow";

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

export const STRUCTURED_TEMPLATES: Array<{
  id: StructuredTemplateId;
  label: string;
}> = [
  {
    id: "button",
    label: "Button",
  },
  {
    id: "label",
    label: "Label",
  },
  {
    id: "badge",
    label: "Badge",
  },
  {
    id: "input",
    label: "Input",
  },
  {
    id: "checkbox",
    label: "Checkbox",
  },
  {
    id: "radio",
    label: "Radio",
  },
  {
    id: "divider",
    label: "Divider",
  },
  {
    id: "card",
    label: "Card",
  },
  {
    id: "textarea",
    label: "Textarea",
  },
  {
    id: "select",
    label: "Select",
  },
  {
    id: "link",
    label: "Link",
  },
  {
    id: "listItem",
    label: "List item",
  },
  {
    id: "field",
    label: "Field",
  },
  {
    id: "formRow",
    label: "Form row",
  },
];

let activeStructuredTemplateDragId: StructuredTemplateId | null = null;

export const setActiveStructuredTemplateDragId = (
  templateId: StructuredTemplateId | null
) => {
  activeStructuredTemplateDragId = templateId;
};

export const getActiveStructuredTemplateDragId = () =>
  activeStructuredTemplateDragId;

export type StructuredTemplatePreviewCell = {
  char: string;
  color?: string;
  bgColor?: string;
};

export type StructuredTemplatePreview = {
  rows: StructuredTemplatePreviewCell[][];
  width: number;
  height: number;
};

export const isStructuredTemplateId = (
  value: string | null
): value is StructuredTemplateId =>
  STRUCTURED_TEMPLATES.some((template) => template.id === value);

export const buildStructuredTemplateNodes = (
  templateId: StructuredTemplateId,
  position: Point,
  options: {
    brushColor: string;
    startOrder: number;
  }
): StructuredNode[] => {
  const textStyle = { color: STRUCTURED_TEMPLATE_TEXT_COLOR };
  const createText = (
    text: string,
    offset: Point = { x: 0, y: 0 },
    orderOffset = 0
  ): StructuredNode => ({
    id: createStructuredNodeId(),
    type: "text",
    order: options.startOrder + orderOffset,
    position: { x: position.x + offset.x, y: position.y + offset.y },
    text,
    style: textStyle,
  });
  const createBg = (
    width: number,
    colorIndex: number,
    orderOffset = 0
  ): StructuredNode => ({
    id: createStructuredNodeId(),
    type: "bg",
    order: options.startOrder + orderOffset,
    start: { x: position.x, y: position.y },
    end: { x: position.x + width - 1, y: position.y },
    style: {
      color: STRUCTURED_TEMPLATE_TEXT_COLOR,
      bgColor: getTemplateBgColor(colorIndex),
    },
  });
  const createBox = (
    width: number,
    height: number,
    orderOffset = 0,
    offset: Point = { x: 0, y: 0 }
  ): StructuredBoxNode => ({
    id: createStructuredNodeId(),
    type: "box",
    order: options.startOrder + orderOffset,
    start: { x: position.x + offset.x, y: position.y + offset.y },
    end: {
      x: position.x + offset.x + width - 1,
      y: position.y + offset.y + height - 1,
    },
    style: textStyle,
  });

  switch (templateId) {
    case "button":
      return [createBg(8, 0), createText("BUTTON", { x: 1, y: 0 }, 1)];
    case "label":
      return [createText("Label")];
    case "badge":
      return [createBg(8, 1), createText("STATUS", { x: 1, y: 0 }, 1)];
    case "input":
      return [createBox(14, 3), createText("Enter text", { x: 2, y: 1 }, 1)];
    case "checkbox":
      return [createText("[ ] Label")];
    case "radio":
      return [createText("( ) Option")];
    case "divider":
      return [
        {
          id: createStructuredNodeId(),
          type: "line",
          order: options.startOrder,
          start: { x: position.x, y: position.y },
          end: { x: position.x + 11, y: position.y },
          axis: "horizontal",
          style: textStyle,
        },
      ];
    case "card": {
      const node = createBox(16, 5);
      return [{ ...node, name: "Card" }];
    }
    case "textarea":
      return [
        createBox(18, 5),
        createText("Multiline", { x: 2, y: 1 }, 1),
        createText("text...", { x: 2, y: 2 }, 2),
      ];
    case "select":
      return [
        createBox(14, 3),
        createText("Option", { x: 2, y: 1 }, 1),
        createText("v", { x: 11, y: 1 }, 2),
      ];
    case "link":
      return [createText("Link ->")];
    case "listItem":
      return [createText("- Item")];
    case "field":
      return [
        createText("Label"),
        createBox(16, 3, 1, { x: 0, y: 1 }),
        createText("Value", { x: 2, y: 2 }, 2),
      ];
    case "formRow":
      return [
        createText("Label", { x: 0, y: 1 }),
        createBox(18, 3, 1, { x: 8, y: 0 }),
        createText("Value", { x: 10, y: 1 }, 2),
      ];
    default:
      return [];
  }
};

export const buildStructuredTemplatePreview = (
  templateId: StructuredTemplateId
): StructuredTemplatePreview => {
  const nodes = buildStructuredTemplateNodes(templateId, { x: 0, y: 0 }, {
    brushColor: STRUCTURED_TEMPLATE_FALLBACK_COLORS[0],
    startOrder: 1,
  });

  if (nodes.length === 0) return { rows: [], width: 0, height: 0 };

  let maxX = 0;
  let maxY = 0;
  nodes.forEach((node) => {
    if (node.type === "text") {
      maxX = Math.max(maxX, node.position.x + node.text.length - 1);
      maxY = Math.max(maxY, node.position.y);
      return;
    }
    maxX = Math.max(maxX, node.start.x, node.end.x);
    maxY = Math.max(maxY, node.start.y, node.end.y);
  });

  const width = maxX + 1;
  const height = maxY + 1;
  const rows: StructuredTemplatePreviewCell[][] = Array.from(
    { length: height },
    () =>
      Array.from({ length: width }, () => ({
        char: " ",
        color: STRUCTURED_TEMPLATE_TEXT_COLOR,
      }))
  );

  nodes
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((node) => {
      if (node.type === "bg") {
        const minX = Math.min(node.start.x, node.end.x);
        const maxNodeX = Math.max(node.start.x, node.end.x);
        const minY = Math.min(node.start.y, node.end.y);
        const maxNodeY = Math.max(node.start.y, node.end.y);
        for (let y = minY; y <= maxNodeY; y++) {
          for (let x = minX; x <= maxNodeX; x++) {
            rows[y][x] = {
              ...rows[y][x],
              bgColor: node.style?.bgColor,
              color: node.style?.color ?? STRUCTURED_TEMPLATE_TEXT_COLOR,
            };
          }
        }
        return;
      }

      if (node.type === "text") {
        Array.from(node.text).forEach((char, index) => {
          const x = node.position.x + index;
          const y = node.position.y;
          if (!rows[y]?.[x]) return;
          rows[y][x] = {
            ...rows[y][x],
            char,
            color: node.style?.color ?? STRUCTURED_TEMPLATE_TEXT_COLOR,
          };
        });
        return;
      }

      if (node.type === "line") {
        const minX = Math.min(node.start.x, node.end.x);
        const maxNodeX = Math.max(node.start.x, node.end.x);
        const minY = Math.min(node.start.y, node.end.y);
        const maxNodeY = Math.max(node.start.y, node.end.y);
        for (let y = minY; y <= maxNodeY; y++) {
          for (let x = minX; x <= maxNodeX; x++) {
            rows[y][x] = {
              char: node.axis === "vertical" ? "│" : "─",
              color: node.style?.color ?? STRUCTURED_TEMPLATE_TEXT_COLOR,
            };
          }
        }
        return;
      }

      if (node.type === "box") {
        const minX = Math.min(node.start.x, node.end.x);
        const maxNodeX = Math.max(node.start.x, node.end.x);
        const minY = Math.min(node.start.y, node.end.y);
        const maxNodeY = Math.max(node.start.y, node.end.y);
        for (let y = minY; y <= maxNodeY; y++) {
          for (let x = minX; x <= maxNodeX; x++) {
            const isTop = y === minY;
            const isBottom = y === maxNodeY;
            const isLeft = x === minX;
            const isRight = x === maxNodeX;
            if (!isTop && !isBottom && !isLeft && !isRight) continue;
            const char =
              isTop && isLeft
                ? "╭"
                : isTop && isRight
                  ? "╮"
                  : isBottom && isLeft
                    ? "╰"
                    : isBottom && isRight
                      ? "╯"
                      : isTop || isBottom
                        ? "─"
                        : "│";
            rows[y][x] = {
              char,
              color: node.style?.color ?? STRUCTURED_TEMPLATE_TEXT_COLOR,
            };
          }
        }
        if (node.name) {
          const label = ` ${node.name} `;
          Array.from(label).forEach((char, index) => {
            const x = minX + 2 + index;
            if (x >= maxNodeX) return;
            rows[minY][x] = {
              char,
              color: node.style?.color ?? STRUCTURED_TEMPLATE_TEXT_COLOR,
            };
          });
        }
      }
    });

  return { rows, width, height };
};
