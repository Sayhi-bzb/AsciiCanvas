import type { TextAttributes } from "@/shared/types";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import { mergeStructuredTextStyle } from "../model/text-ranges";
import { getSplitBoxPoints } from "../model/split-box-geometry";
import {
  createStructuredComponentFactory,
  STRUCTURED_COMPONENTS,
  STRUCTURED_TEMPLATE_FALLBACK_COLORS,
  STRUCTURED_TEMPLATE_TEXT_COLOR,
  type StructuredTemplateBuildOptions,
  type StructuredTemplateId,
} from "./components";
import { STRUCTURED_PAGE_TEMPLATE_COMPONENTS } from "./pages";
import { normalizeStructuredComponents } from "../model/components";

export type { StructuredTemplateId };

export const STRUCTURED_TEMPLATE_MIME =
  "application/x-ascii-canvas-structured-template";

export type StructuredTemplateListItem = {
  id: StructuredTemplateId;
  label: string;
};

export const STRUCTURED_COMPONENT_TEMPLATES: StructuredTemplateListItem[] =
  STRUCTURED_COMPONENTS.map(({ id, label }) => ({ id, label }));

export const STRUCTURED_PAGE_TEMPLATES: StructuredTemplateListItem[] =
  STRUCTURED_PAGE_TEMPLATE_COMPONENTS.map(({ id, label }) => ({ id, label }));

export const STRUCTURED_TEMPLATES: StructuredTemplateListItem[] = [
  ...STRUCTURED_COMPONENT_TEMPLATES,
  ...STRUCTURED_PAGE_TEMPLATES,
];

const STRUCTURED_COMPONENT_BY_ID = new Map(
  [...STRUCTURED_COMPONENTS, ...STRUCTURED_PAGE_TEMPLATE_COMPONENTS].map(
    (component) => [component.id, component]
  )
);

let activeStructuredTemplateDragId: StructuredTemplateId | null = null;

export const setActiveStructuredTemplateDragId = (
  templateId: StructuredTemplateId | null
) => {
  activeStructuredTemplateDragId = templateId;
};

export const getActiveStructuredTemplateDragId = () =>
  activeStructuredTemplateDragId;

type StructuredTemplatePreviewCell = {
  char: string;
  color?: string;
  bgColor?: string;
  attrs?: TextAttributes;
};

export type StructuredTemplatePreview = {
  rows: StructuredTemplatePreviewCell[][];
  width: number;
  height: number;
};

type StructuredTemplateBuildResult = {
  nodes: StructuredNode[];
  components: StructuredComponentInstance[];
};

export const isStructuredTemplateId = (
  value: string | null
): value is StructuredTemplateId =>
  STRUCTURED_TEMPLATES.some((template) => template.id === value);

export const buildStructuredTemplate = (
  templateId: StructuredTemplateId,
  position: { x: number; y: number },
  options: StructuredTemplateBuildOptions
): StructuredTemplateBuildResult => {
  const component = STRUCTURED_COMPONENT_BY_ID.get(templateId);
  if (!component) return { nodes: [], components: [] };
  const nodes = component.build(
    createStructuredComponentFactory(position, { ...options, templateId })
  );
  return {
    nodes,
    components: normalizeStructuredComponents(undefined, nodes).map(
      (instance) => ({
        ...instance,
        label: component.label,
      })
    ),
  };
};

export const buildStructuredTemplateNodes = (
  templateId: StructuredTemplateId,
  position: { x: number; y: number },
  options: StructuredTemplateBuildOptions
): StructuredNode[] => {
  return buildStructuredTemplate(templateId, position, options).nodes;
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
      node.text.split("\n").forEach((line, rowIndex) => {
        maxX = Math.max(maxX, node.position.x + Array.from(line).length - 1);
        maxY = Math.max(maxY, node.position.y + rowIndex);
      });
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
        const lines = node.text.split("\n");
        let textOffset = 0;
        lines.forEach((line, rowIndex) => {
          Array.from(line).forEach((char, index) => {
            const x = node.position.x + index;
            const y = node.position.y + rowIndex;
            if (!rows[y]?.[x]) return;
            const style = mergeStructuredTextStyle(
              node.style,
              node.styleRanges,
              textOffset
            );
            rows[y][x] = {
              ...rows[y][x],
              char,
              color: style.color ?? STRUCTURED_TEMPLATE_TEXT_COLOR,
              bgColor: style.bgColor ?? rows[y][x].bgColor,
              attrs: style.attrs,
            };
            textOffset += 1;
          });
          if (rowIndex < lines.length - 1) textOffset += 1;
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

      if (node.type === "splitBox") {
        getSplitBoxPoints(node.start, node.end, {
          verticalSplitRatio: node.verticalSplitRatio,
          topSplitRatio: node.topSplitRatio,
          bottomSplitRatio: node.bottomSplitRatio,
          root: node.root,
        }).forEach((point) => {
          rows[point.y][point.x] = {
            char: point.char,
            color: node.style?.color ?? STRUCTURED_TEMPLATE_TEXT_COLOR,
          };
        });
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

const structuredTemplatePreviewCache = new Map<
  StructuredTemplateId,
  StructuredTemplatePreview
>();

export const getStructuredTemplatePreview = (
  templateId: StructuredTemplateId
): StructuredTemplatePreview => {
  const cached = structuredTemplatePreviewCache.get(templateId);
  if (cached) return cached;

  const preview = buildStructuredTemplatePreview(templateId);
  structuredTemplatePreviewCache.set(templateId, preview);
  return preview;
};
