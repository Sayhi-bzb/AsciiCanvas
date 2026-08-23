import type { Direction } from "../vendor/types.js";

export type LayoutDirection = Direction;

export type LayoutRankConstraint = "first" | "last";
export type LayoutCycleBreaking = "automatic" | "depth-first";
export type LayoutPortPlacement = "center" | "distributed" | "adaptive";
export type LayoutPortAllocation = "shared" | "independent";
export type LayoutTopology = "shared" | "independent";

export interface LayoutLabel {
  text: string;
  width: number;
  height: number;
}

export interface LayoutNode {
  id: string;
  label: string;
  width: number;
  height: number;
  parentId?: string;
  rankConstraint?: LayoutRankConstraint;
  portPlacement?: LayoutPortPlacement;
  /** Whether incident edge ends receive distinct ELK ports. */
  portAllocation?: LayoutPortAllocation;
}

export interface LayoutEdgeRouting {
  /** Whether collinear route cells may be shared with another edge. */
  topology?: LayoutTopology;
  /** Whether a self-reference keeps ELK geometry or uses a compact grid route. */
  selfLoop?: "engine" | "compact";
  /** Marker cells reserved outward from each node boundary. */
  sourceClearance?: number;
  targetClearance?: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  label?: LayoutLabel;
  /** Whether ELK reserves label bounds or the grid router places the label afterward. */
  labelLayout?: "reserve" | "route";
  routing?: LayoutEdgeRouting;
}

export interface LayoutGroup {
  id: string;
  label: string;
  parentId?: string;
}

/** Layout-neutral graph contract. Coordinates and glyphs do not belong here. */
export interface LayoutGraph {
  direction: LayoutDirection;
  /** How a directed cycle chooses feedback edges before layering. */
  cycleBreaking?: LayoutCycleBreaking;
  spacing: {
    nodeNode: number;
    nodeNodeBetweenLayers: number;
  };
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
}

export interface GridPoint {
  x: number;
  y: number;
}

export type GridSide = "top" | "right" | "bottom" | "left";

export interface PositionedEdgeEndpoint {
  side: GridSide;
  anchor: GridPoint;
  marker: GridPoint;
  outward: GridPoint;
}

export interface GridRect extends GridPoint {
  width: number;
  height: number;
}

export interface PositionedLayoutNode extends LayoutNode, GridRect {}

export interface PositionedLayoutGroup extends LayoutGroup, GridRect {}

export interface PositionedLayoutEdge extends LayoutEdge {
  points: GridPoint[];
  sourceEndpoint: PositionedEdgeEndpoint;
  targetEndpoint: PositionedEdgeEndpoint;
  labelPosition?: GridPoint;
}

export interface GridLayout {
  width: number;
  height: number;
  nodes: PositionedLayoutNode[];
  edges: PositionedLayoutEdge[];
  groups: PositionedLayoutGroup[];
}

export interface GraphLayoutEngine {
  layout(graph: LayoutGraph): Promise<GridLayout>;
}
