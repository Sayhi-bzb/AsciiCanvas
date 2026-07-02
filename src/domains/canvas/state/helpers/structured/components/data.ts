import type { StructuredComponentDefinition } from "./types";

const AXIS_COLOR = "#1f2937";
const BLUE = "#3b82f6";
const RED = "#ef4444";
const MUTED = "#6b7280";
const STRIPE = "#d1d5db";
const TABLE_HEADER = "#1f2937";
const PROGRESS_TRACK = "#f3f4f6";

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
  {
    id: "barChart",
    label: "Bar chart",
    build: ({ createText }) => [
      createText(
        "│     █       ",
        { x: 0, y: 0 },
        0,
        [{ start: 6, end: 7, style: { color: BLUE } }],
        { color: AXIS_COLOR }
      ),
      createText(
        "├ ▄   █   ▆   ",
        { x: 0, y: 1 },
        1,
        [
          { start: 2, end: 3, style: { color: BLUE } },
          { start: 6, end: 7, style: { color: BLUE } },
          { start: 10, end: 11, style: { color: BLUE } },
        ],
        { color: AXIS_COLOR }
      ),
      createText(
        "│ █ ▇ █ ▃ █ █",
        { x: 0, y: 2 },
        2,
        [
          { start: 2, end: 3, style: { color: BLUE } },
          { start: 4, end: 5, style: { color: BLUE } },
          { start: 6, end: 7, style: { color: BLUE } },
          { start: 8, end: 9, style: { color: BLUE } },
          { start: 10, end: 11, style: { color: BLUE } },
          { start: 12, end: 13, style: { color: BLUE } },
        ],
        { color: AXIS_COLOR }
      ),
      createText("└─┴─┴─┴─┴─┴─┴─", { x: 0, y: 3 }, 3, undefined, {
        color: AXIS_COLOR,
      }),
    ],
  },
  {
    id: "lineChart",
    label: "Line chart",
    build: ({ createText }) => [
      createText(
        "├         ╭─",
        { x: 0, y: 0 },
        0,
        [{ start: 10, end: 12, style: { color: RED } }],
        { color: AXIS_COLOR }
      ),
      createText(
        "│   ╭─╮   │",
        { x: 0, y: 1 },
        1,
        [
          { start: 4, end: 7, style: { color: RED } },
          { start: 10, end: 11, style: { color: RED } },
        ],
        { color: AXIS_COLOR }
      ),
      createText(
        "├ ──╯ │ ╭─╯",
        { x: 0, y: 2 },
        2,
        [
          { start: 2, end: 5, style: { color: RED } },
          { start: 6, end: 7, style: { color: RED } },
          { start: 8, end: 11, style: { color: RED } },
        ],
        { color: AXIS_COLOR }
      ),
      createText(
        "│     ╰─╯",
        { x: 0, y: 3 },
        3,
        [{ start: 6, end: 9, style: { color: RED } }],
        { color: AXIS_COLOR }
      ),
      createText("└─┴─┴─┴─┴─┴─┴", { x: 0, y: 4 }, 4, undefined, {
        color: AXIS_COLOR,
      }),
    ],
  },
  {
    id: "table",
    label: "Table",
    build: ({ createBg, createText }) => [
      createBg(33, 0, 0, { x: 0, y: 0 }, 1, TABLE_HEADER),
      createText(" TableCaption                    ", { x: 0, y: 0 }, 1, undefined, {
        color: "#ffffff",
      }),
      createText("         Head 1   Head 2   Head 3", { x: 0, y: 1 }, 2),
      createBg(33, 4, 3, { x: 0, y: 2 }, 1, STRIPE),
      createText(" Row 1   Cell     Cell     Cell  ", { x: 0, y: 2 }, 4),
      createText(" Row 2   Cell     Cell     Cell", { x: 0, y: 3 }, 5),
      createBg(33, 4, 6, { x: 0, y: 4 }, 1, STRIPE),
      createText(" Row 3   Cell     Cell     Cell  ", { x: 0, y: 4 }, 7),
      createBg(33, 0, 8, { x: 0, y: 5 }, 1, TABLE_HEADER),
      createText(" TableFooter                     ", { x: 0, y: 5 }, 9, undefined, {
        color: "#ffffff",
      }),
    ],
  },
  {
    id: "progress",
    label: "Progress",
    build: ({ createBg, createText }) => [
      createBg(9, 0, 0, { x: 0, y: 0 }, 1, BLUE),
      createBg(4, 4, 1, { x: 9, y: 0 }, 1, PROGRESS_TRACK),
      createText(
        "             70%",
        { x: 0, y: 0 },
        2,
        [{ start: 13, end: 16, style: { color: BLUE } }],
        { color: MUTED }
      ),
    ],
  },
];
