import type { CanvasMode } from "./mode";
import type { CanvasSession } from "./model";
import type { CollaborationDescriptorV2 } from "@/domains/collaboration/public";
import type { SlideSize } from "@/domains/slides/public";

export type CreateCanvasSessionOptions = {
  slideSize?: SlideSize;
};

export interface SessionCommands {
  createCanvasSession: (
    mode?: CanvasMode,
    options?: CreateCanvasSessionOptions
  ) => void;
  importCanvasSession: (raw: string | unknown, options?: { name?: string }) => CanvasSession;
  switchCanvasSession: (canvasId: string) => void;
  removeCanvasSession: (canvasId: string) => void;
  renameCanvasSession: (canvasId: string, nextName: string) => void;
  setCanvasSessionCollaboration: (
    canvasId: string,
    collaboration: CollaborationDescriptorV2 | null
  ) => void;
  joinCanvasSessionCollaboration: (collaboration: CollaborationDescriptorV2) => void;
}
