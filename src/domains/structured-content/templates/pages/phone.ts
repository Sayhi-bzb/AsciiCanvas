import type { StructuredComponentDefinition } from "../components/types";

const YELLOW = "#eab308";
const RED = "#ef4444";
const GREEN = "#22c55e";
const EMERALD = "#10b981";
const INDIGO = "#6366f1";
const CYAN = "#06b6d4";
const BLUE = "#3b82f6";
const PINK = "#ec4899";
const WEATHER_FILL = "#86efac";

export const PHONE_TEMPLATE: StructuredComponentDefinition = {
  id: "phone",
  label: "Phone",
  build: ({ createBg, createBox, createLine, createText }) => [
    createBox(26, 24, 0, { x: 0, y: 0 }, undefined, "frame"),
    createLine(24, 1, { x: 1, y: 2 }, undefined, "topDivider"),
    createLine(24, 2, { x: 1, y: 21 }, undefined, "bottomDivider"),
    createBg(13, 1, 3, { x: 5, y: 7 }, 1, WEATHER_FILL, "weatherFill"),
    createText(
      "          ━━━━         ",
      { x: 1, y: 1 },
      4,
      undefined,
      undefined,
      "speaker"
    ),
    createText(
      " 󰢽      5:25 PM   󰖩    ",
      { x: 1, y: 3 },
      5,
      [{ start: 21, end: 22, style: { color: YELLOW } }],
      undefined,
      "statusBar"
    ),
    createText(
      " Welcome Back  󱠡        ",
      { x: 1, y: 5 },
      6,
      [{ start: 15, end: 16, style: { color: YELLOW } }],
      undefined,
      "welcome"
    ),
    createText(
      "    24°C   Sunny       ",
      { x: 1, y: 7 },
      7,
      [{ start: 10, end: 11, style: { color: YELLOW, bgColor: WEATHER_FILL } }],
      undefined,
      "weather"
    ),
    createText(
      " °   °             ",
      { x: 1, y: 10 },
      8,
      [
        { start: 1, end: 2, style: { color: YELLOW } },
        { start: 2, end: 3, style: { color: RED } },
        { start: 7, end: 8, style: { color: RED } },
        { start: 11, end: 12, style: { color: RED } },
        { start: 21, end: 22, style: { color: RED } },
      ],
      undefined,
      "appsRow1"
    ),
    createText(
      "                   ",
      { x: 1, y: 13 },
      9,
      [
        { start: 1, end: 2, style: { color: EMERALD } },
        { start: 6, end: 7, style: { color: INDIGO } },
        { start: 11, end: 12, style: { color: CYAN } },
        { start: 16, end: 17, style: { color: GREEN } },
      ],
      undefined,
      "appsRow2"
    ),
    createText(
      "         󰋾        󰘑  ",
      { x: 1, y: 16 },
      10,
      [
        { start: 6, end: 7, style: { color: GREEN } },
        { start: 11, end: 12, style: { color: PINK } },
        { start: 16, end: 17, style: { color: BLUE } },
        { start: 21, end: 22, style: { color: GREEN } },
      ],
      undefined,
      "appsRow3"
    ),
    createText(
      "                     ",
      { x: 1, y: 20 },
      11,
      [
        { start: 3, end: 4, style: { color: GREEN } },
        { start: 11, end: 12, style: { color: GREEN } },
      ],
      undefined,
      "dock"
    ),
    createText(
      "          (  )          ",
      { x: 1, y: 22 },
      12,
      undefined,
      undefined,
      "homeIndicator"
    ),
  ],
};
