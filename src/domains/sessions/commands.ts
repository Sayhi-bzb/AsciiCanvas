import type { CanvasMode } from "./mode";
import type { CanvasImportSnapshot, CanvasSession } from "./model";
import type { CollaborationDescriptor } from "@/domains/collaboration/public";
import type { SlideSize } from "@/domains/slides/public";

type CreateCanvasSessionOptions = {
  slideSize?: SlideSize;
};

export interface SessionCommands {
  createCanvasSession: (
    mode?: CanvasMode,
    options?: CreateCanvasSessionOptions
  ) => void;
  importCanvasSession: (
    raw: string | unknown,
    options?: { name?: string; sourceName?: string }
  ) => Promise<CanvasSession>;
  replaceCanvasSessionSnapshot: (
    sessionId: string,
    snapshot: CanvasImportSnapshot,
    options: { preserveViewport: boolean; resetHistory: boolean }
  ) => void;
  switchCanvasSession: (canvasId: string) => Promise<boolean>;
  removeCanvasSession: (canvasId: string) => Promise<boolean>;
  renameCanvasSession: (canvasId: string, nextName: string) => void;
  setCanvasSessionCollaboration: (
    canvasId: string,
    collaboration: CollaborationDescriptor | null
  ) => void;
  joinCanvasSessionCollaboration: (collaboration: CollaborationDescriptor) => void;
}
