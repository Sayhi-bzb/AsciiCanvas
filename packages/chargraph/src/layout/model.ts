import type { Direction } from "../vendor/types.js";

export type LayoutDirection = Direction;

type LayoutRankConstraint = "first" | "last";
type LayoutCycleBreaking = "automatic" | "depth-first";
type LayoutPortPlacement = "center" | "distributed" | "adaptive";
type LayoutPortAllocation = "shared" | "independent";
type LayoutTopology = "shared" | "independent";

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

interface LayoutEdgeRouting {
  /** Whether collinear route cells may be shared with another edge. */
  topology?: LayoutTopology;
  /** Explicit ownership for a structured fan-in or fan-out bus. */
  bundleId?: string;
  /** Opt-in to canonical orthogonal fan-in/fan-out bus construction. */
  bundle?: "structured";
  /** Only edges with the same visual routing contract may share a bus. */
  bundleKey?: string;
  /** Opt-in to legible cell-grid routing without one-cell doglegs. */
  quality?: "readable";
  /** Whether a self-reference keeps ELK geometry or uses a compact grid route. */
  selfLoop?: "engine" | "compact";
  /** Marker cells reserved outward from each node boundary. */
  sourceClearance?: number;
  targetClearance?: number;
}

interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  label?: LayoutLabel;
  /** Labels owned by the source/target endpoint, such as UML cardinalities. */
  sourceLabel?: LayoutLabel;
  targetLabel?: LayoutLabel;
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
  /** Cross-layer placement preference for layered node coordinates. */
  nodeAlignment?: "automatic" | "balanced";
  /** Whether non-transitive paths should define the visual backbone. */
  pathAlignment?: "automatic" | "topology";
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
  sourceLabelPosition?: GridPoint;
  targetLabelPosition?: GridPoint;
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
