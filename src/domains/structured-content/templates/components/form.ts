import type { StructuredComponentDefinition } from "./types";

export const FORM_COMPONENTS: StructuredComponentDefinition[] = [
  {
    id: "input",
    label: "Input",
    build: ({ createBg, createText }) => [
      createBg(20, 0, 0, { x: 6, y: 0 }, 1, undefined, "fieldFill"),
      createText(
        "Name: [ Ascii-Canvas |   ]",
        { x: 0, y: 0 },
        1,
        undefined,
        undefined,
        "fieldText"
      ),
    ],
  },
  {
    id: "checkbox",
    label: "Checkbox",
    build: ({ createText }) => [
      createText("󰱒 checkbox 1", undefined, undefined, undefined, undefined, "optionChecked"),
      createText("󰄱 checkbox 2", { x: 0, y: 1 }, 1, undefined, undefined, "option"),
    ],
  },
  {
    id: "radio",
    label: "Radio",
    build: ({ createText }) => [
      createText("󰄰 radio 1", undefined, undefined, undefined, undefined, "option"),
      createText("󰄳 radio 2", { x: 0, y: 1 }, 1, undefined, undefined, "optionSelected"),
      createText("󰄰 radio 3", { x: 0, y: 2 }, 2, undefined, undefined, "option"),
    ],
  },
  {
    id: "textarea",
    label: "Textarea",
    build: ({ createBg, createText }) => [
      createBg(26, 0, 3, { x: 0, y: 3 }, 1, "#eff6ff", "statusBarFill"),
      createText("TextArea                 █", { x: 0, y: 0 }, 0, [
        { start: 25, end: 26, style: { color: "#3b82f6" } },
      ], undefined, "contentLine"),
      createText("                         │", { x: 0, y: 1 }, 1, undefined, undefined, "scrollRail"),
      createText("Press Ctrl+S to save...  │", { x: 0, y: 2 }, 2, [
        { start: 0, end: 23, style: { color: "#6b7280" } },
      ], undefined, "hint"),
      createText("󰦨 UTF-8  󰚰 Ln 2, Col 44   ", { x: 0, y: 3 }, 4, undefined, {
        color: "#2563eb",
      }, "statusText"),
    ],
  },
  {
    id: "slider",
    label: "Slider",
    build: ({ createText }) => [
      createText("Slider ────●────────────●───", { x: 0, y: 0 }, 0, [
        { start: 7, end: 11, style: { color: "#d1d5db" } },
        { start: 11, end: 25, style: { color: "#3b82f6" } },
        { start: 25, end: 28, style: { color: "#d1d5db" } },
      ], undefined, "track"),
    ],
  },
];
