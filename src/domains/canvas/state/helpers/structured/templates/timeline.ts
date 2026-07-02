import type { StructuredComponentDefinition } from "../components/types";

export const TIMELINE_TEMPLATE: StructuredComponentDefinition = {
  id: "timeline",
  label: "Timeline",
  build: ({ createLine, createText }) => [
    createLine(7, 0, { x: 0, y: 1 }, { color: "#64748b" }, "spine", "vertical"),
    createText("● Q1", { x: 0, y: 0 }, 1, undefined, undefined, "milestone"),
    createText("Jan - Mar", { x: 2, y: 1 }, 2, undefined, undefined, "period"),
    createText("● Q2", { x: 0, y: 3 }, 3, undefined, undefined, "milestone"),
    createText("Apr - Jun", { x: 2, y: 4 }, 4, undefined, undefined, "period"),
    createText("○ Q3", { x: 0, y: 6 }, 5, undefined, undefined, "milestone"),
    createText("Jul - Sep", { x: 2, y: 7 }, 6, undefined, undefined, "period"),
  ],
};
