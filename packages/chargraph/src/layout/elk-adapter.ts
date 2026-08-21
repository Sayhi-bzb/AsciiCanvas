import { getTextCellWidth } from "@chardesk/protocol";
import type {
  ELK,
  ElkExtendedEdge,
  ElkGraphElement,
  ElkNode,
  ElkPoint,
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
) => ({
  "elk.algorithm": "layered",
  "elk.direction": directionMap[direction],
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
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

export const toElkGraph = (graph: LayoutGraph): ElkNode => {
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
    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
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
        ...rootOptions(graph.direction, graph.spacing),
        "elk.padding": "[top=2,left=2,bottom=2,right=2]",
      },
    })),
    ...(directNodes.get(parentId) ?? []).map((node): ElkNode => ({
      id: node.id,
      width: node.width,
      height: node.height,
      layoutOptions: rankOptions(node),
    })),
  ];

  return {
    id: "layout:root",
    children: childrenFor(undefined),
    edges: directEdges.get(undefined),
    layoutOptions: rootOptions(graph.direction, graph.spacing),
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
  adjacent: ElkPoint,
  node: PositionedLayoutNode,
  elkNode: { x: number; y: number; width: number; height: number },
  layoutDirection: LayoutDirection,
  source: boolean,
): PositionedEdgeEndpoint => {
  const side = nearestNodeSide(point, adjacent, elkNode, layoutDirection, source);
  const outward = sideOutward[side];
  const distributed = node.portPlacement === "distributed";
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

const routeWithEndpoints = (
  points: GridPoint[],
  source: PositionedEdgeEndpoint,
  target: PositionedEdgeEndpoint,
): GridPoint[] => {
  const waypoints = [
    source.anchor,
    source.marker,
    ...points.slice(1, -1),
    target.marker,
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
  return simplifyOrthogonal(result, [source.marker, target.marker]);
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
        const x = Math.max(0, Math.floor((left + right - label.width) / 2));
        const above = { x, y: segment.from.y - label.height - distance + 1 };
        if (above.y >= 0) yield { at: above };
        yield { at: { x, y: segment.from.y + distance } };
      } else {
        const top = Math.min(segment.from.y, segment.to.y);
        const bottom = Math.max(segment.from.y, segment.to.y);
        const y = Math.max(0, Math.floor((top + bottom - label.height) / 2));
        const left = { x: segment.from.x - label.width - distance + 1, y };
        if (left.x >= 0) yield { at: left };
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
  const routedEdges: RoutedEdge[] = positionedEdges.flatMap(({ edge, offset }) => {
    const modelEdge = modelEdges.get(edge.id);
    const source = modelEdge && positionedById.get(modelEdge.source);
    const target = modelEdge && positionedById.get(modelEdge.target);
    const elkSource = modelEdge && elkNodes.get(modelEdge.source);
    const elkTarget = modelEdge && elkNodes.get(modelEdge.target);
    if (!modelEdge || !source || !target || !elkSource || !elkTarget) return [];
    const rawPoints = edgePoints(edge, offset);
    if (rawPoints.length < 2) return [];
    const sourceEndpoint = endpointFor(
      rawPoints[0]!, rawPoints[1]!, source, elkSource, graph.direction, true,
    );
    const targetEndpoint = endpointFor(
      rawPoints.at(-1)!, rawPoints.at(-2)!, target, elkTarget, graph.direction, false,
    );
    const points = routeWithEndpoints(
      quantizeRoute(rawPoints), sourceEndpoint, targetEndpoint,
    );
    const elkLabelPosition = modelEdge.label
      ? labelPosition(edge, offset)
      : undefined;
    return [{
      ...modelEdge,
      points,
      sourceEndpoint,
      targetEndpoint,
      elkLabelPosition,
    }];
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

  return { width: maxX, height: maxY, nodes, edges, groups };
};

export const layoutWithElk = async (
  graph: LayoutGraph,
  elk: ELK,
): Promise<GridLayout> => fromElkGraph(graph, await elk.layout(toElkGraph(graph)));
