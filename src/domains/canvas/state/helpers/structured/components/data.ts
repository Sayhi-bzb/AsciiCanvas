import type { StructuredComponentDefinition } from "./types";

export const DATA_COMPONENTS: StructuredComponentDefinition[] = [
  {
    id: "avatar",
    label: "Avatar",
    build: ({ createText }) => [
      createText("󰀉 󰭕 󰭕", { x: 0, y: 0 }, 0, [
        {
          start: 0,
          end: 1,
          style: { color: "#0d9488" },
        },
        {
          start: 2,
          end: 5,
          style: { color: "#64748b" },
        },
      ]),
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    build: ({ createBg, createText }) => [
      createBg(26, 4, 0, { x: 0, y: 0 }, 2, "#f3f4f6"),
      createText("󰃭  July 2026          󰁍  󰁔", { x: 0, y: 0 }, 1),
      createText("Su  Mo  Tu  We  Th  Fr  Sa", { x: 0, y: 1 }, 2, undefined, {
        color: "#9ca3af",
      }),
      createText("28  29  30  01  02  03  04", { x: 0, y: 2 }, 3, [
        { start: 0, end: 12, style: { color: "#9ca3af" } },
        {
          start: 15,
          end: 19,
          style: { color: "#1d4ed8", bgColor: "#dbeafe" },
        },
      ]),
      createText("05  06  07  08  09  10  11", { x: 0, y: 3 }, 4),
      createText("12  13  14  15  16  17  18", { x: 0, y: 4 }, 5),
      createText("19  20  21  22  23  24  25", { x: 0, y: 5 }, 6),
      createText("26  27  28  29  30  31  01", { x: 0, y: 6 }, 7, [
        { start: 23, end: 26, style: { color: "#9ca3af" } },
      ]),
    ],
  },
];
