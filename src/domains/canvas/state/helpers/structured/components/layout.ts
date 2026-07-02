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
      ]),
    ],
  },
  {
    id: "divider",
    label: "Divider",
    build: ({ createLine }) => [createLine(12)],
  },
  {
    id: "card",
    label: "Card",
    build: ({ createBox }) => {
      const node = createBox(16, 5);
      return [{ ...node, name: "Card" }];
    },
  },
  {
    id: "accordion",
    label: "Accordion",
    build: ({ createBg, createText }) => [
      createBg(20, 4, 0, { x: 0, y: 1 }, 2),
      createText("Accordion          󰅃", { x: 0, y: 0 }, 1, undefined, {
        color: STRUCTURED_TEMPLATE_TEXT_COLOR,
        attrs: { bold: true, underline: true },
      }),
      createText("AccordionContent", { x: 0, y: 1 }, 2),
      createText("Accordion          󰅀", { x: 0, y: 3 }, 3, undefined, {
        color: STRUCTURED_TEMPLATE_TEXT_COLOR,
        attrs: { bold: true },
      }),
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
      ]),
    ],
  },
  {
    id: "scrollArea",
    label: "Scroll area",
    build: ({ createText }) => [
      createText("ScrollArea │", { x: 0, y: 0 }, 0),
      createText("├─Item     █", { x: 0, y: 1 }, 1, [
        { start: 10, end: 11, style: { color: "#3b82f6" } },
      ]),
      createText("├─Item     │", { x: 0, y: 2 }, 2),
      createText("└─Item     │", { x: 0, y: 3 }, 3),
    ],
  },
];
