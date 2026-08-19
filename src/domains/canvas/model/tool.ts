import type { CanvasMode } from "@/domains/sessions/public";

export type ToolType =
  | "select"
  | "pan"
  | "text"
  | "brush"
  | "eraser"
  | "fill"
  | "box"
  | "splitBox"
  | "line"
  | "arrowLine"
  | "bg"
  | "stepline"
  | "circle";

const NON_STRUCTURED_TOOLS = [
  "select",
  "pan",
  "brush",
  "eraser",
  "fill",
  "box",
  "splitBox",
  "line",
  "bg",
  "stepline",
  "circle",
] as const satisfies readonly ToolType[];

const TOOLS_BY_MODE = {
  freeform: NON_STRUCTURED_TOOLS,
  structured: [
    "select",
    "pan",
    "text",
    "box",
    "splitBox",
    "line",
    "arrowLine",
    "bg",
  ],
  slide: NON_STRUCTURED_TOOLS,
  ai: ["select", "pan"],
} as const satisfies Record<CanvasMode, readonly ToolType[]>;

export const isToolAllowedForMode = (
  tool: ToolType,
  mode: CanvasMode
): boolean => TOOLS_BY_MODE[mode].some((allowedTool) => allowedTool === tool);
