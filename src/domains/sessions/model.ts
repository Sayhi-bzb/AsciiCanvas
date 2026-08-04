import type { GridCell, Point } from "@/shared/types";
import type { CanvasMode } from "./mode";
import type { StructuredComponentInstance, StructuredNode } from "@/domains/structured-content/public";
import type { CollaborationDescriptorV1 } from "@/domains/collaboration/public";

interface CanvasViewport {
  offset: Point;
  zoom: number;
}

export interface CanvasSession {
  id: string;
  name: string;
  mode: CanvasMode;
  scene: StructuredNode[];
  components?: StructuredComponentInstance[];
  grid: [string, GridCell][];
  viewport?: CanvasViewport;
  collaboration?: CollaborationDescriptorV1;
}

export type CanvasImportSnapshot = {
  mode: CanvasMode;
  scene: StructuredNode[];
  components: StructuredComponentInstance[];
  grid: [string, GridCell][];
};
