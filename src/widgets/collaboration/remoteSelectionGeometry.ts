import {
  getGridSelectionGeometry,
  gridRangeFromSelectionArea,
} from "@/domains/selection/public";
import type { CanvasMode } from "@/domains/sessions/public";
import {
  getStructuredNodeBounds,
  type StructuredNode,
} from "@/domains/structured-content/public";
import { CELL_HEIGHT, CELL_WIDTH } from "@/shared/lib/constants";
import type { GridMap, Point } from "@/shared/types";

type RemoteSelection =
  | { mode: "freeform"; areas: Array<{ start: Point; end: Point }> }
  | { mode: "structured"; nodeIds: string[] };

export type RemotePeer = {
  clientId: number;
  name: string;
  color: string;
  selection?: RemoteSelection;
};

type RemoteSelectionVisual = {
  clientId: number;
  name: string;
  color: string;
  path: string;
  anchor: Point;
};

const toScreenPoint = (
  point: Point,
  viewport: { offset: Point; zoom: number }
): Point => ({
  x: viewport.offset.x + point.x * CELL_WIDTH * viewport.zoom,
  y: viewport.offset.y + point.y * CELL_HEIGHT * viewport.zoom,
});

const ringsToPath = (
  rings: Point[][],
  viewport: { offset: Point; zoom: number }
) =>
  rings
    .map(
      (ring) =>
        `${ring
          .map((point, index) => {
            const screen = toScreenPoint(point, viewport);
            return `${index === 0 ? "M" : "L"}${screen.x} ${screen.y}`;
          })
          .join(" ")} Z`
    )
    .join(" ");

const boundsToPath = (
  bounds: { x: number; y: number; width: number; height: number },
  viewport: { offset: Point; zoom: number }
) => {
  const start = toScreenPoint({ x: bounds.x, y: bounds.y }, viewport);
  const end = toScreenPoint({
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height,
  }, viewport);
  return `M${start.x} ${start.y} H${end.x} V${end.y} H${start.x} Z`;
};

export const resolveRemoteSelectionVisuals = ({
  peers,
  canvasMode,
  grid,
  structuredScene,
  viewport,
}: {
  peers: RemotePeer[];
  canvasMode: CanvasMode;
  grid: GridMap;
  structuredScene: StructuredNode[];
  viewport: { offset: Point; zoom: number };
}): RemoteSelectionVisual[] => peers.flatMap((peer) => {
  if (canvasMode === "freeform" && peer.selection?.mode === "freeform") {
    const geometry = getGridSelectionGeometry(
      peer.selection.areas.map(gridRangeFromSelectionArea),
      grid
    );
    if (!geometry.bounds) return [];
    return [{
      clientId: peer.clientId,
      name: peer.name,
      color: peer.color,
      path: geometry.polygons
        .map(({ rings }) => ringsToPath(rings, viewport))
        .join(" "),
      anchor: toScreenPoint(geometry.bounds.start, viewport),
    }];
  }

  if (canvasMode === "structured" && peer.selection?.mode === "structured") {
    const selectedIds = new Set(peer.selection.nodeIds);
    const bounds = structuredScene
      .filter((node) => selectedIds.has(node.id))
      .map(getStructuredNodeBounds);
    if (bounds.length === 0) return [];
    const anchor = bounds.reduce((current, candidate) => ({
      x: Math.min(current.x, candidate.x),
      y: Math.min(current.y, candidate.y),
    }), { x: bounds[0].x, y: bounds[0].y });
    return [{
      clientId: peer.clientId,
      name: peer.name,
      color: peer.color,
      path: bounds.map((item) => boundsToPath(item, viewport)).join(" "),
      anchor: toScreenPoint(anchor, viewport),
    }];
  }

  return [];
});
