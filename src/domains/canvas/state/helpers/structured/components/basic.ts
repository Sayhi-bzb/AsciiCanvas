import type { StructuredComponentDefinition } from "./types";

export const BASIC_COMPONENTS: StructuredComponentDefinition[] = [
  {
    id: "button",
    label: "Button",
    build: ({ createBg, createText }) => [
      createBg(8, 0),
      createText("[BUTTON]", { x: 0, y: 0 }, 1),
    ],
  },
  {
    id: "badge",
    label: "Badge",
    build: ({ createBg, createText }) => [
      createBg(9, 1, 0, { x: 0, y: 0 }, 1, "#dcfcf3"),
      createText(" badge", { x: 1, y: 0 }, 1, undefined, {
        color: "#0d9488",
      }),
    ],
  },
  {
    id: "switch",
    label: "Switch",
    build: ({ createText }) => [createText("󰨙 Switch")],
  },
  {
    id: "breadcrumb",
    label: "Breadcrumb",
    build: ({ createText }) => [
      createText("BreadcrumbItem / ... / BreadcrumbItem"),
    ],
  },
];
