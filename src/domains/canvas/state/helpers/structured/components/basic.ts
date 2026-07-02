import type { StructuredComponentDefinition } from "./types";

export const BASIC_COMPONENTS: StructuredComponentDefinition[] = [
  {
    id: "button",
    label: "Button",
    build: ({ createBg, createText }) => [
      createBg(8, 0, 0, { x: 0, y: 0 }, 1, undefined, "fill"),
      createText("[BUTTON]", { x: 0, y: 0 }, 1, undefined, undefined, "label"),
    ],
  },
  {
    id: "badge",
    label: "Badge",
    build: ({ createBg, createText }) => [
      createBg(9, 1, 0, { x: 0, y: 0 }, 1, "#dcfcf3", "fill"),
      createText(" badge", { x: 1, y: 0 }, 1, undefined, {
        color: "#0d9488",
      }, "label"),
    ],
  },
  {
    id: "switch",
    label: "Switch",
    build: ({ createText }) => [
      createText("󰨙 Switch", undefined, undefined, undefined, undefined, "control"),
    ],
  },
  {
    id: "breadcrumb",
    label: "Breadcrumb",
    build: ({ createText }) => [
      createText(
        "BreadcrumbItem / ... / BreadcrumbItem",
        undefined,
        undefined,
        undefined,
        undefined,
        "items"
      ),
    ],
  },
];
