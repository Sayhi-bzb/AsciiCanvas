import type { GridCell, Point } from "@/shared/types";
import type { CanvasMode } from "./mode";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { CollaborationDescriptorV2 } from "@/domains/collaboration/public";
import type { SlideDeck } from "@/domains/slides/public";

interface CanvasViewport {
  offset: Point;
  zoom: number;
}

interface CanvasSessionBase {
  id: string;
  name: string;
  viewport?: CanvasViewport;
  collaboration?: CollaborationDescriptorV2;
}

interface StaticCanvasSession extends CanvasSessionBase {
  mode: Exclude<CanvasMode, "slide">;
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
  grid: [string, GridCell][];
}

interface SlideCanvasSession extends CanvasSessionBase {
  mode: "slide";
  slideDeck: SlideDeck;
  scene: [];
  components?: [];
  grid: [];
  collaboration?: never;
}

export type CanvasSession = StaticCanvasSession | SlideCanvasSession;

export type CanvasImportSnapshot =
  | {
      mode: Exclude<CanvasMode, "slide">;
      scene: StructuredNode[];
      components: StructuredComponentInstance[];
      grid: [string, GridCell][];
      name?: string;
    }
  | {
      mode: "slide";
      slideDeck: SlideDeck;
      name?: string;
    };
