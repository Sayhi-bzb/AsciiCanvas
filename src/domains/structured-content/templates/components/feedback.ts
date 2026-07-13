import type { StructuredComponentDefinition } from "./types";

export const FEEDBACK_COMPONENTS: StructuredComponentDefinition[] = [
  {
    id: "alert",
    label: "Alert",
    build: ({ createBox, createText }) => [
      createBox(24, 4, 0, { x: 0, y: 0 }, { color: "#0d9488" }, "container"),
      createText("󰄳", { x: 2, y: 1 }, 1, undefined, {
        color: "#0d9488",
      }, "icon"),
      createText("AlertTitle", { x: 5, y: 1 }, 2, undefined, {
        color: "#0d9488",
      }, "title"),
      createText("AlertDescription", { x: 5, y: 2 }, 3, undefined, {
        color: "#0d9488",
      }, "description"),
    ],
  },
  {
    id: "status",
    label: "Status",
    build: ({ createText }) => [
      createText("󰄳 Success", { x: 0, y: 0 }, 0, undefined, {
        color: "#22c55e",
      }, "success"),
      createText(" Warning", { x: 0, y: 1 }, 1, undefined, {
        color: "#eab308",
      }, "warning"),
      createText(" Error", { x: 0, y: 2 }, 2, undefined, {
        color: "#ef4444",
      }, "error"),
      createText(" Loading", { x: 0, y: 3 }, 3, undefined, {
        color: "#64748b",
      }, "loading"),
    ],
  },
];
