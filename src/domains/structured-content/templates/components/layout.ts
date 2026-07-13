import { STRUCTURED_TEMPLATE_TEXT_COLOR } from "./factory";
import type { StructuredComponentDefinition } from "./types";

export const LAYOUT_COMPONENTS: StructuredComponentDefinition[] = [
  {
    id: "tabs",
    label: "Tabs",
    build: ({ createText }) => [
      createText("tab 1 | tab 2 | tab 3", { x: 0, y: 0 }, 0, [
        {
          start: 7,
          end: 14,
          style: {
            color: "#2563eb",
            bgColor: "#eff6ff",
            attrs: { underline: true },
          },
        },
      ], undefined, "tabList"),
    ],
  },
  {
    id: "divider",
    label: "Divider",
    build: ({ createLine }) => [
      createLine(12, undefined, undefined, undefined, "divider"),
    ],
  },
  {
    id: "card",
    label: "Card",
    build: ({ createSplitBox, createText }) => {
      const container = createSplitBox(
        21,
        10,
        0,
        { x: 0, y: 0 },
        {
          verticalSplitRatio: 0.5,
          topSplitRatio: 2 / 9,
          bottomSplitRatio: 7 / 9,
        },
        undefined,
        "container"
      );
      return [
        {
          ...container,
          root: {
            type: "split",
            id: "split-title",
            axis: "horizontal",
            ratio: 2 / 9,
            first: { type: "leaf", id: "leaf-title" },
            second: {
              type: "split",
              id: "split-footer",
              axis: "horizontal",
              ratio: 5 / 7,
              first: { type: "leaf", id: "leaf-content" },
              second: { type: "leaf", id: "leaf-footer" },
            },
          },
        },
        createText("CardTitle", { x: 1, y: 1 }, 1, undefined, undefined, "title"),
        createText("CardContent", { x: 1, y: 3 }, 2, undefined, undefined, "content"),
        createText("CardFooter", { x: 1, y: 8 }, 3, undefined, undefined, "footer"),
      ];
    },
  },
  {
    id: "accordion",
    label: "Accordion",
    build: ({ createBg, createText }) => [
      createBg(20, 4, 0, { x: 0, y: 1 }, 2, undefined, "contentFill"),
      createText("Accordion          󰅃", { x: 0, y: 0 }, 1, undefined, {
        color: STRUCTURED_TEMPLATE_TEXT_COLOR,
        attrs: { bold: true, underline: true },
      }, "header"),
      createText("AccordionContent", { x: 0, y: 1 }, 2, undefined, undefined, "content"),
      createText("Accordion          󰅀", { x: 0, y: 3 }, 3, undefined, {
        color: STRUCTURED_TEMPLATE_TEXT_COLOR,
        attrs: { bold: true },
      }, "collapsedHeader"),
    ],
  },
  {
    id: "pagination",
    label: "Pagination",
    build: ({ createText }) => [
      createText("< Previous  1  2  3    Next >", { x: 0, y: 0 }, 0, [
        {
          start: 17,
          end: 20,
          style: {
            color: "#1d4ed8",
            bgColor: "#dbeafe",
            attrs: { bold: true },
          },
        },
      ], undefined, "items"),
    ],
  },
  {
    id: "scrollArea",
    label: "Scroll area",
    build: ({ createText }) => [
      createText("ScrollArea │", { x: 0, y: 0 }, 0, undefined, undefined, "header"),
      createText("├─Item     █", { x: 0, y: 1 }, 1, [
        { start: 10, end: 11, style: { color: "#3b82f6" } },
      ], undefined, "itemWithThumb"),
      createText("├─Item     │", { x: 0, y: 2 }, 2, undefined, undefined, "item"),
      createText("└─Item     │", { x: 0, y: 3 }, 3, undefined, undefined, "item"),
    ],
  },
];
