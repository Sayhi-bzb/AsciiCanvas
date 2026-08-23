import { getTextCellWidth } from "@chardesk/protocol";
import type {
  ELK,
  ElkExtendedEdge,
  ElkGraphElement,
  ElkNode,
  ElkPoint,
  ElkPort,
} from "elkjs/lib/elk-api.js";
import { quantizeCoordinate, quantizeRoute } from "./quantize.js";
import type {
  GridLayout,
  GridPoint,
  GridSide,
  LayoutDirection,
  LayoutGraph,
  LayoutLabel,
  LayoutNode,
  PositionedEdgeEndpoint,
  PositionedLayoutEdge,
  PositionedLayoutNode,
} from "./model.js";

const directionMap: Record<LayoutDirection, string> = {
  TD: "DOWN",
  TB: "DOWN",
  LR: "RIGHT",
  BT: "UP",
  RL: "LEFT",
};

const rootOptions = (
  direction: LayoutDirection,
  spacing: LayoutGraph["spacing"],
  cycleBreaking: LayoutGraph["cycleBreaking"] = "automatic",
) => ({
  "elk.algorithm": "layered",
  "elk.direction": directionMap[direction],
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  ...(cycleBreaking === "depth-first"
    ? { "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST" }
    : {}),
  "elk.spacing.nodeNode": String(spacing.nodeNode),
  "elk.spacing.edgeNode": "1",
  "elk.spacing.edgeEdge": "1",
  "elk.spacing.componentComponent": "4",
  "elk.layered.spacing.edgeNodeBetweenLayers": "1",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "1",
  "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing.nodeNodeBetweenLayers),
  "elk.padding": "[top=1,left=1,bottom=1,right=1]",
  "elk.separateConnectedComponents": "true",
});

const rankOptions = (node: LayoutNode) => node.rankConstraint
  ? { "elk.layered.layering.layerConstraint": node.rankConstraint.toUpperCase() }
  : undefined;

const label = (id: string, value: LayoutLabel) => ({
  id,
  ...value,
});

type ElkPortSide = "NORTH" | "EAST" | "SOUTH" | "WEST";

const endpointPortSide = (
  direction: LayoutDirection,
  selfLoop: boolean,
  source: boolean,
): ElkPortSide => {
  if (selfLoop) return direction === "LR" || direction === "RL" ? "NORTH" : "EAST";
  if (direction === "LR") return source ? "EAST" : "WEST";
  if (direction === "RL") return source ? "WEST" : "EAST";
  if (direction === "BT") return source ? "NORTH" : "SOUTH";
  return source ? "SOUTH" : "NORTH";
};

const createIndependentPorts = (graph: LayoutGraph) => {
  const independentNodes = new Set(
    graph.nodes
      .filter((node) => node.portAllocation === "independent")
      .map((node) => node.id),
  );
  const portsByNode = new Map<string, ElkPort[]>();
  const edgePorts = new Map<string, { source?: string; target?: string }>();
  const requests: Array<{
    edgeId: string;
    nodeId: string;
    end: "source" | "target";
    side: ElkPortSide;
  }> = [];
  const sideCounts = new Map<string, number>();

  const requestPort = (
    edgeId: string,
    nodeId: string,
    end: "source" | "target",
    side: ElkPortSide,
  ) => {
    if (!independentNodes.has(nodeId)) return;
    requests.push({ edgeId, nodeId, end, side });
    const sideKey = `${nodeId}:${side}`;
    sideCounts.set(sideKey, (sideCounts.get(sideKey) ?? 0) + 1);
  };

  for (const edge of graph.edges) {
    const selfLoop = edge.source === edge.target;
    requestPort(
      edge.id,
      edge.source,
      "source",
      endpointPortSide(graph.direction, selfLoop, true),
    );
    requestPort(
      edge.id,
      edge.target,
      "target",
      endpointPortSide(graph.direction, selfLoop, false),
    );
  }

  const sideIndexes = new Map<string, number>();
  for (const { edgeId, nodeId, end, side } of requests) {
    const sideKey = `${nodeId}:${side}`;
    const logicalIndex = sideIndexes.get(sideKey) ?? 0;
    sideIndexes.set(sideKey, logicalIndex + 1);
    // ELK numbers ports clockwise around a node. Normalize that order so
    // graph edge order always reads top-to-bottom or left-to-right.
    const index = side === "SOUTH" || side === "WEST"
      ? sideCounts.get(sideKey)! - logicalIndex - 1
      : logicalIndex;
    const id = `${edgeId}:${end}-port`;
    const ports = portsByNode.get(nodeId) ?? [];
    ports.push({
      id,
      width: 1,
      height: 1,
      layoutOptions: {
        "elk.port.side": side,
        "elk.port.index": String(index),
      },
    });
    portsByNode.set(nodeId, ports);
    edgePorts.set(edgeId, { ...edgePorts.get(edgeId), [end]: id });
  }
  return { portsByNode, edgePorts };
};

export const toElkGraph = (graph: LayoutGraph): ElkNode => {
  const { portsByNode, edgePorts } = createIndependentPorts(graph);
  const directNodes = new Map<string | undefined, LayoutNode[]>();
  for (const node of graph.nodes) {
    const siblings = directNodes.get(node.parentId) ?? [];
    siblings.push(node);
    directNodes.set(node.parentId, siblings);
  }

  const directGroups = new Map<string | undefined, typeof graph.groups>();
  for (const group of graph.groups) {
    const siblings = directGroups.get(group.parentId) ?? [];
    siblings.push(group);
    directGroups.set(group.parentId, siblings);
  }

  const groupParents = new Map(graph.groups.map((group) => [group.id, group.parentId]));
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const ancestors = (parentId: string | undefined) => {
    const result: Array<string | undefined> = [];
    let current = parentId;
    while (current !== undefined) {
      result.push(current);
      current = groupParents.get(current);
    }
    result.push(undefined);
    return result;
  };
  const edgeContainer = (source: string, target: string) => {
    const sourceAncestors = ancestors(nodesById.get(source)?.parentId);
    const targetAncestors = new Set(ancestors(nodesById.get(target)?.parentId));
    return sourceAncestors.find((candidate) => targetAncestors.has(candidate));
  };
  const directEdges = new Map<string | undefined, ElkExtendedEdge[]>();
  for (const edge of graph.edges) {
    const ports = edgePorts.get(edge.id);
    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [ports?.source ?? edge.source],
      targets: [ports?.target ?? edge.target],
      labels: edge.label && edge.labelLayout !== "route"
        ? [label(`${edge.id}:label`, edge.label)]
        : undefined,
    };
    const container = edgeContainer(edge.source, edge.target);
    const siblings = directEdges.get(container) ?? [];
    siblings.push(elkEdge);
    directEdges.set(container, siblings);
  }

  const childrenFor = (parentId?: string): ElkNode[] => [
    ...(directGroups.get(parentId) ?? []).map((group): ElkNode => ({
      id: group.id,
      labels: [label(`${group.id}:label`, {
        text: group.label,
        width: getTextCellWidth(group.label),
        height: 1,
      })],
      children: childrenFor(group.id),
      edges: directEdges.get(group.id),
      layoutOptions: {
        ...rootOptions(graph.direction, graph.spacing, graph.cycleBreaking),
        "elk.padding": "[top=2,left=2,bottom=2,right=2]",
      },
    })),
    ...(directNodes.get(parentId) ?? []).map((node): ElkNode => ({
      id: node.id,
      width: node.width,
      height: node.height,
      ports: portsByNode.get(node.id),
      layoutOptions: {
        ...rankOptions(node),
        ...(portsByNode.has(node.id)
          ? { "elk.portConstraints": "FIXED_ORDER" }
          : {}),
      },
    })),
  ];

  return {
    id: "layout:root",
    children: childrenFor(undefined),
    edges: directEdges.get(undefined),
    layoutOptions: rootOptions(graph.direction, graph.spacing, graph.cycleBreaking),
  };
};

const appendPoint = (points: GridPoint[], point: GridPoint) => {
  const previous = points.at(-1);
  if (!previous || previous.x !== point.x || previous.y !== point.y) points.push(point);
};

const simplifyOrthogonal = (
  points: GridPoint[],
  protectedPoints: GridPoint[] = [],
) => points.filter((point, index, values) => {
  if (index === 0 || index === values.length - 1) return true;
  if (protectedPoints.some((protectedPoint) =>
    protectedPoint.x === point.x && protectedPoint.y === point.y)) return true;
  const previous = values[index - 1]!;
  const next = values[index + 1]!;
  return !(
    (previous.x === point.x && point.x === next.x) ||
    (previous.y === point.y && point.y === next.y)
  );
});

const sideOutward: Record<GridSide, GridPoint> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const sideAxis = (side: GridSide): "horizontal" | "vertical" =>
  side === "left" || side === "right" ? "horizontal" : "vertical";

const fallbackSide = (
  layoutDirection: LayoutDirection,
  source: boolean,
): GridSide => {
  if (layoutDirection === "LR") return source ? "right" : "left";
  if (layoutDirection === "RL") return source ? "left" : "right";
  if (layoutDirection === "BT") return source ? "top" : "bottom";
  return source ? "bottom" : "top";
};

const routeSide = (endpoint: ElkPoint, adjacent: ElkPoint): GridSide | undefined => {
  const dx = adjacent.x - endpoint.x;
  const dy = adjacent.y - endpoint.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? "bottom" : "top";
  return undefined;
};

const nearestNodeSide = (
  endpoint: ElkPoint,
  adjacent: ElkPoint,
  node: { x: number; y: number; width: number; height: number },
  layoutDirection: LayoutDirection,
  source: boolean,
): GridSide => {
  const distances: Record<GridSide, number> = {
    top: Math.abs(endpoint.y - node.y),
    right: Math.abs(endpoint.x - (node.x + node.width)),
    bottom: Math.abs(endpoint.y - (node.y + node.height)),
    left: Math.abs(endpoint.x - node.x),
  };
  const minimum = Math.min(...Object.values(distances));
  const candidates = (Object.keys(distances) as GridSide[])
    .filter((side) => Math.abs(distances[side] - minimum) < 0.001);
  const routed = routeSide(endpoint, adjacent);
  if (routed && candidates.includes(routed)) return routed;
  const fallback = fallbackSide(layoutDirection, source);
  return candidates.includes(fallback) ? fallback : candidates[0]!;
};

const sideCenter = (start: number, size: number) =>
  start + Math.floor((size - 1) / 2);

const distributedCoordinate = (value: number, start: number, size: number) => {
  const coordinate = quantizeCoordinate(value);
  if (size <= 2) return sideCenter(start, size);
  return Math.max(start + 1, Math.min(start + size - 2, coordinate));
};

const endpointFor = (
  point: ElkPoint,
  node: PositionedLayoutNode,
  side: GridSide,
  attachmentCount: number,
): PositionedEdgeEndpoint => {
  const outward = sideOutward[side];
  const distributed = node.portPlacement === "distributed" ||
    (node.portPlacement === "adaptive" && attachmentCount > 1);
  const anchor = side === "left" || side === "right"
    ? {
        x: side === "left" ? node.x : node.x + node.width - 1,
        y: distributed
          ? distributedCoordinate(point.y, node.y, node.height)
          : sideCenter(node.y, node.height),
      }
    : {
        x: distributed
          ? distributedCoordinate(point.x, node.x, node.width)
          : sideCenter(node.x, node.width),
        y: side === "top" ? node.y : node.y + node.height - 1,
      };
  return {
    side,
    anchor,
    marker: { x: anchor.x + outward.x, y: anchor.y + outward.y },
    outward,
  };
};

type RouteAxis = "horizontal" | "vertical";

const appendConnection = (
  points: GridPoint[],
  to: GridPoint,
  startAxis?: RouteAxis,
  endAxis?: RouteAxis,
) => {
  const from = points.at(-1);
  if (!from || from.x === to.x || from.y === to.y) {
    appendPoint(points, to);
    return;
  }
  if (startAxis && endAxis && startAxis === endAxis) {
    if (startAxis === "horizontal") {
      const middleX = Math.floor((from.x + to.x) / 2);
      appendPoint(points, { x: middleX, y: from.y });
      appendPoint(points, { x: middleX, y: to.y });
    } else {
      const middleY = Math.floor((from.y + to.y) / 2);
      appendPoint(points, { x: from.x, y: middleY });
      appendPoint(points, { x: to.x, y: middleY });
    }
  } else if (startAxis === "vertical" || endAxis === "horizontal") {
    appendPoint(points, { x: from.x, y: to.y });
  } else {
    appendPoint(points, { x: to.x, y: from.y });
  }
  appendPoint(points, to);
};

const pointOutsideEndpoint = (
  endpoint: PositionedEdgeEndpoint,
  clearance = 0,
) => ({
  x: endpoint.anchor.x + endpoint.outward.x * Math.max(1, clearance + 1),
  y: endpoint.anchor.y + endpoint.outward.y * Math.max(1, clearance + 1),
});

const routeWithEndpoints = (
  points: GridPoint[],
  source: PositionedEdgeEndpoint,
  target: PositionedEdgeEndpoint,
  sourceClearance = 0,
  targetClearance = 0,
): GridPoint[] => {
  const waypoints = [
    source.anchor,
    pointOutsideEndpoint(source, sourceClearance),
    ...points.slice(1, -1),
    pointOutsideEndpoint(target, targetClearance),
    target.anchor,
  ];
  const result: GridPoint[] = [waypoints[0]!];
  for (let index = 1; index < waypoints.length; index += 1) {
    appendConnection(
      result,
      waypoints[index]!,
      index === 2 ? sideAxis(source.side) : undefined,
      index === waypoints.length - 2 ? sideAxis(target.side) : undefined,
    );
  }
  return simplifyOrthogonal(result, [waypoints[1]!, waypoints.at(-2)!]);
};

const compactSelfLoop = (
  points: GridPoint[],
  source: PositionedEdgeEndpoint,
  target: PositionedEdgeEndpoint,
  sourceClearance = 0,
  targetClearance = 0,
) => {
  if (source.side !== target.side) return points;
  const clearance = Math.max(sourceClearance, targetClearance);
  const sourceExit = pointOutsideEndpoint(source, clearance);
  const targetExit = pointOutsideEndpoint(target, clearance);
  if (sourceExit.x === targetExit.x && sourceExit.y === targetExit.y) return points;
  return simplifyOrthogonal([
    source.anchor,
    sourceExit,
    targetExit,
    target.anchor,
  ], [sourceExit, targetExit]);
};

const edgePoints = (edge: ElkExtendedEdge, offset: ElkPoint): ElkPoint[] => {
  const section = edge.sections?.[0];
  if (!section) return [];
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
    .map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
};

const labelPosition = (
  edge: ElkGraphElement,
  offset: ElkPoint,
): GridPoint | undefined => {
  const first = edge.labels?.[0];
  if (first?.x === undefined || first.y === undefined) return undefined;
  return {
    x: quantizeCoordinate(offset.x + first.x),
    y: quantizeCoordinate(offset.y + first.y),
  };
};

interface RoutedEdge extends PositionedLayoutEdge {
  elkLabelPosition?: GridPoint;
}

interface RouteSegment {
  index: number;
  from: GridPoint;
  to: GridPoint;
  length: number;
  horizontal: boolean;
}

interface LabelCandidate {
  at: GridPoint;
  allowedEdgeCells?: Set<string>;
}

const pointKey = (point: GridPoint) => `${point.x},${point.y}`;

const routeSegments = (points: GridPoint[]): RouteSegment[] => points
  .slice(1)
  .map((to, index) => {
    const from = points[index]!;
    return {
      index,
      from,
      to,
      length: Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
      horizontal: from.y === to.y,
    };
  })
  .filter((segment) => segment.length > 0)
  .sort((left, right) => right.length - left.length || left.index - right.index);

const segmentCellKeys = (segment: RouteSegment) => {
  const dx = Math.sign(segment.to.x - segment.from.x);
  const dy = Math.sign(segment.to.y - segment.from.y);
  const result = new Set<string>();
  let current = { ...segment.from };
  result.add(pointKey(current));
  while (current.x !== segment.to.x || current.y !== segment.to.y) {
    current = { x: current.x + dx, y: current.y + dy };
    result.add(pointKey(current));
  }
  return result;
};

const rectCellKeys = (at: GridPoint, width: number, height: number) => {
  const result: string[] = [];
  for (let x = at.x; x < at.x + width; x += 1) {
    for (let y = at.y; y < at.y + height; y += 1) {
      result.push(`${x},${y}`);
    }
  }
  return result;
};

const inlineLabelCandidates = (
  edge: RoutedEdge,
  label: LayoutLabel,
): LabelCandidate[] => {
  if (label.height !== 1) return [];
  return routeSegments(edge.points).flatMap((segment) => {
    if (!segment.horizontal || segment.length < label.width + 1) return [];
    const left = Math.min(segment.from.x, segment.to.x);
    const right = Math.max(segment.from.x, segment.to.x);
    const centered = Math.floor((left + right - label.width) / 2);
    const x = Math.max(left + 1, Math.min(centered, right - label.width));
    const allowedEdgeCells = new Set(
      [...segmentCellKeys(segment)].filter((key) => {
        const cellX = Number(key.slice(0, key.indexOf(",")));
        return cellX > left && cellX < right;
      }),
    );
    return [{ at: { x, y: segment.from.y }, allowedEdgeCells }];
  });
};

function* adjacentLabelCandidates(
  edge: RoutedEdge,
  label: LayoutLabel,
  searchLimit: number,
): Generator<LabelCandidate> {
  const segments = routeSegments(edge.points);
  for (let distance = 1; distance <= searchLimit; distance += 1) {
    for (const segment of segments) {
      if (segment.horizontal) {
        const left = Math.min(segment.from.x, segment.to.x);
        const right = Math.max(segment.from.x, segment.to.x);
        const x = Math.floor((left + right - label.width) / 2);
        const above = { x, y: segment.from.y - label.height - distance + 1 };
        yield { at: above };
        yield { at: { x, y: segment.from.y + distance } };
      } else {
        const top = Math.min(segment.from.y, segment.to.y);
        const bottom = Math.max(segment.from.y, segment.to.y);
        const y = Math.floor((top + bottom - label.height) / 2);
        const left = { x: segment.from.x - label.width - distance + 1, y };
        yield { at: left };
        yield { at: { x: segment.from.x + distance, y } };
      }
    }
  }
}

const addRectCells = (
  target: Set<string>,
  rect: { x: number; y: number; width: number; height: number },
) => {
  for (const key of rectCellKeys(rect, rect.width, rect.height)) target.add(key);
};

const addGroupBorderCells = (
  target: Set<string>,
  group: { x: number; y: number; width: number; height: number },
) => {
  const right = group.x + group.width - 1;
  const bottom = group.y + group.height - 1;
  for (let x = group.x; x <= right; x += 1) {
    target.add(`${x},${group.y}`);
    target.add(`${x},${bottom}`);
  }
  for (let y = group.y; y <= bottom; y += 1) {
    target.add(`${group.x},${y}`);
    target.add(`${right},${y}`);
  }
};

const placeEdgeLabels = (
  edges: RoutedEdge[],
  nodes: PositionedLayoutNode[],
  groups: GridLayout["groups"],
  width: number,
  height: number,
): PositionedLayoutEdge[] => {
  const blocked = new Set<string>();
  for (const node of nodes) addRectCells(blocked, node);
  for (const group of groups) addGroupBorderCells(blocked, group);

  const edgeOwners = new Map<string, Set<string>>();
  const edgeCells = new Map<string, Set<string>>();
  const protectedCells = new Map<string, Set<string>>();
  for (const edge of edges) {
    const owned = new Set<string>();
    for (const segment of routeSegments(edge.points)) {
      for (const key of segmentCellKeys(segment)) {
        owned.add(key);
        const owners = edgeOwners.get(key) ?? new Set<string>();
        owners.add(edge.id);
        edgeOwners.set(key, owners);
      }
    }
    edgeCells.set(edge.id, owned);
    protectedCells.set(edge.id, new Set(edge.points.map(pointKey)));
  }

  const reservedLabels = new Set<string>();
  const isAvailable = (edge: RoutedEdge, label: LayoutLabel, candidate: LabelCandidate) => {
    const ownProtected = protectedCells.get(edge.id) ?? new Set<string>();
    for (const key of rectCellKeys(candidate.at, label.width, label.height)) {
      if (blocked.has(key) || reservedLabels.has(key) || ownProtected.has(key)) return false;
      const owners = edgeOwners.get(key);
      if (!owners || owners.size === 0) continue;
      const allowed = candidate.allowedEdgeCells?.has(key) &&
        owners.size === 1 && owners.has(edge.id);
      if (!allowed) return false;
    }
    return true;
  };

  return edges.map((edge) => {
    const { elkLabelPosition, ...positioned } = edge;
    if (!edge.label) return positioned;
    const ownOrdinaryCells = new Set(
      [...(edgeCells.get(edge.id) ?? [])].filter((key) =>
        !(protectedCells.get(edge.id)?.has(key) ?? false)
      ),
    );
    const elkCandidate = elkLabelPosition
      ? [{ at: elkLabelPosition, allowedEdgeCells: ownOrdinaryCells }]
      : [];
    const inlineCandidates = inlineLabelCandidates(edge, edge.label);
    const candidates = edge.source === edge.target
      ? [...elkCandidate, ...inlineCandidates]
      : [...inlineCandidates, ...elkCandidate];
    const searchLimit = width + height + edge.label.width + edge.label.height;
    let selected = candidates.find((candidate) =>
      isAvailable(edge, edge.label!, candidate)
    );
    if (!selected) {
      for (const candidate of adjacentLabelCandidates(edge, edge.label, searchLimit)) {
        if (!isAvailable(edge, edge.label, candidate)) continue;
        selected = candidate;
        break;
      }
    }
    if (!selected) throw new Error(`Could not place label for edge ${edge.id}`);
    for (const key of rectCellKeys(selected.at, edge.label.width, edge.label.height)) {
      reservedLabels.add(key);
    }
    return { ...positioned, labelPosition: selected.at };
  });
};

const translatePoint = (point: GridPoint, x: number, y: number): GridPoint => ({
  x: point.x + x,
  y: point.y + y,
});

const normalizeGridLayoutOrigin = (layout: GridLayout): GridLayout => {
  const points = [
    ...layout.nodes.map(({ x, y }) => ({ x, y })),
    ...layout.groups.map(({ x, y }) => ({ x, y })),
    ...layout.edges.flatMap((edge) => [
      ...edge.points,
      edge.sourceEndpoint.anchor,
      edge.sourceEndpoint.marker,
      edge.targetEndpoint.anchor,
      edge.targetEndpoint.marker,
      ...(edge.labelPosition ? [edge.labelPosition] : []),
    ]),
  ];
  const offsetX = -Math.min(0, ...points.map((point) => point.x));
  const offsetY = -Math.min(0, ...points.map((point) => point.y));
  if (offsetX === 0 && offsetY === 0) return layout;
  const translateEndpoint = (endpoint: PositionedEdgeEndpoint) => ({
    ...endpoint,
    anchor: translatePoint(endpoint.anchor, offsetX, offsetY),
    marker: translatePoint(endpoint.marker, offsetX, offsetY),
  });

  return {
    width: layout.width + offsetX,
    height: layout.height + offsetY,
    nodes: layout.nodes.map((node) => ({
      ...node,
      ...translatePoint(node, offsetX, offsetY),
    })),
    groups: layout.groups.map((group) => ({
      ...group,
      ...translatePoint(group, offsetX, offsetY),
    })),
    edges: layout.edges.map((edge) => ({
      ...edge,
      points: edge.points.map((point) => translatePoint(point, offsetX, offsetY)),
      sourceEndpoint: translateEndpoint(edge.sourceEndpoint),
      targetEndpoint: translateEndpoint(edge.targetEndpoint),
      labelPosition: edge.labelPosition
        ? translatePoint(edge.labelPosition, offsetX, offsetY)
        : undefined,
    })),
  };
};

export const fromElkGraph = (
  graph: LayoutGraph,
  laidOut: ElkNode,
): GridLayout => {
  const modelNodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const modelGroups = new Map(graph.groups.map((group) => [group.id, group]));
  const nodes: PositionedLayoutNode[] = [];
  const elkNodes = new Map<string, { x: number; y: number; width: number; height: number }>();
  const groups: GridLayout["groups"] = [];
  const positionedEdges: Array<{ edge: ElkExtendedEdge; offset: ElkPoint }> =
    (laidOut.edges ?? []).map((edge) => ({ edge, offset: { x: 0, y: 0 } }));

  const visit = (children: ElkNode[] | undefined, offset: ElkPoint) => {
    for (const child of children ?? []) {
      const rawX = offset.x + (child.x ?? 0);
      const rawY = offset.y + (child.y ?? 0);
      const x = quantizeCoordinate(rawX);
      const y = quantizeCoordinate(rawY);
      const modelNode = modelNodes.get(child.id);
      const modelGroup = modelGroups.get(child.id);
      if (modelNode) {
        nodes.push({ ...modelNode, x, y });
        elkNodes.set(child.id, {
          x: rawX,
          y: rawY,
          width: child.width ?? modelNode.width,
          height: child.height ?? modelNode.height,
        });
      } else if (modelGroup) {
        groups.push({
          ...modelGroup,
          x,
          y,
          width: Math.max(1, quantizeCoordinate(child.width)),
          height: Math.max(1, quantizeCoordinate(child.height)),
        });
      }
      for (const edge of child.edges ?? []) {
        positionedEdges.push({ edge, offset: { x: rawX, y: rawY } });
      }
      visit(child.children, { x: rawX, y: rawY });
    }
  };
  visit(laidOut.children, { x: 0, y: 0 });

  const positionedById = new Map(nodes.map((node) => [node.id, node]));
  const modelEdges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const preparedEdges = positionedEdges.flatMap(({ edge, offset }) => {
    const modelEdge = modelEdges.get(edge.id);
    const source = modelEdge && positionedById.get(modelEdge.source);
    const target = modelEdge && positionedById.get(modelEdge.target);
    const elkSource = modelEdge && elkNodes.get(modelEdge.source);
    const elkTarget = modelEdge && elkNodes.get(modelEdge.target);
    if (!modelEdge || !source || !target || !elkSource || !elkTarget) return [];
    const rawPoints = edgePoints(edge, offset);
    if (rawPoints.length < 2) return [];
    return [{
      edge,
      offset,
      modelEdge,
      source,
      target,
      rawPoints,
      sourceSide: nearestNodeSide(
        rawPoints[0]!, rawPoints[1]!, elkSource, graph.direction, true,
      ),
      targetSide: nearestNodeSide(
        rawPoints.at(-1)!, rawPoints.at(-2)!, elkTarget, graph.direction, false,
      ),
    }];
  });
  const attachmentCounts = new Map<string, number>();
  const attachmentKey = (nodeId: string, side: GridSide) => `${nodeId}:${side}`;
  for (const { modelEdge, sourceSide, targetSide } of preparedEdges) {
    const sourceKey = attachmentKey(modelEdge.source, sourceSide);
    const targetKey = attachmentKey(modelEdge.target, targetSide);
    attachmentCounts.set(sourceKey, (attachmentCounts.get(sourceKey) ?? 0) + 1);
    attachmentCounts.set(targetKey, (attachmentCounts.get(targetKey) ?? 0) + 1);
  }

  const routedEdges: RoutedEdge[] = preparedEdges.map(({
    edge,
    offset,
    modelEdge,
    source,
    target,
    rawPoints,
    sourceSide,
    targetSide,
  }) => {
    const sourceEndpoint = endpointFor(
      rawPoints[0]!,
      source,
      sourceSide,
      attachmentCounts.get(attachmentKey(modelEdge.source, sourceSide)) ?? 1,
    );
    const targetEndpoint = endpointFor(
      rawPoints.at(-1)!,
      target,
      targetSide,
      attachmentCounts.get(attachmentKey(modelEdge.target, targetSide)) ?? 1,
    );
    const routed = routeWithEndpoints(
      quantizeRoute(rawPoints),
      sourceEndpoint,
      targetEndpoint,
      modelEdge.routing?.sourceClearance,
      modelEdge.routing?.targetClearance,
    );
    const points = modelEdge.source === modelEdge.target &&
      modelEdge.routing?.selfLoop === "compact"
      ? compactSelfLoop(
          routed,
          sourceEndpoint,
          targetEndpoint,
          modelEdge.routing.sourceClearance,
          modelEdge.routing.targetClearance,
        )
      : routed;
    const elkLabelPosition = modelEdge.label
      ? labelPosition(edge, offset)
      : undefined;
    return {
      ...modelEdge,
      points,
      sourceEndpoint,
      targetEndpoint,
      elkLabelPosition,
    };
  });

  const routeMaxX = Math.max(
    quantizeCoordinate(laidOut.width),
    ...nodes.map((node) => node.x + node.width),
    ...groups.map((group) => group.x + group.width),
    ...routedEdges.flatMap((edge) => edge.points.map((point) => point.x + 1)),
  );
  const routeMaxY = Math.max(
    quantizeCoordinate(laidOut.height),
    ...nodes.map((node) => node.y + node.height),
    ...groups.map((group) => group.y + group.height),
    ...routedEdges.flatMap((edge) => edge.points.map((point) => point.y + 1)),
  );
  const edges = placeEdgeLabels(routedEdges, nodes, groups, routeMaxX, routeMaxY);
  const maxX = Math.max(
    routeMaxX,
    ...edges.flatMap((edge) => edge.label && edge.labelPosition
      ? [edge.labelPosition.x + edge.label.width]
      : []),
  );
  const maxY = Math.max(
    routeMaxY,
    ...edges.flatMap((edge) => edge.label && edge.labelPosition
      ? [edge.labelPosition.y + edge.label.height]
      : []),
  );

  return normalizeGridLayoutOrigin({ width: maxX, height: maxY, nodes, edges, groups });
};

export const layoutWithElk = async (
  graph: LayoutGraph,
  elk: ELK,
): Promise<GridLayout> => fromElkGraph(graph, await elk.layout(toElkGraph(graph)));
