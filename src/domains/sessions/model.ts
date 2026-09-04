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
  sourceBinding?: CanvasSourceBinding;
  collaboration?: CollaborationDescriptor;
  collaborationRole?: "host" | "guest";
}

export type CanvasSourceBinding = Readonly<{
  kind: "blackboard";
  provider: "browser-workspace" | "local-reader";
  id: string;
}>;

interface StaticCanvasSessionContent {
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
  grid: [string, GridCell][];
}

export type FreeformCanvasSession = CanvasSessionBase &
  StaticCanvasSessionContent &
  { mode: "freeform" };

export type StructuredCanvasSession = CanvasSessionBase &
  StaticCanvasSessionContent &
  { mode: "structured"; sourceBinding?: never };

interface SlideCanvasSessionContent extends CanvasSessionBase {
  mode: "slide";
  slideDeck: SlideDeck;
  scene: [];
  components?: [];
  grid: [];
}

export type SourceBackedCanvasSession =
  | (FreeformCanvasSession & { sourceBinding: CanvasSourceBinding })
  | (SlideCanvasSessionContent & { sourceBinding: CanvasSourceBinding });

export type CanvasSession =
  | FreeformCanvasSession
  | StructuredCanvasSession
  | SlideCanvasSessionContent;

export const isSourceBackedCanvasSession = (
  session: CanvasSession | null | undefined,
): session is SourceBackedCanvasSession =>
  !!session && !!session.sourceBinding;

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
      name?: string;
    };
