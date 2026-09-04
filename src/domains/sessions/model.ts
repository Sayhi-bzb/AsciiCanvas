import type { GridCell, Point } from "@/shared/types";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { CollaborationDescriptor } from "@/domains/collaboration/public";
import type { SlideDeck } from "@/domains/slides/public";

interface CanvasViewport {
  offset: Point;
  zoom: number;
}

interface CanvasSessionBase {
  id: string;
  name: string;
  viewport?: CanvasViewport;
  collaboration?: CollaborationDescriptor;
  collaborationRole?: "host" | "guest";
}

interface StaticCanvasSession extends CanvasSessionBase {
  mode: "freeform" | "structured";
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
  grid: [string, GridCell][];
}

export interface BlackboardCanvasSession extends CanvasSessionBase {
  mode: "blackboard";
  workspaceId: string;
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
  grid: [string, GridCell][];
  collaboration?: never;
  collaborationRole?: never;
}

interface SlideCanvasSession extends CanvasSessionBase {
  mode: "slide";
  workspaceId?: string;
  slideDeck: SlideDeck;
  scene: [];
  components?: [];
  grid: [];
  collaboration?: never;
  collaborationRole?: never;
}

export type CanvasSession = StaticCanvasSession | SlideCanvasSession | BlackboardCanvasSession;

type StaticCanvasImportSnapshotBase = {
  scene: StructuredNode[];
  components: StructuredComponentInstance[];
  grid: [string, GridCell][];
  name?: string;
};

export type FreeformCanvasImportSnapshot = StaticCanvasImportSnapshotBase & {
  mode: "freeform";
};

export type StructuredCanvasImportSnapshot = StaticCanvasImportSnapshotBase & {
  mode: "structured";
};

export type CanvasImportSnapshot =
  | FreeformCanvasImportSnapshot
  | StructuredCanvasImportSnapshot
  | {
      mode: "slide";
      slideDeck: SlideDeck;
      workspaceId?: string;
      name?: string;
    };
