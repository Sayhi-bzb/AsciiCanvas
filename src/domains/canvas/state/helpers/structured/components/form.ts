import type { StructuredComponentDefinition } from "./types";

export const FORM_COMPONENTS: StructuredComponentDefinition[] = [
  {
    id: "input",
    label: "Input",
    build: ({ createBg, createText }) => [
      createBg(20, 0, 0, { x: 6, y: 0 }),
      createText("Name: [ Ascii-Canvas |   ]", { x: 0, y: 0 }, 1),
    ],
  },
  {
    id: "checkbox",
    label: "Checkbox",
    build: ({ createText }) => [
      createText("󰱒 checkbox 1"),
      createText("󰄱 checkbox 2", { x: 0, y: 1 }, 1),
    ],
  },
  {
    id: "radio",
    label: "Radio",
    build: ({ createText }) => [
      createText("󰄰 radio 1"),
      createText("󰄳 radio 2", { x: 0, y: 1 }, 1),
      createText("󰄰 radio 3", { x: 0, y: 2 }, 2),
    ],
  },
  {
    id: "textarea",
    label: "Textarea",
    build: ({ createBox, createText }) => [
      createBox(18, 5),
      createText("Multiline", { x: 2, y: 1 }, 1),
      createText("text...", { x: 2, y: 2 }, 2),
    ],
  },
  {
    id: "select",
    label: "Select",
    build: ({ createBox, createText }) => [
      createBox(14, 3),
      createText("Option", { x: 2, y: 1 }, 1),
      createText("v", { x: 11, y: 1 }, 2),
    ],
  },
  {
    id: "field",
    label: "Field",
    build: ({ createBox, createText }) => [
      createText("Label"),
      createBox(16, 3, 1, { x: 0, y: 1 }),
      createText("Value", { x: 2, y: 2 }, 2),
    ],
  },
  {
    id: "formRow",
    label: "Form row",
    build: ({ createBox, createText }) => [
      createText("Label", { x: 0, y: 1 }),
      createBox(18, 3, 1, { x: 8, y: 0 }),
      createText("Value", { x: 10, y: 1 }, 2),
    ],
  },
];
