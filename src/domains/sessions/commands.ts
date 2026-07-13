import type { CanvasMode } from "./mode";
import type { AnimationCanvasSize } from "@/domains/animation/public";
import type { CanvasSession } from "./model";

export interface SessionCommands {
  createCanvasSession: (mode?: CanvasMode, options?: { size?: AnimationCanvasSize }) => void;
  importCanvasSession: (raw: string | unknown, options?: { name?: string }) => CanvasSession;
  switchCanvasSession: (canvasId: string) => void;
  removeCanvasSession: (canvasId: string) => void;
  renameCanvasSession: (canvasId: string, nextName: string) => void;
}
